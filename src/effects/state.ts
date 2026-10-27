import { perform } from "../effect.js";
import type { Effect } from "../effect.js";
import type { Interpreter } from "../interpreter.js";
import { NotAnEffectError } from "../interpreter.js";

export type Get = { readonly _tag: "Get" };
export type Put<S> = { readonly _tag: "Put"; readonly value: S };
export type State<S> = Get | Put<S>;

export const Get = <S>(): Effect<S, State<S>> =>
  perform({ _tag: "Get" });

export const Put = <S>(value: S): Effect<void, State<S>> =>
  perform({ _tag: "Put", value });

export const interpretState = <S>(initial: S): Interpreter<State<S>> => {
  let state = initial;
  return (effect) => {
    if (effect._tag === "Get") return state;
    if (effect._tag === "Put") {
      state = effect.value;
      return undefined;
    }
    throw new NotAnEffectError();
  };
};
