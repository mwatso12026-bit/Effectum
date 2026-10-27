/**
 * LLM call as a first-class, reified effect.
 * No hidden network. No special runtime privileges.
 * Designed for local single-user use; real providers are plugged in by the caller.
 */

import { perform } from "../effect.js";
import type { Effect } from "../effect.js";
import type { Interpreter } from "../interpreter.js";
import { NotAnEffectError } from "../interpreter.js";

export type LLMRequest = {
  readonly _tag: "LLM";
  readonly messages: Array<{ role: string; content: string }>;
  readonly model?: string;
  readonly temperature?: number;
};

export type LLM = LLMRequest;

export const LLM = (req: Omit<LLMRequest, "_tag">): Effect<string, LLM> =>
  perform({ _tag: "LLM", ...req });

/** Default interpreter — replace with your real provider. */
export const interpretLLM = (opts: {
  call: (req: LLMRequest) => Promise<string>;
}): Interpreter<LLM> => (effect) => {
  if (effect._tag !== "LLM") {
    throw new NotAnEffectError();
  }
  return opts.call(effect);
};

/** Mock interpreter for tests / pure local replay. */
export const mockLLM = (responses: string[]): Interpreter<LLM> => {
  let i = 0;
  return (effect) => {
    if (effect._tag !== "LLM") throw new NotAnEffectError();
    const r = responses[i++] ?? "[no more mock responses]";
    return Promise.resolve(r);
  };
};
