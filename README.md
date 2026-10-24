# Reify

**A runtime with a sealed effect algebra that emits reified effects through composable interpreters and a Lean-verified trampoline where an LLM call is a possible effect.**

You write pure programs. Effects are sealed, reified data. Interpreters are pure functions you compose. The trampoline is stack-safe and formally verified in Lean. Calling an LLM is just another effect — no special snowflake status, no hidden I/O, no “trust me bro”.

## Why this exists

Most “AI agent” runtimes are a pile of `await` spaghetti with side effects leaking everywhere. Reify flips the model:

- Effects are **data** (reified).
- The algebra is **sealed** — you cannot invent new effects without extending the type.
- Interpreters are **composable** — swap, stack, or mock them at will.
- Recursion is **trampolined** and the trampoline is **Lean-verified**.
- An LLM call is just `Effect.LLM(...)`. Treat it like any other effect.

If you’re building agents that need to be auditable, testable, and not a ticking stack-overflow bomb, this is the foundation.

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

```ts
const interpreter = compose(
  interpretLLM({ model: "grok" }),
  interpretLog(console),
  interpretState(initial)
);

run(program, interpreter);
```

### Lean-verified Trampoline

See `lean/Trampoline.lean`. The stack-safety theorem is proven. No more “it works on my machine until the call stack dies”.

### LLM as Effect

```ts
const answer = yield* LLM({
  messages: [{ role: "user", content: "Explain sealed effects" }],
  model: "grok-4"
});
```

That’s it. No hidden network calls in your business logic.

## Quick start

```bash
npm install
npm run build
npm run example
```

## Repo layout

```
src/
  effect.ts          # sealed effect algebra + free-ish construction
  trampoline.ts      # stack-safe evaluation
  interpreter.ts     # composable interpreter machinery
  effects/
    llm.ts           # LLM effect + default interpreter
    log.ts
    state.ts
  examples/
    agent.ts         # tiny agent that uses LLM + Log + State
lean/
  Trampoline.lean    # formal verification of the trampoline
```

## License

MIT
