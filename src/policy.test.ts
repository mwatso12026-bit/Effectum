import { it } from "node:test";
import assert from "node:assert/strict";
import { LLM, type LLMRequest } from "./effects/llm.js";
import { compose, run } from "./interpreter.js";
import { withPolicy, PermissionDeniedError, type PolicyDecision } from "./policy.js";

const program = () => LLM({ messages: [{ role: "user", content: "original" }] });

it("denies missing and explicitly denied rules before handler invocation", async () => {
  let calls = 0;
  for (const rules of [{}, { LLM: "deny" as const }]) {
    await assert.rejects(run(program(), withPolicy<LLMRequest>(() => { calls++; }, { rules })), PermissionDeniedError);
  }
  assert.equal(calls, 0);
});

it("allows configured effects without asking for approval", async () => {
  assert.equal(await run(program(), withPolicy<LLMRequest>(() => "allowed", {
    rules: { LLM: "allow" }, approve: () => { throw Error("Should not ask"); },
  })), "allowed");
});

it("requires literal approval, failing closed if approval is absent or declined", async () => {
  let calls = 0;
  for (const approve of [undefined, () => false]) {
    await assert.rejects(run(program(), withPolicy<LLMRequest>(() => { calls++; }, {
      rules: { LLM: "approve" }, approve,
    })), PermissionDeniedError);
  }
  assert.equal(calls, 0);
  assert.equal(await run(program(), withPolicy<LLMRequest>(() => "approved", {
    rules: { LLM: "approve" }, approve: async () => true,
  })), "approved");
});

it("executes the frozen approved snapshot despite original payload mutation", async () => {
  const messages = [{ role: "user", content: "original" }];
  let approved: Readonly<LLMRequest> | undefined;
  const interpreter = withPolicy<LLMRequest>(request => {
    assert.equal(request, approved);
    return request.messages[0].content;
  }, {
    rules: { LLM: "approve" },
    approve: async request => {
      approved = request;
      messages[0].content = "changed";
      assert.throws(() => { request.messages[0].content = "changed"; }, TypeError);
      return true;
    },
  });
  assert.equal(await run(LLM({ messages }), interpreter), "original");
});

it("prevents a cancelled pending approval from invoking the handler", async () => {
  const controller = new AbortController();
  let complete!: (approved: boolean) => void;
  let asked!: () => void;
  const asking = new Promise<void>(resolve => { asked = resolve; });
  let called = false;
  const interpreter = withPolicy<LLMRequest>(() => { called = true; }, {
    rules: { LLM: "approve" }, signal: controller.signal,
    approve: () => { asked(); return new Promise(resolve => { complete = resolve; }); },
  });
  const result = run(program(), interpreter, { signal: controller.signal });
  await asking;
  controller.abort();
  await assert.rejects(result, { name: "AbortError" });
  complete(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(called, false);
});

it("propagates approval and handler failures and never falls back on a denial", async () => {
  const failure = new Error("Approval service failed");
  await assert.rejects(run(program(), withPolicy<LLMRequest>(() => "unused", {
    rules: { LLM: "approve" }, approve: () => { throw failure; },
  })), error => error === failure);
  await assert.rejects(run(program(), withPolicy<LLMRequest>(() => { throw failure; }, {
    rules: { LLM: "allow" },
  })), error => error === failure);
  let fallback = false;
  await assert.rejects(run(program(), compose<LLMRequest, LLMRequest>(
    () => { fallback = true; }, withPolicy(() => "unused", { rules: {} }),
  )), PermissionDeniedError);
  assert.equal(fallback, false);
});

it("copies rules so later mutations cannot silently grant permissions", async () => {
  const rules: Partial<Record<"LLM", PolicyDecision>> = {};
  const interpreter = withPolicy<LLMRequest>(() => "unused", { rules });
  rules.LLM = "allow";
  await assert.rejects(run(program(), interpreter), PermissionDeniedError);
});
