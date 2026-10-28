/**
 * Composable interpreters.
 * An interpreter is a pure function from a sealed effect to its result
 * (or a Promise of the result). You compose them by row.
 *
 * Handlers must throw a specific NotAnEffectError when the effect does not
 * match their tag. Real errors are rethrown so failures are never masked.
 */

import type { Effect } from "./effect.js";
import { setImmediate } from "node:timers/promises";

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

export interface RunOptions {
  /** Maximum Suspend + Impure transitions. Pure results consume no steps. */
  maxSteps?: number;
  /** Cooperative cancellation; does not undo or forcibly stop handler I/O. */
  signal?: AbortSignal;
}

export class ExecutionLimitError extends Error {
  constructor(readonly maxSteps: number) {
    super(`Execution exceeded its ${maxSteps} step limit`);
    this.name = "ExecutionLimitError";
  }
}

function checkAbort(signal?: AbortSignal): void {
  signal?.throwIfAborted();
}

function waitForHandler(value: unknown | Promise<unknown>, signal?: AbortSignal): Promise<unknown> {
  if (!signal) return Promise.resolve(value);
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    // Always observe handler rejection, including after cancellation.
    Promise.resolve(value).then(
      result => { signal.removeEventListener("abort", abort); resolve(result); },
      error => { signal.removeEventListener("abort", abort); reject(error); },
    );
    if (signal.aborted) abort();
  });
}

/** Iterative evaluation with optional fuel and cooperative cancellation. */
export async function run<A, R>(
  effect: Effect<A, R>,
  interpreter: Interpreter<R>,
  options: RunOptions = {},
): Promise<A> {
  const { maxSteps, signal } = options;
  if (maxSteps !== undefined && (!Number.isSafeInteger(maxSteps) || maxSteps < 0)) {
    throw new RangeError("maxSteps must be a nonnegative safe integer");
  }
  let current = effect;
  let steps = 0;
  while (true) {
    checkAbort(signal);
    if (current._tag === "Pure") return current.value;
    if (maxSteps !== undefined && steps >= maxSteps) throw new ExecutionLimitError(maxSteps);
    // Let timers, cancellation, and other work run during long synchronous chains.
    if (steps > 0 && steps % 256 === 0) {
      await setImmediate();
      checkAbort(signal);
    }
    steps++;
    if (current._tag === "Suspend") {
      current = current.thunk();
    } else {
      const result = await waitForHandler(interpreter(current.effect), signal);
      checkAbort(signal);
      current = current.cont(result);
    }
  }
}

