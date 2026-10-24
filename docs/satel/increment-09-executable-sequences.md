# Increment 9: executable symbolic sequences

Equation-based intentions now choose their representatives using the entire APN
pair sequence. Constructor/operation unfolding still defines the algebraic
classes; APN execution constrains which representative can realize a class's
declared sequence. The APN does not supply or rewrite the expected observations.

## Review on a laptop

Use branch `codex/satel-public-methods`. In `petri-net-app`, run `npm install`
and `npm run dev`, then open the local URL printed by Vite.

1. Load **Examples → SATEL Whole-sequence selection — Reference**.
2. Open **SATEL → Intentions** to inspect the two equation classes and sequences.
3. Open **Generated tests → Generate tests**. Expect **2/2** reference passes,
   two executable classes, no blocked classes and no unresolved searches.
4. Initial balance is 10. The zero class calls `withdraw(0)`, `withdraw(10)`,
   `query()`. The positive class calls `withdraw(3)`, `withdraw(7)`, `query()`.
   Both finish with an observed balance of 0. The previous static positive
   representative was 1; it cannot satisfy the complete sequence.
5. Expand **Execution details → Marking after pair** to see state propagation.
   Input occurrence positions refer to each place's tokens before that firing.
6. Close SATEL and load **SATEL Whole-sequence selection — Mutant: no debit**.
   Open **Replay results** and replay the frozen suite without regenerating it.
   Expect **0 passed, 2 failed, 0 errors**.

The existing Account, Compound guard and Typed store examples use the same new
selection pipeline. Explicit finite values and explicit uniformity representatives
in ordinary intentions remain fixed; this increment does not reinterpret them as
free symbolic variables. Advanced **Derive classes without executing the APN**
still performs algebra-only analysis.

## Execution and selection contract

* Begin with exactly the model's initial token multisets. No token injection or
  per-pair marking reset is allowed.
* Enumerate public method rules and distinct available input token occurrences.
  Multiple input arcs cannot consume the same occurrence. Repeated input variable
  names, including names shared with method parameters, produce equality constraints.
* Instantiate the rule guard and output expressions symbolically. Remove consumed
  occurrences and carry the resulting symbolic marking into the following pair.
  Local method names and intention variable names have separate substitution scopes.
* Conjoin the algebraic class, intention conditions, parameter range checks, all
  step guards and expected output-multiset equalities. Multiset matching respects
  multiplicity and permits different token orders.
* Prefer the existing class witness **only if it satisfies the whole path**. If
  it does not, release that preference and solve the joint path constraints with
  the existing equation unfolding and Z3 connection. In particular, a later guard
  or observation can constrain an earlier parameter.
* Select one feasible representative per completed algebraic class. This is an
  existential positive selection policy, not enumeration of all paths. Once a
  feasible representative is found, other paths in the same class need not be solved.
* Admit a suite only after every selected concrete sequence passes independent
  reference execution. Replay freezes stimuli and expected observations. A
  nondeterministic call, malformed model or evaluation error prevents admission.

The simulator and symbolic executor share `compileMethodRule`, so arc validation,
variable sorts, guard compilation and output compilation use the same rules.
Concrete execution still independently checks enabledness, values and observations.
The saved suite contains selection evidence, required-pair assertions, chosen rule
IDs and token occurrences; rule identity is diagnostic, never the public oracle.

## Bounds and failure reporting

Defaults: 32 pairs, 10,000 sequence search nodes (including token and observation
matching), a 20-second sequence selection budget, and 32 equation-unfolding steps
per path solve. Existing SMT timeout and equation branch limits also apply.
These are implementation bounds, not mathematical exhaustiveness claims.

The GUI separates executable classes, blocked classes and unresolved searches.
“Blocked” means no complete required sequence was found after resolving the
searched class's alternatives, including observations; it does not necessarily
mean that its first call is disabled. Unsupported terms, timeouts and unexplored
frontiers are unresolved, never evidence of impossibility or negative tests.
For this increment, a blocked class prevents admission of a partial suite; the
user must review the intention/model mismatch instead of silently losing coverage.

Supported runtime values remain Nat/Int (32-bit), Bool, String, List and Pair;
custom algebraic constructors may organize selection and map to those method
values. Symbolic recursive operations remain bounded. A finite known witness can
avoid unfolding an arbitrary tail, but a free recursive search can still be
unresolved. Concrete admission catches runtime restrictions not fully represented
in the constraints (for example overflow in an intermediate arithmetic expression
or oversized nested values); it does not silently retry after a runtime error.

Public-method-only nets, synchronous calls, unit-multiplicity arcs and the existing
deterministic runtime fragment remain required. Several unit arcs can consume
several token occurrences. No internal-transition exploration, full CO-OPN
synchronization, symbolic post-marking assertion syntax or exhaustive state-space
construction is added here. Observations in these protocols describe the tokens
produced by each firing; full resulting markings are available as execution details.

## Negative tests remain a separate extension

The path planner currently accepts only `required` assertions. Selection evidence
records assertion kinds explicitly. A later planner can implement a required
prefix followed by a forbidden final observation, with its own quantification
over all possible final firings. It must not invert “no selected witness”, a
failed prefix or an unresolved solver result. No negative generator or new
negative verdict behavior is implemented in this increment.
