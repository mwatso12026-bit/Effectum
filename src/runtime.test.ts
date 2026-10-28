import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gen, Pure, Suspend, type Effect } from "./effect.js";
import { compose, NotAnEffectError, run } from "./interpreter.js";
import { LLM, mockLLM } from "./effects/llm.js";
import { interpretMemory, readMemory, writeMemory } from "./effects/memory.js";

describe("runtime guarantees", () => {
  it("evaluates a long suspended chain without growing the call stack", async () => {
    const count = (n: number): Effect<number> =>
      n === 0 ? Pure(42) : Suspend(() => count(n - 1));
    assert.equal(await run(count(100_000), () => {
      throw new Error("Pure computation must not invoke an interpreter");
    }), 42);
  });

  it("preserves real handler failures instead of trying a fallback", async () => {
    const failure = new Error("Provider failed");
    let fallbackCalled = false;
    const interpreter = compose(
      () => { fallbackCalled = true; return "fallback"; },
      () => { throw failure; },
    );
    await assert.rejects(run(LLM({ messages: [] }), interpreter), (err) => err === failure);
    assert.equal(fallbackCalled, false);
  });

  it("routes unmatched effects and preserves asynchronous failures", async () => {
    assert.equal(await run(LLM({ messages: [] }), compose(
      mockLLM(["ok"]),
      () => { throw new NotAnEffectError(); },
    )), "ok");
    const failure = new Error("Async provider failed");
    await assert.rejects(run(LLM({ messages: [] }), async () => { throw failure; }),
      (err) => err === failure);
  });

  it("shares memory within an interpreter and isolates new interpreters", async () => {
    const interpreter = interpretMemory();
    const node = { id: "local", content: "saved", importance: 1, timestamp: 1 };
    await run(gen(function* () { yield writeMemory(node); }), interpreter);
    assert.deepEqual(await run(readMemory("local"), interpreter), node);
    assert.equal(await run(readMemory("local"), interpretMemory()), null);
  });
});
