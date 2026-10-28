# Local permissions and approvals

`withPolicy` is a free local library feature. It wraps the complete interpreter and checks every effect request before dispatch:

```js
import { withPolicy, compose, mockLLM, interpretMemory, run } from 'effectum';

const controller = new AbortController();
const interpreter = withPolicy(
  compose(mockLLM(['Approved offline answer']), interpretMemory()),
  {
    rules: {
      LLM: 'approve',
      MemoryRead: 'allow',
      MemoryWrite: 'deny'
    },
    signal: controller.signal,
    approve: async request => {
      // Replace this with a trusted application approval flow.
      // Returning false declines. Only literal true grants approval.
      return false;
    }
  }
);

// await run(program, interpreter, { signal: controller.signal, maxSteps: 1000 });
```

Rules support `allow`, `deny`, or `approve`. Missing tags are denied. An `approve` rule without an approval callback is denied. Approval is requested separately on every invocation; no approvals are cached. Errors from the callback or handler propagate. Rule configuration is copied when the wrapper is created: create a new wrapper to change it.

The request is cloned and deeply frozen before approval. The handler receives the same snapshot the callback reviewed, so changing the original messages while waiting cannot change the approved action. Request payloads must be structured-cloneable plain objects/arrays, with no functions or special object types such as Map or Date. Existing core effect payloads are supported when their metadata meets these requirements.

Pass the SAME AbortSignal to both `withPolicy` and `run`. `run` stops waiting promptly; the policy wrapper checks cancellation again after approval and will not dispatch a late-approved action. Cancellation does not undo an already-started action. An approval integration that never resolves should also provide its own timeout or cancellation handling.

Wrap the entire composed interpreter. If you leave another execution path unwrapped, this policy does not govern that path. Thunks, callbacks, and arbitrary JavaScript can perform I/O outside the effect system: this is not a sandbox. Rules are per effect tag; applications needing payload-specific decisions must validate the approved request in their trusted approval callback or handler. This feature does not add accounts, enterprise roles, budget enforcement, audit storage, or an MCP approval interface. The MCP server's existing tools are unchanged.

## Offline demo on Windows

After fetching the branch in GitHub Desktop and opening the checkout in VS Code:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run build
node .\dist\examples\permissions.js
```

Expected output includes a blocked request, an explicit demo approval, and a mock answer. The demo approval callback intentionally returns true to illustrate the mechanism; it is not a human approval interface. No account, API key, network AI request, or charge is needed to run the demo after dependencies are installed.
