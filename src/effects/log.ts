import { perform } from "../effect.js";
import type { Effect } from "../effect.js";
import type { Interpreter } from "../interpreter.js";

export type Log = {
  readonly _tag: "Log";
  readonly level: "info" | "warn" | "error";
  readonly message: string;
};

export const Log = (
  level: Log["level"],
  message: string
): Effect<void, Log> => perform({ _tag: "Log", level, message });

export const info = (msg: string) => Log("info", msg);
export const warn = (msg: string) => Log("warn", msg);
export const error = (msg: string) => Log("error", msg);

export const interpretLog = (
  sink: (level: string, message: string) => void = console.log
): Interpreter<Log> => (effect) => {
  if (effect._tag !== "Log") throw new Error("Not a Log effect");
  sink(effect.level, effect.message);
};
