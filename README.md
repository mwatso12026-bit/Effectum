<div align="center">

[![npm](https://img.shields.io/npm/v/@effectumcore/effectum?style=for-the-badge&label=%40effectumcore%2Feffectum&color=e11d2e&logo=npm)](https://www.npmjs.com/package/@effectumcore/effectum)
[![license: MIT](https://img.shields.io/badge/license-MIT-050505?style=for-the-badge&labelColor=e11d2e)](LICENSE)

<img src="docs/assets/hero-banner.png" width="100%" alt="Effectum — free MIT harness on npm; Effectum Pro at effectum-pro.com" />

</div>

<br />

> **This GitHub repo is the free product.** It exists so builders can install the MIT harness, try agents offline, and decide when they need **Effectum Pro** — sold only at **[effectum-pro.com](https://effectum-pro.com)** (not on npm, not in this repo).

**A local, single-user sealed effect runtime** — effects are data, interpreters are composable, LLM calls are ordinary effects. No hidden I/O.

<table>
<tr>
<td width="50%" valign="top">

### Free harness (this repo)

```bash
npm install @effectumcore/effectum
```

MIT forever · local MCP · mock agents · your API keys

[Quick start ↓](#quick-start)

</td>
<td width="50%" valign="top">

### Effectum Pro

**Parallel laws · Merkle audit · spot checks · local scheduler**

Paid download · execution stays on your machine

**[→ effectum-pro.com](https://effectum-pro.com)** — buy & download (Solo from $149/yr, launch **LAUNCH99**)

*Pro is how we monetize; this repo stays MIT.*

</td>
</tr>
</table>

<div align="center">
<img src="docs/assets/lava-divider.png" width="100%" alt="" />
</div>

### The agent problem

| Hidden actions | Broad permissions | Runaway calls | Weak verification |
| :--- | :--- | :--- | :--- |
| Side effects before review | Tool scope grows | Retries multiply cost | Final state hides drift |

**Effectum’s answer:** describe effects as values → **inspect** → interpret behind policy → **record**.

<div align="center">
<img src="docs/assets/lava-divider.png" width="100%" alt="" />
</div>

## Product line

| | **Effectum** (here) | **[Effectum Pro](https://effectum-pro.com)** | **Effectum Commercial** |
| :--- | :--- | :--- | :--- |
| License | MIT | Commercial | By agreement |
| Where it runs | Local, npm | Local download | Hosted / on-prem |
| Best for | Build & learn | Speed + proof on your machine | Multi-tenant, SLA |

> **Open-core promise:** `src/` and `lean/` stay MIT. Pro and Commercial are separate products (not in this repo).

<details>
<summary><strong>Effectum Commercial</strong> (hosted / enterprise — contact via effectum-pro.com)</summary>

- Evolved trampoline and managed interpreters  
- Multi-tenant memory, policy gateways, dashboard, SLA / on-prem  

</details>

---

## Why this exists

Most agent runtimes are a pile of `await` spaghetti with side effects leaking everywhere. Effectum flips the model:

- Effects are **data** (reified). You can inspect, log, serialize, and replay them.
- The algebra is **sealed**. You cannot invent new effects without extending the type.
- Interpreters are **composable**. Swap, stack, or mock them freely.
- Recursion is **trampolined**, so deep programs do not overflow the stack.
- An LLM call is **just another effect**, with no vendor lock-in.

If you are building agents that need to be testable and auditable, this is the foundation.

## What's in the free core

- Sealed effect algebra and reified effects
- Composable interpreter machinery (real errors propagate; only mismatches throw `NotAnEffectError`)
- Stack-safe trampoline (TypeScript), the baseline version; the trampoline has evolved in Effectum Commercial
- Built-in effects: LLM (mock and hook), Log, State, Memory (active reconsolidation on write, list, search)
- Local example agent that runs fully offline
- Local stdio MCP server
- Lean trampoline model (**partial sketch**; see [Verification status](#verification-status))

## Core ideas

### Sealed effect algebra

```ts
type Effect<
  A,
  R extends EffectRow = never
> = Pure<A> | Impure<R, A> | Suspend<() => Effect<A, R>>;

// The row is sealed. You only get the effects you declare.
type EffectRow = LLM | Log | State | Memory | ...;
```

### Composable interpreters

Interpreters are functions. Stack them, swap them, or replace them for tests.

```ts
const interpreter = compose(
  interpretLLM({ call: yourProvider }),  // OpenAI, Anthropic, local, whatever
  interpretLog(console),
  interpretState(initial),
  interpretMemory()
);

run(program, interpreter);
```

Test without spending tokens:

```ts
const testInterpreter = compose(
  mockLLM(["canned response 1", "canned response 2"]),
  interpretLog(() => {}),
  interpretState(0),
  interpretMemory()
);
```

Same program, different interpreter, zero changes to business logic.

### Trampoline

The TypeScript runtime in this repository uses a trampoline for stack safety (see `src/trampoline.ts`, with a formal sketch in `lean/Trampoline.lean`). This is the baseline version. The trampoline has since evolved in **Effectum Commercial**.

### LLM as an effect

```ts
const answer = yield* LLM({
  messages: [{ role: "user", content: "Explain sealed effects" }],
  model: "gpt-4o"   // your interpreter decides the actual provider
});
```

The effect is pure data. The model string is just a field.

## Quick start

```bash
git clone https://github.com/mwatso12026-bit/Effectum.git
cd Effectum
npm install
npm run build
npm run example   # offline mock agent
npm test          # local tests
npm run mcp       # local MCP server
```

Or install from npm:

```bash
npm install @effectumcore/effectum
```

## MCP server (local, single user)

A stdio MCP server is included. It uses a shared in-memory store, so writes persist across calls within one process.

| Tool | Purpose |
|---|---|
| `memory_write` | Write a node with active reconsolidation |
| `memory_read` | Read a node by id |
| `memory_list` | List all nodes |
| `memory_search` | Substring search on content or id |
| `state_get` / `state_set` | Agent step counter |
| `log` / `get_logs` | Append and retrieve recent logs |
| `run_mock_agent` | Offline agent using state, memory, and a mock LLM |
| `effect_trace` | Run a small program and return a reified step summary |
| `get_traces` | Return recent traces |

```bash
npm run mcp
```

Point Cursor, Claude Desktop, or any MCP client at the stdio process. No accounts and no network are required for the mock tools.

## Verification status

We try to be exact about what is and isn't proven:

| Component | Status |
|---|---|
| TypeScript trampoline (stack safety) | Implemented and tested (baseline version) |
| `lean/Trampoline.lean` | Formal **sketch**. The bind theorem is **not yet complete** |
| Everything else | Covered by tests, not by formal proof |

## Repo layout

```
src/
  effect.ts          # sealed effect algebra
  trampoline.ts      # stack-safe evaluation
  interpreter.ts     # composable interpreter machinery
  mcp.ts             # local MCP server
  effects/
    llm.ts           # LLM effect, mock, real-interpreter hook
    log.ts
    state.ts
    memory.ts        # active reconsolidation, list, search
  examples/
    agent.ts         # tiny local agent
    agent.test.ts    # local test
lean/
  Trampoline.lean    # formal sketch of the trampoline
```

## License

The contents of this repository (`src/`, `lean/`, and this README) are released under the [MIT License](LICENSE).

**Effectum Pro** and **Effectum Commercial** are separate proprietary products governed by their own licenses. See [effectum-pro.com](https://effectum-pro.com).
