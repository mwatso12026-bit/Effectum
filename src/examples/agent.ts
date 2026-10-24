/**
 * Tiny Pulse agent: uses LLM + Log + State under a sealed effect algebra.
 * Everything is reified. Everything is interpretable. Nothing is hidden.
 */

import { gen, flatMap, Pure } from "../effect.js";
import { run, compose } from "../interpreter.js";
import { LLM, mockLLM } from "../effects/llm.js";
import { info, interpretLog } from "../effects/log.js";
import { Get, Put, interpretState } from "../effects/state.js";

type Row = ReturnType<typeof LLM> extends import("../effect.js").Effect<any, infer R>
  ? R
  : never;

// In practice you would write a proper row type. For the demo we use any.
async function main() {
  const program = gen(function* () {
    yield* info("Pulse agent starting");

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
