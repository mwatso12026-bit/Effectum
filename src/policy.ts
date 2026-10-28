import type { Interpreter } from "./interpreter.js";
import { randomUUID } from "node:crypto";
import type { ExecutionTrace, TraceStage } from "./trace.js";

export type PolicyDecision = "allow" | "deny" | "approve";

export class PermissionDeniedError extends Error {
  constructor(readonly effectTag: string, message = `Permission denied for ${effectTag}`) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

export interface PolicyOptions<R extends { readonly _tag: string }> {
  /** Missing tags are denied. Rules are copied when the wrapper is created. */
  rules: Partial<Record<R["_tag"], PolicyDecision>>;
  /** Only literal true authorizes the exact immutable request supplied here. */
  approve?: (request: Readonly<R>) => boolean | Promise<boolean>;
  /** Pass the same signal to run() to cancel a pending approval promptly. */
  signal?: AbortSignal;
  /** Optional bounded metadata-only trace of this policy boundary. */
  trace?: ExecutionTrace;
}

function freezeRequest(value: unknown, seen = new WeakSet<object>()): void {
  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Policy requests must contain only plain objects and arrays");
  }
  for (const child of Object.values(value)) freezeRequest(child, seen);
  Object.freeze(value);
}

/**
 * Wrap the COMPLETE composed interpreter. Unlisted effects fail closed.
 * A cloned, frozen request is approved and executed to avoid payload changes
 * while approval is pending. This does not sandbox arbitrary JavaScript.
 */
export function withPolicy<R extends { readonly _tag: string }>(
  interpreter: Interpreter<R>,
  options: PolicyOptions<R>,
): Interpreter<R> {
  const rules = new Map(Object.entries(options.rules));
  for (const decision of rules.values()) {
    if (typeof decision !== "string" || !["allow", "deny", "approve"].includes(decision)) {
      throw new TypeError("Invalid policy decision");
    }
  }
  const { approve, signal, trace } = options;
  return async (effect) => {
    const requestId = randomUUID();
    const effectTag = effect._tag;
    let terminal = false;
    let started = false;
    const emit = (stage: TraceStage) => {
      if (terminal) return;
      trace?.record(requestId, effectTag, stage);
      terminal = ["completed", "failed", "denied", "cancelled"].includes(stage);
    };
    const abort = () => emit("cancelled");
    emit("requested");
    signal?.addEventListener("abort", abort, { once: true });
    try {
      signal?.throwIfAborted();
      const request = structuredClone(effect);
      freezeRequest(request);
      const decision = rules.get(request._tag) ?? "deny";
      if (decision === "deny") throw new PermissionDeniedError(request._tag);
      if (decision === "approve") {
        emit("approval_required");
        if (!approve || await approve(request) !== true) {
          throw new PermissionDeniedError(request._tag, `Approval required or declined for ${request._tag}`);
        }
        emit("approved");
      } else {
        emit("allowed");
      }
      signal?.throwIfAborted();
      started = true;
      emit("started");
      const result = await interpreter(request);
      signal?.throwIfAborted();
      emit("completed");
      return result;
    } catch (error) {
      emit(signal?.aborted ? "cancelled" : !started && error instanceof PermissionDeniedError ? "denied" : "failed");
      throw error;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  };
}
