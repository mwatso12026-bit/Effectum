/**
 * Sealed effect algebra.
 * Effects are reified data. The algebra is closed over the declared row.
 */

export type Pure<A> = { readonly _tag: "Pure"; readonly value: A };

export type Impure<R, A> = {
  readonly _tag: "Impure";
  readonly effect: R;
  readonly cont: (result: unknown) => Effect<A, R>;
};

export type Suspend<A, R> = {
  readonly _tag: "Suspend";
  readonly thunk: () => Effect<A, R>;
};

/**
 * The core effect type. R is a sealed row of possible effects.
 * You cannot introduce new effects without extending R.
 */
export type Effect<A, R = never> =
  | Pure<A>
  | Impure<R, A>
  | Suspend<A, R>;

export const Pure = <A>(value: A): Effect<A, never> => ({
  _tag: "Pure",
  value,
});

export const Impure = <R, A>(
  effect: R,
  cont: (result: unknown) => Effect<A, R>
): Effect<A, R> => ({
  _tag: "Impure",
  effect,
  cont,
});

export const Suspend = <A, R>(
  thunk: () => Effect<A, R>
): Effect<A, R> => ({
  _tag: "Suspend",
  thunk,
});

/** Lift a single effect into the algebra and continue. */
export const perform = <R, A>(
  effect: R
): Effect<A, R> =>
  Impure(effect, (result) => Pure(result as A));

/** Monadic bind — keeps the row sealed. */
export const flatMap = <A, B, R>(
  ma: Effect<A, R>,
  f: (a: A) => Effect<B, R>
): Effect<B, R> => {
  switch (ma._tag) {
    case "Pure":
      return f(ma.value);
    case "Impure":
      return Impure(ma.effect, (r) => flatMap(ma.cont(r), f));
    case "Suspend":
      return Suspend(() => flatMap(ma.thunk(), f));
  }
};

export const map = <A, B, R>(
  ma: Effect<A, R>,
  f: (a: A) => B
): Effect<B, R> => flatMap(ma, (a) => Pure(f(a)));

/** Generator-style syntax sugar. */
export function* gen<A, R>(
  f: () => Generator<Effect<any, R>, A, any>
): Effect<A, R> {
  const iter = f();
  const step = (value?: unknown): Effect<A, R> => {
    const result = iter.next(value);
    if (result.done) return Pure(result.value);
    return flatMap(result.value, step);
  };
  return Suspend(() => step());
}
