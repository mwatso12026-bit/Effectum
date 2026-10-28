# Execution controls

`run(program, interpreter)` remains supported. Optional controls let callers bound work or cancel evaluation:

```js
import { run } from 'effectum';

const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30_000);
try {
  const result = await run(program, interpreter, {
    maxSteps: 10_000,
    signal: controller.signal
  });
} finally {
  clearTimeout(timer);
}
```

Each `Suspend` or `Impure` transition consumes one step. `Pure` consumes none. The runtime throws `ExecutionLimitError` before exceeding `maxSteps`, including before invoking a handler beyond the limit. Fuel must be a nonnegative safe integer. Without `maxSteps`, execution has no step limit.

Cancellation rejects with the signal's reason. No later program continuation runs, even if a pending handler eventually completes. The loop yields to the event loop every 256 transitions so timers can cancel long suspension chains.

Cancellation is cooperative. Already-started file writes or network requests are not undone or forcibly terminated. Pass the same signal to your provider/network implementation if it supports aborting requests. A thunk or handler that blocks JavaScript synchronously cannot be interrupted; isolate untrusted code in a separate process. These controls do not implement spending limits or approvals.

Only `run` accepts these options; the lower-level `runTrampoline` and `effectToTrampoline` helpers remain unchanged. The Lean model remains an incomplete sketch and does not verify these controls.

On Windows, fetch the branch, run `npm.cmd ci`, then `npm.cmd test`. Tests include fuel boundaries, infinite-chain cancellation, pending-handler cancellation, and existing persistence/MCP restart tests. No npm login, AI key, or paid model call is needed.
