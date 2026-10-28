/** Offline trace demo. Export contains metadata, never mock prompts or answers. */
import { writeFileSync } from "node:fs";
import { LLM, mockLLM } from "../effects/llm.js";
import { run } from "../interpreter.js";
import { withPolicy, PermissionDeniedError } from "../policy.js";
import { ExecutionTrace } from "../trace.js";

async function main() {
  const trace = new ExecutionTrace();
  const request = () => LLM({ messages: [{ role: "user", content: "Private demo prompt" }] });
  try {
    await run(request(), withPolicy(mockLLM([]), { rules: {}, trace }));
  } catch (error) {
    if (!(error instanceof PermissionDeniedError)) throw error;
  }
  await run(request(), withPolicy(mockLLM(["Private mock answer"]), {
    rules: { LLM: "approve" }, approve: () => true, trace,
  }));
  console.table(trace.snapshot().events.map(({ sequence, requestId, effectTag, stage }) =>
    ({ sequence, requestId, effectTag, stage })));
  const output = process.argv[2];
  if (output) {
    // Refuse to overwrite an existing file.
    writeFileSync(output, JSON.stringify(trace, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    console.log(`Trace exported to ${output}`);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
