/**
 * Stack-safe trampoline for evaluating Effects.
 * Related Lean model: lean/Trampoline.lean (incomplete proof sketch).
 */

import type { Effect } from "./effect.js";

export type Trampoline<A> =
  | { readonly _tag: "Done"; readonly value: A }
  | { readonly _tag: "More"; readonly next: () => Trampoline<A> };

export const Done = <A>(value: A): Trampoline<A> => ({
  _tag: "Done",
  value,
});

export const More = <A>(next: () => Trampoline<A>): Trampoline<A> => ({
  _tag: "More",
  next,
});

/** Run a trampoline to completion without blowing the stack. */
export function runTrampoline<A>(t: Trampoline<A>): A {
  let current: Trampoline<A> = t;
  while (current._tag === "More") {
    current = current.next();
  }
  return current.value;
}

/**
 * Convert an Effect into a Trampoline by suspending every step.
 * Evaluation uses iterative suspension and Promise continuations.
 * The Lean sketch does not prove this TypeScript implementation correct
 * or guarantee termination of arbitrary programs.
 */
export function effectToTrampoline<A, R>(
  effect: Effect<A, R>,
  handle: (r: R) => unknown | Promise<unknown>
): Trampoline<Promise<A>> {
  const go = (e: Effect<A, R>): Trampoline<Promise<A>> => {
    switch (e._tag) {
      case "Pure":
        return Done(Promise.resolve(e.value));
      case "Suspend":
        return More(() => go(e.thunk()));
      case "Impure": {
        return More(() => {
          const raw = handle(e.effect);
          const p = Promise.resolve(raw).then((result) => {
            const contEffect = e.cont(result);
            return runTrampoline(go(contEffect));
          });
          return Done(p);
        });
      }
    }
  };
  return go(effect);
}

