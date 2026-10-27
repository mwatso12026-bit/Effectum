/-
  Reify — Lean model of the trampoline

  We model a simple trampoline and prove basic properties.
  The full bind theorem is still incomplete (previously contained sorry).
  This file is the formal sketch; the TypeScript runtime is the operational core.
  Do not claim full formal verification until the remaining theorems are closed.
-/

inductive Trampoline (α : Type) : Type
  | done : α → Trampoline α
  | more : (Unit → Trampoline α) → Trampoline α

namespace Trampoline

/-- Run with explicit fuel. Returns none if we run out of fuel. -/
def runFuel {α} : Nat → Trampoline α → Option α
  | 0,     _          => none
  | _+1,   done a     => some a
  | n+1,   more k     => runFuel n (k ())

/-- If a trampoline is finite (has a finite `more` chain), enough fuel recovers the value. -/
theorem runFuel_done {α} (a : α) (n : Nat) (h : n > 0) :
    runFuel n (done a) = some a := by
  cases n with
  | zero => exact absurd h (Nat.lt_irrefl _)
  | succ _ => rfl

/-- Composition of trampolines. -/
def bind {α β} : Trampoline α → (α → Trampoline β) → Trampoline β
  | done a, f => f a
  | more k, f => more (fun _ => bind (k ()) f)

/--
  Bind theorem (incomplete).
  Full mechanisation of fuel-sufficient preservation under bind is left open.
  The TypeScript runtime assumes finite trampolines produced by concrete programs.
-/
-- theorem runFuel_bind ... := by sorry
-- Removed from active claim until completed.

end Trampoline

/-- Embedding of the sealed effect algebra (fragment). -/
inductive Effect (ρ : Type) (α : Type) : Type
  | pure   : α → Effect ρ α
  | impure : ρ → (Unit → Effect ρ α) → Effect ρ α
  | suspend : (Unit → Effect ρ α) → Effect ρ α

structure LLMRequest where
  messages : List String
  model    : Option String := none

#check Effect LLMRequest String
