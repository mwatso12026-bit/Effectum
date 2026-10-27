# Reify

**Local single-user sealed effect runtime for controlled, testable, auditable AI agents.**

You write pure programs. Effects are sealed, reified data. Interpreters are pure functions you compose. The trampoline is stack-safe. An LLM call is just another effect — no special privileges, no hidden I/O.

The MIT core is designed for **local, single-user downloads and execution**. Clone or install, run offline with mocks, no accounts, no multi-tenant, no external infrastructure required.

> **Open-core boundary (read this first)**  
> Everything under `src/` and `lean/` is **MIT and free forever** for commercial and personal use.  
> Hosted multi-tenant interpreters, managed background reconsolidation workers, team memory spaces, enterprise policy engines, and the web dashboard are **commercial** (Reify Cloud / Enterprise).  
> The MIT core has zero external infrastructure dependencies and runs fully offline on a single machine.

## Why this exists

Most agent runtimes are a pile of `await` spaghetti with side effects leaking everywhere. Reify flips the model:

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
- Basic effects: LLM (mock + hook), Log, State
- Local example agent that runs fully offline
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
type EffectRow = LLM | Log | State | ...;
```

### Reified Effects

Effects are values. You can inspect them, log them, serialize them, replay them.

### Composable Interpreters

Interpreters are just functions. Stack them, swap them, or replace them for tests.
Handlers throw `NotAnEffectError` for mismatches; real errors propagate.

```ts
const interpreter = compose(
  interpretLLM({ call: yourProvider }),  // OpenAI, Anthropic, local, whatever
  interpretLog(console),
  interpretState(initial)
);

run(program, interpreter);
```

Want to test without burning tokens? Drop in a mock:

```ts
const testInterpreter = compose(
  mockLLM(["canned response 1", "canned response 2"]),
  interpretLog(() => {}),
  interpretState(0)
);
```

Same program. Different interpreter. Zero changes to business logic.

### Trampoline

See `lean/Trampoline.lean`. The TypeScript runtime uses a trampoline for stack safety. The Lean model is a formal sketch; the full bind theorem is not yet complete.

### LLM as Effect

```ts
const answer = yield* LLM({
  messages: [{ role: "user", content: "Explain sealed effects" }],
  model: "gpt-4o"           // or claude, llama, grok, local — your interpreter decides
});
```

The effect is pure data. The model string is just a field. Your interpreter chooses the actual provider. No hard-coded vendor lock-in.

## Quick start (MIT core — local single-user)

```bash
git clone https://github.com/mwatso12026-bit/Reify.git
cd Reify
npm install
npm run build
npm run example   # offline mock agent
npm test          # local single-user tests
```

Or, once published:

```bash
npm install @reify/core
```

## Repo layout

```
src/
  effect.ts          # sealed effect algebra (MIT)
  trampoline.ts      # stack-safe evaluation (MIT)
  interpreter.ts     # composable interpreter machinery (MIT)
  effects/
    llm.ts           # LLM effect + mock + real interpreter hook (MIT)
    log.ts
    state.ts
  examples/
    agent.ts         # tiny local agent (MIT)
    agent.test.ts    # local single-user test (MIT)
lean/
  Trampoline.lean    # formal sketch of the trampoline (MIT)
```

## License

Core (`src/`, `lean/`, this repository as currently structured) is MIT.  
See LICENSE for details. Commercial features live outside this repository.
