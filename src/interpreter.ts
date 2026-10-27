/**
 * Composable interpreters.
 * An interpreter is a pure function from a sealed effect to its result
 * (or a Promise of the result). You compose them by row.
 *
 * Handlers must throw a specific NotAnEffectError when the effect does not
 * match their tag. Real errors are rethrown so failures are never masked.
 */

import type { Effect } from "./effect.js";
import { effectToTrampoline, runTrampoline } from "./trampoline.js";

export type Interpreter<R> = (effect: R) => unknown | Promise<unknown>;

export class NotAnEffectError extends Error {
  constructor(message = "Effect does not match this interpreter") {
    super(message);
    this.name = "NotAnEffectError";
  }
}

/** Combine two interpreters. Later ones are tried first. */
export function compose<R1, R2>(
  i1: Interpreter<R1>,
  i2: Interpreter<R2>
): Interpreter<R1 | R2> {
  return (effect) => {
    try {
      return i2(effect as R2);
    } catch (err) {
      if (err instanceof NotAnEffectError) {
        return i1(effect as R1);
      }
      throw err;
    }
  };
}

export function composeMany<R>(...is: Interpreter<R>[]): Interpreter<R> {
  return is.reduce((acc, i) => compose(acc, i));
}

/** Run an effect to completion under an interpreter, trampolined. */
export async function run<A, R>(
  effect: Effect<A, R>,
  interpreter: Interpreter<R>
): Promise<A> {
  const tramp = effectToTrampoline(effect, interpreter);
  return runTrampoline(tramp);
}
