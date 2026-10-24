/**
 * Composable interpreters.
 * An interpreter is a pure function from a sealed effect to its result
 * (or a Promise of the result). You compose them by row.
 */

import type { Effect } from "./effect.js";
import { effectToTrampoline, runTrampoline } from "./trampoline.js";

export type Interpreter<R> = (effect: R) => unknown | Promise<unknown>;

/** Combine two interpreters. Later ones shadow earlier ones for overlapping tags. */
export function compose<R1, R2>(
  i1: Interpreter<R1>,
  i2: Interpreter<R2>
): Interpreter<R1 | R2> {
  return (effect) => {
    // Simple tag dispatch — real systems use a more structured row.
    try {
      return i2(effect as R2);
    } catch {
      return i1(effect as R1);
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
