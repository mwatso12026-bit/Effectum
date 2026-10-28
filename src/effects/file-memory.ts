/** Local JSON storage. Atomic replacement, previous-version backup, single writer. */
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { interpretMemory, type Memory, type MemoryNode } from "./memory.js";
import { NotAnEffectError, type Interpreter } from "../interpreter.js";

function decode(text: string): MemoryNode[] {
  const data = JSON.parse(text);
  if (data?.version !== 1 || !Array.isArray(data.nodes)) {
    throw new Error("Unsupported memory file: expected version 1 and nodes array");
  }
  const ids = new Set<string>();
  for (const n of data.nodes) {
    if (!n || typeof n.id !== "string" || !n.id || ids.has(n.id) ||
        typeof n.content !== "string" || !Number.isFinite(n.importance) ||
        !Number.isFinite(n.timestamp) ||
        (n.metadata !== undefined && (n.metadata === null || typeof n.metadata !== "object" || Array.isArray(n.metadata)))) {
      throw new Error("Invalid memory node or duplicate id");
    }
    ids.add(n.id);
  }
  return data.nodes;
}

function load(path: string): { text?: string; nodes: MemoryNode[] } {
  let text: string;
  try { text = readFileSync(path, "utf8"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { nodes: [] };
    throw error;
  }
  try { return { text, nodes: decode(text) }; }
  catch (error) {
    throw new Error(`Cannot read memory file ${path}. File preserved; restore a known-good backup before retrying.`, { cause: error });
  }
}

function atomicWrite(path: string, text: string): void {
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, text, { encoding: "utf8", mode: 0o600, flag: "wx", flush: true });
    renameSync(temp, path);
  } finally {
    try { unlinkSync(temp); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

/**
 * Opt-in disk interpreter; does not change interpretMemory().
 * JSON snapshots are reloaded per operation. Writes are queued per instance.
 * A lock file rejects overlapping writers from other instances/processes.
 * Files are plaintext and must reside on a local filesystem, not a network share.
 */
export function interpretFileMemory(filePath: string): Interpreter<Memory> {
  if (!filePath.trim()) throw new Error("Memory file path is required");
  const path = resolve(filePath);
  load(path); // Fail early on corrupt files; never silently reset stored data.
  let queue: Promise<unknown> = Promise.resolve();
  return (effect) => {
    if (!["MemoryWrite", "MemoryRead", "MemoryList", "MemorySearch"].includes(effect._tag)) {
      throw new NotAnEffectError();
    }
    const operation = async () => {
      let lock: number | undefined;
      try {
        if (effect._tag === "MemoryWrite") {
          mkdirSync(dirname(path), { recursive: true });
          try { lock = openSync(`${path}.lock`, "wx", 0o600); }
          catch (error) {
            if ((error as NodeJS.ErrnoException).code === "EEXIST") {
              throw new Error(`Memory file is locked: ${path}.lock. Stop other writers; remove stale locks only when no server is running.`);
            }
            throw error;
          }
        }
        const previous = load(path);
        const interpreter = interpretMemory();
        for (const node of previous.nodes) await interpreter({ _tag: "MemoryWrite", node });
        const result = await interpreter(effect);
        if (effect._tag === "MemoryWrite") {
          const nodes = await interpreter({ _tag: "MemoryList" });
          const text = JSON.stringify({ version: 1, nodes }, null, 2) + "\n";
          decode(text); // Reject invalid numbers and non-JSON values before replacing data.
          if (previous.text !== undefined) atomicWrite(`${path}.bak`, previous.text);
          atomicWrite(path, text);
        }
        return result;
      } finally {
        if (lock !== undefined) {
          closeSync(lock);
          unlinkSync(`${path}.lock`);
        }
      }
    };
    const result = queue.then(operation);
    queue = result.catch(() => undefined);
    return result;
  };
}
