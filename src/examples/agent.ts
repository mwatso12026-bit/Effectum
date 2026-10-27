/**
 * Tiny Reify agent: uses LLM + Log + State under a sealed effect algebra.
 * Everything is reified. Everything is interpretable. Nothing is hidden.
 *
 * Local single-user example. Runs fully offline with the mock interpreter.
 * The LLM effect is model-agnostic. The `model` field is just data
 * passed to whatever interpreter you plug in (OpenAI, Anthropic, Grok,
 * local model, mock, etc.).
 */

import { gen } from "../effect.js";
import { run, compose } from "../interpreter.js";
import { LLM, mockLLM } from "../effects/llm.js";
import { info, interpretLog } from "../effects/log.js";
import { Get, Put, interpretState } from "../effects/state.js";

async function main() {
  const program = gen(function* () {
    yield* info("Reify agent starting");

    const step = yield* Get<number>();
    yield* info(`Current step: ${step}`);

    // model is optional and just a string — your interpreter decides what to do with it
    const answer = yield* LLM({
      messages: [
        {
          role: "user",
          content: "In one sentence: what is a sealed effect algebra?",
        },
      ],
      // model: "gpt-4o" | "claude-3-5-sonnet" | "grok-4" | "llama3" | whatever
    });

    yield* info(`LLM said: ${answer}`);
    yield* Put(step + 1);

    const next = yield* Get<number>();
    yield* info(`Next step will be: ${next}`);

    return answer;
  });

  // Using a mock interpreter so this runs offline and single-user local.
  // Swap mockLLM for interpretLLM({ call: yourRealProvider }) when you want a real model.
  const interpreter = compose(
    compose(
      mockLLM([
        "A sealed effect algebra is a closed set of reified effect constructors that can only be interpreted, never freely extended at the call site.",
      ]),
      interpretLog((level, msg) => console.log(`[${level}] ${msg}`))
    ),
    interpretState(0)
  );

  const result = await run(program, interpreter);
  console.log("\nFinal result:", result);
}

main().catch(console.error);
