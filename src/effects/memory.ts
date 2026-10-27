/**
 * Memory effect with active reconsolidation on write.
 * Local single-user only. In-memory store; no external DB.
 * Smart work happens on write (merge + importance average), not at query time.
 */

import { perform } from "../effect.js";
import type { Effect } from "../effect.js";
import type { Interpreter } from "../interpreter.js";
import { NotAnEffectError } from "../interpreter.js";

export interface MemoryNode {
  id: string;
  content: string;
  importance: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type MemoryWrite = {
  readonly _tag: "MemoryWrite";
  readonly node: MemoryNode;
};

export type MemoryRead = {
  readonly _tag: "MemoryRead";
  readonly id: string;
};

export type Memory = MemoryWrite | MemoryRead;

export const writeMemory = (node: MemoryNode): Effect<void, Memory> =>
  perform({ _tag: "MemoryWrite", node });

export const readMemory = (id: string): Effect<MemoryNode | null, Memory> =>
  perform({ _tag: "MemoryRead", id });

/**
 * In-memory interpreter with active reconsolidation on write.
 * On conflict (same id): content is replaced, importance is averaged,
 * timestamp is updated. Zero external dependencies.
 */
export const interpretMemory = (): Interpreter<Memory> => {
  const store = new Map<string, MemoryNode>();

  return (effect) => {
    if (effect._tag === "MemoryWrite") {
      const incoming = effect.node;
      const existing = store.get(incoming.id);
      if (existing) {
        // Active reconsolidation on write
        const merged: MemoryNode = {
          id: incoming.id,
          content: incoming.content,
          importance: (existing.importance + incoming.importance) / 2,
          timestamp: Math.max(existing.timestamp, incoming.timestamp),
          metadata: { ...existing.metadata, ...incoming.metadata },
        };
        store.set(incoming.id, merged);
      } else {
        store.set(incoming.id, incoming);
      }
      return undefined;
    }

    if (effect._tag === "MemoryRead") {
      return store.get(effect.id) ?? null;
    }

    throw new NotAnEffectError();
  };
};
