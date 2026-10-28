import { it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { interpretFileMemory } from "./effects/file-memory.js";
import { writeMemory, readMemory, listMemory, searchMemory } from "./effects/memory.js";
import { run } from "./interpreter.js";

function fixture(t: { after: (fn: () => void) => void }) {
  const dir = mkdtempSync(join(tmpdir(), "effectum-memory-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return join(dir, "nested", "memory.json");
}
const node = { id: "one", content: "Remember ReIfy", importance: 2, timestamp: 1 };

it("persists, reopens, merges, lists, and searches memory", async (t) => {
  const path = fixture(t);
  const first = interpretFileMemory(path);
  await run(writeMemory(node), first);
  const second = interpretFileMemory(path);
  assert.deepEqual(await run(readMemory("one"), second), node);
  await run(writeMemory({ ...node, content: "Updated ReIfy", importance: 4, timestamp: 2 }), second);
  const reopened = interpretFileMemory(path);
  assert.deepEqual(await run(searchMemory("reify"), reopened), [
    { ...node, content: "Updated ReIfy", importance: 3, timestamp: 2, metadata: {} },
  ]);
  assert.equal((await run(listMemory(), reopened)).length, 1);
  assert.deepEqual(JSON.parse(readFileSync(`${path}.bak`, "utf8")).nodes, [node]);
});

it("queues writes without losing nodes and reloads external changes", async (t) => {
  const path = fixture(t);
  const store = interpretFileMemory(path);
  await Promise.all(Array.from({ length: 20 }, (_, i) => run(writeMemory({ ...node, id: String(i) }), store)));
  assert.equal((await run(listMemory(), store)).length, 20);
  await run(writeMemory(node), interpretFileMemory(path));
  assert.deepEqual(await run(readMemory(node.id), store), node);
});

it("preserves corrupt files and refuses unsupported versions", async (t) => {
  const path = fixture(t);
  const store = interpretFileMemory(path);
  await run(writeMemory(node), store);
  for (const corrupt of ["{broken", '{"version":2,"nodes":[]}', '{"version":1,"nodes":[{}]}']) {
    writeFileSync(path, corrupt);
    assert.throws(() => interpretFileMemory(path), /File preserved/);
    await assert.rejects(run(writeMemory(node), store), /File preserved/);
    assert.equal(readFileSync(path, "utf8"), corrupt);
    assert.equal(existsSync(`${path}.lock`), false);
  }
});

it("rejects invalid writes without replacing data and can recover afterward", async (t) => {
  const path = fixture(t);
  const store = interpretFileMemory(path);
  await run(writeMemory(node), store);
  const previous = readFileSync(path, "utf8");
  await assert.rejects(run(writeMemory({ ...node, importance: NaN }), store));
  assert.equal(readFileSync(path, "utf8"), previous);
  await run(writeMemory({ ...node, id: "two" }), store);
  assert.equal((await run(listMemory(), store)).length, 2);
});

it("rejects a competing lock without removing it or altering memory", async (t) => {
  const path = fixture(t);
  const store = interpretFileMemory(path);
  await run(writeMemory(node), store);
  writeFileSync(`${path}.lock`, "another writer");
  await assert.rejects(run(writeMemory({ ...node, id: "two" }), store), /locked/);
  assert.equal(readFileSync(`${path}.lock`, "utf8"), "another writer");
  assert.deepEqual(await run(readMemory(node.id), store), node);
});

it("recovers a damaged file from the previous snapshot", async (t) => {
  const path = fixture(t);
  const store = interpretFileMemory(path);
  await run(writeMemory(node), store);
  await run(writeMemory({ ...node, id: "two" }), store);
  writeFileSync(path, "damaged");
  writeFileSync(path, readFileSync(`${path}.bak`));
  assert.deepEqual(await run(listMemory(), interpretFileMemory(path)), [node]);
});
