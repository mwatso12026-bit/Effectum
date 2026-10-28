import { randomUUID } from "node:crypto";

export type TraceStage = "requested" | "allowed" | "approval_required" | "approved" |
  "denied" | "started" | "completed" | "failed" | "cancelled";

export interface TraceEvent {
  readonly sequence: number;
  readonly timestamp: number;
  readonly traceId: string;
  readonly requestId: string;
  readonly effectTag: string;
  readonly stage: TraceStage;
}

/** Bounded, metadata-only local trace. No request payloads, results or error text. */
export class ExecutionTrace {
  readonly traceId = randomUUID();
  private events: TraceEvent[] = [];
  private sequence = 0;
  private dropped = 0;

  constructor(readonly capacity = 1000) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) {
      throw new RangeError("Trace capacity must be a positive safe integer");
    }
  }

  record(requestId: string, effectTag: string, stage: TraceStage): void {
    const event = Object.freeze({ sequence: ++this.sequence, timestamp: Date.now(),
      traceId: this.traceId, requestId, effectTag, stage });
    if (this.events.length >= this.capacity) {
      this.events.shift();
      this.dropped++;
    }
    this.events.push(event);
  }

  snapshot(): { version: 1; traceId: string; dropped: number; events: TraceEvent[] } {
    return { version: 1, traceId: this.traceId, dropped: this.dropped, events: this.events.slice() };
  }

  toJSON(): ReturnType<ExecutionTrace["snapshot"]> { return this.snapshot(); }
}
