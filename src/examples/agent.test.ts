/**
 * Local single-user test. Runs the sealed-effect agent with mock interpreters.
 * No network, no multi-tenant, no external services.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gen } from "../effect.js";
import { run, compose } from "../interpreter.js";
import { LLM, mockLLM } from "../effects/llm.js";
import { info, interpretLog } from "../effects/log.js";
import { Get, Put, interpretState } from "../effects/state.js";

describe("local single-user agent", () => {
  it("runs the mock agent and returns the canned answer", async () => {
    const program = gen(function* () {
      yield info("test start");
      const step = yield Get<number>();
      const answer = yield LLM({
        messages: [{ role: "user", content: "test" }],
      });
      yield Put(step + 1);
      return answer;
    });

    const interpreter = compose(
      compose(
        mockLLM(["sealed effects are reified data"]),
        interpretLog(() => {})
      ),
      interpretState(0)
    );

    const result = await run(program, interpreter);
    assert.equal(result, "sealed effects are reified data");
  });
});
