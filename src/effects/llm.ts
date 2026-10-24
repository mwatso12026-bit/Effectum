/**
 * LLM call as a first-class, reified effect.
 * No hidden network. No special runtime privileges.
 */

import { perform } from "../effect.js";
import type { Interpreter } from "../interpreter.js";

export type LLMRequest = {
  readonly _tag: "LLM";
  readonly messages: Array<{ role: string; content: string }>;
  readonly model?: string;
  readonly temperature?: number;
};

export type LLM = LLMRequest;

export const LLM = (req: Omit<LLMRequest, "_tag">): Effect<string, LLM> =>
  perform({ _tag: "LLM", ...req });

import type { Effect } from "../effect.js";

/** Default interpreter — replace with your real provider. */
export const interpretLLM = (opts: {
  call: (req: LLMRequest) => Promise<string>;
}): Interpreter<LLM> => (effect) => {
  if (effect._tag !== "LLM") {
    throw new Error("Not an LLM effect");
  }
  return opts.call(effect);
};

/** Mock interpreter for tests / pure replay. */
export const mockLLM = (responses: string[]): Interpreter<LLM> => {
  let i = 0;
  return (effect) => {
    if (effect._tag !== "LLM") throw new Error("Not an LLM effect");
    const r = responses[i++] ?? "[no more mock responses]";
    return Promise.resolve(r);
  };
};
