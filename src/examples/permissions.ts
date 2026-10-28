/** Offline demo: one blocked AI request, followed by one explicitly approved mock. */
import { LLM, mockLLM } from "../effects/llm.js";
import { run } from "../interpreter.js";
import { PermissionDeniedError, withPolicy } from "../policy.js";

async function main() {
  const request = () => LLM({ messages: [{ role: "user", content: "Summarize this local demo" }] });
  try {
    await run(request(), withPolicy(mockLLM(["Must not execute"]), { rules: {} }));
  } catch (error) {
    if (!(error instanceof PermissionDeniedError)) throw error;
    console.log(`BLOCKED: ${error.message}`);
  }
  const interpreter = withPolicy(mockLLM(["Approved mock response; no paid AI call was made."]), {
    rules: { LLM: "approve" },
    approve: effect => {
      console.log(`APPROVAL: demo application approves ${effect._tag} with ${effect.messages.length} message(s).`);
      return true; // Demo only. Production applications supply a real approval flow.
    },
  });
  console.log(await run(request(), interpreter, { maxSteps: 10 }));
}

main().catch(error => { console.error(error); process.exitCode = 1; });
