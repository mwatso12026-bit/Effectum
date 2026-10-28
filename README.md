# Effectum

**Local single-user sealed effect runtime for controlled, testable, auditable AI agents.**

You describe programs using explicit effect requests. Interpreters handle those requests and can perform I/O. An LLM call is another effect request, routed through the interpreter you supply. This is an application architecture, not a sandbox for untrusted JavaScript.

The MIT core is designed for **local, single-user downloads and execution**. Clone or install, run offline with mocks, no accounts, no multi-tenant, no external infrastructure required.

> **Open-core boundary (read this first)**  
> Everything under `src/` and `lean/` is **MIT and free forever** for commercial and personal use.  
> Hosted multi-tenant interpreters, managed background reconsolidation workers, team memory spaces, enterprise policy engines, and the web dashboard are **commercial** (Effectum Cloud / Enterprise).  
> The MIT core has zero external infrastructure dependencies and runs fully offline on a single machine.

## Why this exists

Most agent runtimes are a pile of `await` spaghetti with side effects leaking everywhere. Effectum flips the model:

- Effects are **data** (reified).
- The algebra is **sealed** — you cannot invent new effects without extending the type.
- Interpreters are **composable** — swap, stack, or mock them at will.
- Recursion is **trampolined** (Lean formalization is a sketch; the bind theorem remains incomplete).
- An LLM call is just another effect. Treat it like any other effect.

If you’re building agents that need to be auditable, testable, and not a ticking stack-overflow bomb, this is the foundation.

## What is free (MIT core — local single-user)

- Sealed effect algebra and reified effects
- Composable interpreter machinery (real errors are no longer masked)
- Stack-safe trampoline (TypeScript implementation)
- Basic effects: LLM (mock + hook), Log, State, Memory (active reconsolidation on write, list, search)
- Local example agent that runs fully offline
- Advanced MCP server (stdio, local single-user tools)
- Lean trampoline model (partial / sketch)

## What is commercial

- Managed cloud interpreters and provider routing
- Automated background reconsolidation / memory workers
- Multi-tenant Postgres adapter and team spaces
- Policy / approval gateways with audit logs
- Web dashboard for effect traces and memory graphs
- Enterprise SLA, on-prem, and custom connectors

## Core ideas

### Sealed Effect Algebra

```ts
type Effect<
  A,
  R extends EffectRow = never
> = Pure<A> | Impure<R, A> | Suspend<() => Effect<A, R>>;

// The row is sealed. You only get the effects you declare.
type EffectRow = LLM | Log | State | Memory | ...;
```

### Reified Effects

Effect requests are values you can inspect and log. JSON-compatible request payloads can be serialized; complete programs contain functions and cannot be serialized directly. Durable execution and deterministic replay are not implemented.

### Composable Interpreters

Interpreters are just functions. Stack them, swap them, or replace them for tests.
Handlers throw `NotAnEffectError` for mismatches; real errors propagate.

```ts
const interpreter = composeMany(
  interpretLLM({ call: yourProvider }),  // OpenAI, Anthropic, local, whatever
  interpretLog((level, message) => console.log(`[${level}] ${message}`)),
  interpretState(initial),
  interpretMemory()
);

run(program, interpreter);
```

Want to test without burning tokens? Drop in a mock:

```ts
const testInterpreter = composeMany(
  mockLLM(["canned response 1", "canned response 2"]),
  interpretLog(() => {}),
  interpretState(0),
  interpretMemory()
);
```

Same program. Different interpreter. Zero changes to business logic.

### Trampoline

See `lean/Trampoline.lean`. The TypeScript runtime uses a trampoline for stack safety. The Lean model is a formal sketch; the full bind theorem is not yet complete.

### LLM as Effect

```ts
// Inside gen(function* () { ... }), use yield rather than yield*.
const answer = yield LLM({
  messages: [{ role: "user", content: "Explain sealed effects" }],
  model: "gpt-4o"           // or claude, llama, grok, local — your interpreter decides
});
```

The effect is pure data. The model string is just a field. Your interpreter chooses the actual provider. No hard-coded vendor lock-in.

## MCP server (local single-user)

A stdio MCP server is included. Shared in-memory store so writes persist across calls in one process. Memory, state, and logs are lost when the process exits; there is no disk persistence yet.

Tools:

- `memory_write` — write a node with active reconsolidation
- `memory_read` — read a node by id
- `memory_list` — list all nodes
- `memory_search` — substring search on content or id
- `state_get` / `state_set` — agent step counter
- `log` / `get_logs` — append and retrieve recent logs

```bash
npm install
npm run mcp
```

Point Cursor, Claude Desktop, or any MCP client at the stdio process. After building, launch it with `node dist/mcp.js` so npm build output does not enter the MCP protocol stream. No accounts or network are required for these local tools.

## Quick start (MIT core — local single-user)

```bash
git clone https://github.com/mwatso12026-bit/Effectum.git
cd Effectum
npm ci
npm run build
npm run example   # offline mock agent
npm test          # local single-user tests
npm run mcp       # local MCP server
```

For an available npm release:

```bash
npm install effectum
```

The source checkout can also produce an installable package without npm login: `npm pack`. Packaging builds the JavaScript automatically. The package includes an `effectum-mcp` command for the local MCP server.

See [Windows local testing](docs/windows-local-testing.md) for GitHub Desktop, VS Code, package installation, and MCP configuration.

## Repo layout

```
src/
  effect.ts          # sealed effect algebra (MIT)
  trampoline.ts      # stack-safe evaluation (MIT)
  interpreter.ts     # composable interpreter machinery (MIT)
  mcp.ts             # local MCP server with advanced tools (MIT)
  effects/
    llm.ts           # LLM effect + mock + real interpreter hook (MIT)
    log.ts
    state.ts
    memory.ts        # active reconsolidation + list + search (MIT)
  examples/
    agent.ts         # tiny local agent (MIT)
    agent.test.ts    # local single-user test (MIT)
lean/
  Trampoline.lean    # formal sketch of the trampoline (MIT)
```

## License

Core (`src/`, `lean/`, this repository as currently structured) is MIT.  
See LICENSE for details. Commercial features live outside this repository.

