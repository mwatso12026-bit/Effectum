/**
 * Tiny Reify agent: uses LLM + Log + State under a sealed effect algebra.
 * Everything is reified. Everything is interpretable. Nothing is hidden.
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

    const answer = yield* LLM({
      messages: [
        {
          role: "user",
          content: "In one sentence: what is a sealed effect algebra?",
        },
      ],
      model: "grok",
    });

    yield* info(`LLM said: ${answer}`);
    yield* Put(step + 1);

    const next = yield* Get<number>();
    yield* info(`Next step will be: ${next}`);

    return answer;
  });

  const interpreter = compose(
    compose(
      mockLLM([
        "A sealed effect algebra is a closed set of reified effect constructors that can only be interpreted, never freely extended at the call site.",
      ]),
      interpretLog((level, msg) => console.log(`[${level}] ${msg}`))
    ),
    interpretState(0)
  );

  const result = await run(program as any, interpreter as any);
  console.log("\nFinal result:", result);
}

main().catch(console.error);
