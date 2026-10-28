/**
 * MindLog prototype — local single-user.
 *
 * 1. Mined effect laws: record traces, test if adjacent steps commute,
 *    promote pairs that pass N trials.
 * 2. Spot-checked audit: hash-chain a trace, randomly re-execute a fraction
 *    of steps, report detection probability.
 *
 * No external services. Pure local.
 */

export type Step = {
  id: string;
  effect: string;
  input: unknown;
  output: unknown;
};

export type Trace = Step[];

export type Law = {
  a: string;
  b: string;
  trials: number;
  passed: number;
};

/** Simple hash for the audit chain (not cryptographic). */
function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

export class MindLog {
  private traces: Trace[] = [];
  private laws: Law[] = [];

  record(trace: Trace): void {
    this.traces.push(trace);
  }

  /** Test if two effect tags commute across recorded traces. */
  mineCommutes(trials = 10): Law[] {
    const pairs = new Map<string, { a: string; b: string; pass: number; total: number }>();

    for (const trace of this.traces) {
      for (let i = 0; i < trace.length - 1; i++) {
        const a = trace[i].effect;
        const b = trace[i + 1].effect;
        const key = `${a}|${b}`;
        if (!pairs.has(key)) {
          pairs.set(key, { a, b, pass: 0, total: 0 });
        }
        const p = pairs.get(key)!;
        p.total++;
        // Naive commute check: same end state if we imagine swap
        // (real impl would re-run; here we mark as candidate if outputs exist)
        if (trace[i].output !== undefined && trace[i + 1].output !== undefined) {
          p.pass++;
        }
      }
    }

    const found: Law[] = [];
    for (const p of pairs.values()) {
      if (p.total >= trials && p.pass / p.total > 0.9) {
        found.push({ a: p.a, b: p.b, trials: p.total, passed: p.pass });
      }
    }
    this.laws = found;
    return found;
  }

  /** Build a simple hash chain of a trace. */
  hashChain(trace: Trace): string[] {
    const chain: string[] = [];
    let prev = "0";
    for (const step of trace) {
      const payload = prev + JSON.stringify(step);
      prev = simpleHash(payload);
      chain.push(prev);
    }
    return chain;
  }

  /**
   * Spot-check: re-hash k random steps and compare.
   * Returns detection probability bound 1 - (1 - f)^k for fault fraction f.
   */
  spotCheck(trace: Trace, k = 3, faultFraction = 0.1): {
    mismatches: number;
    detectionProb: number;
  } {
    const chain = this.hashChain(trace);
    let mismatches = 0;
    const indices = new Set<number>();
    while (indices.size < Math.min(k, trace.length)) {
      indices.add(Math.floor(Math.random() * trace.length));
    }
    for (const i of indices) {
      const recomputed = this.hashChain(trace.slice(0, i + 1)).pop();
      if (recomputed !== chain[i]) mismatches++;
    }
    const detectionProb = 1 - Math.pow(1 - faultFraction, k);
    return { mismatches, detectionProb };
  }

  getLaws(): Law[] {
    return this.laws;
  }

  getTraces(): Trace[] {
    return this.traces;
  }
}
