import { it } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { Pure, Suspend, gen, type Effect } from "./effect.js";
import { run, ExecutionLimitError } from "./interpreter.js";
import { LLM } from "./effects/llm.js";

it("counts suspension and handler steps with exact fuel boundaries", async () => {
  const program = Suspend(() => LLM({ messages: [] }));
  let calls = 0;
  await assert.rejects(run(program, () => { calls++; return "ok"; }, { maxSteps: 1 }), ExecutionLimitError);
  assert.equal(calls, 0);
  assert.equal(await run(program, () => "ok", { maxSteps: 2 }), "ok");
  assert.equal(await run(Pure(42), () => undefined, { maxSteps: 0 }), 42);
});

it("stops an infinite suspension loop at the configured limit", async () => {
  const loop = (): Effect<never> => Suspend(loop);
  await assert.rejects(run(loop(), () => undefined, { maxSteps: 1000 }), ExecutionLimitError);
});

it("rejects invalid fuel values", async () => {
  for (const maxSteps of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(run(Pure(1), () => undefined, { maxSteps }), RangeError);
  }
});

it("does not invoke a handler for an already cancelled run", async () => {
  const controller = new AbortController();
  const reason = new Error("Stopped");
  controller.abort(reason);
  let called = false;
  await assert.rejects(run(LLM({ messages: [] }), () => { called = true; },
    { signal: controller.signal }), error => error === reason);
  assert.equal(called, false);
});

it("lets timers cancel an infinite synchronous chain", { timeout: 2000 }, async () => {
  const loop = (): Effect<never> => Suspend(loop);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10);
  try {
    await assert.rejects(run(loop(), () => undefined, { signal: controller.signal }), { name: "AbortError" });
  } finally { clearTimeout(timer); }
});

it("cancels pending handlers without executing their continuation", { timeout: 2000 }, async () => {
  const controller = new AbortController();
  let continued = false;
  const program = gen(function* () {
    yield LLM({ messages: [] });
    continued = true;
  });
  let finish!: (value: string) => void;
  const pending = new Promise<string>(resolve => { finish = resolve; });
  const result = run(program, () => pending, { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  finish("late response");
  await delay(0);
  assert.equal(continued, false);
});
