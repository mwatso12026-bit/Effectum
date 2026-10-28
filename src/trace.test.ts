import { it } from "node:test";
import assert from "node:assert/strict";
import { ExecutionTrace } from "./trace.js";
import { withPolicy, PermissionDeniedError } from "./policy.js";
import { run } from "./interpreter.js";
import { LLM, type LLMRequest } from "./effects/llm.js";

const request = () => LLM({ messages: [{ role: "user", content: "secret prompt" }] });
const stages = (trace: ExecutionTrace) => trace.snapshot().events.map(event => event.stage);

it("records allowed execution in order without payloads or output", async () => {
  const trace = new ExecutionTrace();
  await run(request(), withPolicy<LLMRequest>(() => "secret answer", { rules: { LLM: "allow" }, trace }));
  assert.deepEqual(stages(trace), ["requested", "allowed", "started", "completed"]);
  const events = trace.snapshot().events;
  assert.equal(new Set(events.map(event => event.requestId)).size, 1);
  assert.deepEqual(events.map(event => event.sequence), [1, 2, 3, 4]);
  assert.equal(JSON.stringify(trace).includes("secret"), false);
});

it("distinguishes approvals, declines, and default denials", async () => {
  for (const approved of [true, false]) {
    const trace = new ExecutionTrace();
    const result = run(request(), withPolicy<LLMRequest>(() => "ok", {
      rules: { LLM: "approve" }, approve: () => approved, trace,
    }));
    if (approved) await result;
    else await assert.rejects(result, PermissionDeniedError);
    assert.deepEqual(stages(trace), approved
      ? ["requested", "approval_required", "approved", "started", "completed"]
      : ["requested", "approval_required", "denied"]);
  }
  const trace = new ExecutionTrace();
  await assert.rejects(run(request(), withPolicy<LLMRequest>(() => "unused", { rules: {}, trace })), PermissionDeniedError);
  assert.deepEqual(stages(trace), ["requested", "denied"]);
});

it("records handler failures without storing error messages", async () => {
  const trace = new ExecutionTrace();
  const failure = new Error("secret provider error");
  await assert.rejects(run(request(), withPolicy<LLMRequest>(() => { throw failure; }, {
    rules: { LLM: "allow" }, trace,
  })), error => error === failure);
  assert.deepEqual(stages(trace), ["requested", "allowed", "started", "failed"]);
  assert.equal(JSON.stringify(trace).includes("secret"), false);
});

it("separates concurrent requests in one trace", async () => {
  const trace = new ExecutionTrace();
  const interpreter = withPolicy<LLMRequest>(async () => "ok", { rules: { LLM: "allow" }, trace });
  await Promise.all([run(request(), interpreter), run(request(), interpreter)]);
  const events = trace.snapshot().events;
  assert.equal(new Set(events.map(event => event.requestId)).size, 2);
  assert.equal(new Set(events.map(event => event.traceId)).size, 1);
  for (const id of new Set(events.map(event => event.requestId))) {
    assert.deepEqual(events.filter(event => event.requestId === id).map(event => event.stage),
      ["requested", "allowed", "started", "completed"]);
  }
});

it("records cancellation promptly and ignores late approval", async () => {
  const trace = new ExecutionTrace();
  const controller = new AbortController();
  let approve!: (approved: boolean) => void;
  let ready!: () => void;
  const waiting = new Promise<void>(resolve => { ready = resolve; });
  let called = false;
  const interpreter = withPolicy<LLMRequest>(() => { called = true; }, {
    rules: { LLM: "approve" }, signal: controller.signal, trace,
    approve: () => { ready(); return new Promise(resolve => { approve = resolve; }); },
  });
  const result = run(request(), interpreter, { signal: controller.signal });
  await waiting;
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  assert.deepEqual(stages(trace), ["requested", "approval_required", "cancelled"]);
  approve(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(called, false);
  assert.deepEqual(stages(trace), ["requested", "approval_required", "cancelled"]);
});

it("bounds storage, reports dropped events, and protects snapshots", () => {
  const trace = new ExecutionTrace(2);
  trace.record("one", "LLM", "requested");
  trace.record("one", "LLM", "allowed");
  trace.record("one", "LLM", "started");
  const snapshot = trace.snapshot();
  assert.equal(snapshot.dropped, 1);
  assert.deepEqual(snapshot.events.map(event => event.sequence), [2, 3]);
  snapshot.events.pop();
  assert.equal(trace.snapshot().events.length, 2);
  assert.equal(Reflect.set(trace.snapshot().events[0], "stage", "failed"), false);
  assert.equal(JSON.parse(JSON.stringify(trace)).version, 1);
});

it("does not report late handler completion as success after cancellation", async () => {
  const trace = new ExecutionTrace();
  const controller = new AbortController();
  let finish!: (value: string) => void;
  const pending = new Promise<string>(resolve => { finish = resolve; });
  const interpreter = withPolicy<LLMRequest>(() => pending, {
    rules: { LLM: "allow" }, signal: controller.signal, trace,
  });
  const result = run(request(), interpreter, { signal: controller.signal });
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  finish("late");
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(stages(trace), ["requested", "allowed", "started", "cancelled"]);
});

it("records approval callback failure before any handler starts", async () => {
  const trace = new ExecutionTrace();
  const failure = new Error("secret approval failure");
  await assert.rejects(run(request(), withPolicy<LLMRequest>(() => "unused", {
    rules: { LLM: "approve" }, trace, approve: () => { throw failure; },
  })), error => error === failure);
  assert.deepEqual(stages(trace), ["requested", "approval_required", "failed"]);
  assert.equal(JSON.stringify(trace).includes("secret"), false);
});

it("rejects invalid capacities", () => {
  for (const capacity of [0, -1, 0.5, Infinity, NaN]) assert.throws(() => new ExecutionTrace(capacity), RangeError);
});
