# Local execution traces

Tracing is an opt-in free library feature at the policy boundary. It records effect tags and lifecycle metadata, without prompts, memory contents, outputs, approval text, or error messages.

```js
import { ExecutionTrace, withPolicy, mockLLM, LLM, run } from 'effectum';
import { writeFileSync } from 'node:fs';

const trace = new ExecutionTrace(1000);
const interpreter = withPolicy(mockLLM(['Offline answer']), {
  rules: { LLM: 'approve' },
  approve: async () => true, // Replace with your trusted application's approval flow.
  trace
});
await run(LLM({ messages: [{ role: 'user', content: 'Hello' }] }), interpreter);
console.table(trace.snapshot().events);
writeFileSync('trace.json', JSON.stringify(trace, null, 2), { flag: 'wx', mode: 0o600 });
```

Create a new recorder per run if you want each run isolated. A shared recorder can combine calls, which receive unique request IDs. Each event includes a trace ID, request ID, increasing sequence, wall-clock timestamp, effect tag, and stage:

| Stage | Meaning |
| --- | --- |
| `requested` | A request reached the wrapped policy boundary. |
| `allowed` | Its rule allowed dispatch without an approval callback. |
| `approval_required` | The rule requires explicit approval. |
| `approved` | The callback returned literal true. |
| `denied` | Permission was missing, denied, or approval was absent/declined. |
| `started` | The interpreter is about to be invoked. |
| `completed` | The interpreter returned successfully. |
| `failed` | Request preparation, approval, or the interpreter failed. |
| `cancelled` | The shared signal was aborted before this request finished. |

For cancellation, pass the same signal to `run` and `withPolicy`. A cancellation event stops further events for that request; it does not claim a pending handler's external I/O was stopped or rolled back. Late completion/approval does not become a successful trace event.

Recorders retain the most recent 1000 events by default. A custom capacity must be a positive safe integer. Export includes `version: 1` and a `dropped` count, so truncation is visible; older events may be missing. Snapshot arrays are copies, and individual events are immutable. Traces are in RAM until you explicitly export them.

Use fixed effect tags, not sensitive data in tag names: tags themselves are included. Traces do not capture JavaScript outside the policy boundary, pure/suspension steps, whole-run fuel exhaustion, or arbitrary MCP calls. No MCP trace tools or dashboard are added here. Exported JSON is diagnostic data, not cryptographically signed evidence, a tamper-proof audit log, or replayable execution.

## Windows offline demo

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
node .\dist\examples\traces.js
node .\dist\examples\traces.js .\reify-trace.json
```

The demo shows one denied request and one explicitly demo-approved mock request. The second command exports metadata to a new JSON file; it refuses to overwrite an existing file. Open that file in VS Code. No AI keys or paid calls are used. The displayed IDs and timestamps vary on each run.
