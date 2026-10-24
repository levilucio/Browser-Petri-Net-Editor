# Increment 5: editable equation intentions and Z3-backed subuniformity

Branch: `codex/satel-public-methods` (stacked PR #4). This extends the public-method increment without changing its initial-marking or synchronous-call semantics.

## What to review on a laptop

```sh
git fetch origin
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm install
npm run dev
```

Open the localhost URL printed by Vite. Use the dev server so the existing Z3 WASM assets and cross-origin isolation headers are available.

### Account: definitions, derivation, admission and mutation replay

1. Load **Examples → SATEL Account — Reference**.
2. Open **SATEL → Intentions**. Both refined and coarse account intentions are now present and editable. They are model-owned data, saved in the existing PNML SATEL extension.
3. Edit **Account — less / equal / greater**. Inspect the constructor declarations, operation equations, goal `withdraw(10, request)`, and declarative pair protocol. Save it.
4. Choose **Derive / validate**, then **Derive classes without executing the APN**. Expect four feasible classes, three infeasible equation branches and no unresolved branches. Candidate pairs are visible but are explicitly not oracle-validated yet.
5. Choose **Validate derived pairs on loaded reference**. Expect 4/4 passed. Alternatively, **Generate and validate on loaded reference** performs both stages in order.
6. Close SATEL, load the `reject-exact-balance` account mutant, and replay the frozen suite. Expect three passed, one failed, no errors. The other supplied mutants are still detected by the refined suite.
7. Reload the reference and select **Account — affordable / unaffordable**: three classes; its suite misses the exact-balance mutant. Selection now chooses a saved intention, not a hidden hardcoded equation regime.
8. Edit the refined goal arguments from `10, request` to `25, request`, save and derive again. The protocol supplies `deposit(25)` and the equality-class call is `withdraw(25)`. Validate the resulting pairs. The model's initial balance remains zero throughout this change.

The equations and the protocol are separate declarations: equations determine symbolic classes and expected algebraic results; the protocol maps constructor inputs/results to public calls and output tokens. Every oracle candidate has equation-derived expectations before the APN executes. Failed reference admission is not automatically reclassified as a negative test.

### Recursive List: completed cases and visible frontier

1. Load **Examples → SATEL List — Symbolic membership classes**.
2. Derive classes. Budget 2 gives four completed, pairwise disjoint classes and one residual branch:
   - `member(x, Nil())` → false;
   - `member(x, Cons(y, ys))`, `x == y` → true;
   - `member(x, Cons(y, Nil()))`, `x != y` → false;
   - `member(x, Cons(y, Cons(z, zs)))`, `x != y and x == z` → true;
   - `member(x, Cons(y, Cons(z, zs)))`, `x != y and x != z` → residual `member(x, zs)`.
3. In Intentions, change **Unfolding budget** to 3. Save and derive again: six completed classes and one residual branch.
4. Inspect symbolic patterns, constraints, equation paths and concrete witnesses. Distinct fresh variables have numeric subscripts so recursive scopes remain distinguishable.

The list example intentionally declares **no APN method protocol or executable net**. It demonstrates symbolic selection across a recursive datatype. Its witnesses are not presented as oracle-validated APN tests. Supporting list-valued method parameters and arcs would require a separate simulator increment.

## Reusing the existing Z3 connection

`SymbolicZ3.js` imports the existing `utils/z3/context.js` initialization, with no new dependency or separate Z3 installation. It uses `ctx.Solver` directly. The existing convenience equation solver synthesizes fallback solutions in some cases, so it is unsuitable for proving class feasibility and is not used here.

- Free constructors become Z3 algebraic datatypes, including mutual recursion.
- Bool is Boolean; Nat and Int use mathematical integers. Nat nonnegativity is enforced both on variables and recursively inside datatype fields.
- Equations are unfolded by our symbolic engine; they are **not** asserted as unrestricted universal axioms in Z3.
- Residual structural equality/disequality and multivariate linear `+`/`-` comparisons go to Z3.
- `sat` supplies a model; decoded witnesses are checked independently for sorts and residual constraints. Numeric 1 is preferred jointly when feasible. Otherwise a Z3 model is used. This is witness selection, not partition discovery or random sampling.
- `unsat` produces an infeasible branch. `unknown`, timeout, oversized/inexact witnesses and unsupported residuals remain unresolved. There is no fallback witness.
- Pairwise intersections are checked with freshly renamed variables. Overlap or an unresolved overlap check blocks suite admission; the engine does not automatically disjointify overlapping definitions.

The default limits are 3 seconds per solver check, a 20-second derivation scheduling budget after Z3 initialization (checked between branches and overlap queries), 256 attempted equation branches, and the intention's 1–32 equation-application budget per path. Budget exhaustion stays in the report. The unfolding budget does not bound the size of all constructor values belonging to a symbolic class.

## Editable definitions and protocol

A symbolic intention stores `kind: "symbolic"` and `symbolic` source/goal/protocol fields in `testIntentions`. The editor uses readable text, not raw term JSON. Definitions and equations each occupy one line; `#` starts a comment line.

```text
constructor Nil() : NatList
constructor Cons(Nat, NatList) : NatList
operation member(Nat, NatList) : Bool
rule member.nil(x: Nat): member(x, Nil()) = false
rule member.head(x: Nat, y: Nat, ys: NatList): member(x, Cons(y, ys)) = true if x == y
rule member.tail(x: Nat, y: Nat, ys: NatList): member(x, Cons(y, ys)) = member(x, ys) if x != y
```

The goal supplies an operation, typed variables, argument terms, optional explicit constraints and an unfolding budget. All free goal variables participate in the symbolic domain. Concrete arguments remain fixed; this path does not silently assign additional legacy uniformity/regularity policies.

**Import custom editor ADT XML** imports explicit constructor/operation signatures and oriented axioms from custom model definitions or the ADT registry. Both `<type>`/`<param>` and `<adt>`/`<parameter>` declarations are recognized. It preserves parameter types and infers equation variable sorts from patterns. Missing signatures, overloaded names, malformed XML and non-oriented/quotient axioms are reported rather than ignored. This is an explicit copy into the saved intention, not a live synchronization with the ADT registry.

A protocol case binds input and result patterns, then declares a pair sequence:

```text
case paid(b: Nat, n: Nat, remaining: Nat, paid: Nat):
inputs b, Amount(n)
result Result(remaining, Paid(paid))
pair deposit(n=b) => ack(1)
pair withdraw(n=n) => ack(1), paidAmount(paid)
pair query() => balanceResult(remaining)
```

Exactly one case must match each selected witness. Method parameters are named. The right side lists tokens **produced by that call**, not the accumulated marking. Unmentioned public output places have an expected empty output multiset; `none` expresses no output events. The current oracle adapter still accepts singleton/empty Nat public outputs and numeric public methods. Richer observable values require a later adapter increment.

Saved reports retain their source snapshot. Editing/loading displays a stale-snapshot notice. A new derivation explicitly replaces the old report/suite. Target replay never re-derives expectations.

## Scope and assumptions

This is a generic engine for an explicit **supported equational fragment**, not an implementation for every possible ADT specification:

- Monomorphic free constructors and structural equality, Bool/Nat/Int, typed constructor patterns and positive conditional defining equations.
- Calls can occur inside arguments, conditions and results. Nested calls unfold before their enclosing call. Recursion is bounded in the derivation, not solved by induction.
- No quotient constructors, associative/commutative rewriting, polymorphic sorts, quantifiers, arbitrary JavaScript operations, multiplication/division, or general satisfiability procedure for arbitrary algebraic specifications.
- No proof of exhaustive coverage, confluence, totality or termination. Even with a resolved frontier and disjoint completed classes, the GUI explicitly states that coverage is not proved. A witness does not prove uniform fault behavior throughout its class.
- APN guards are **not automatically translated into a multi-step symbolic goal**. The equation conditions and explicit goal constraints are used. Reachability, method-rule guards and the model's actual initial marking are checked later by the APN oracle.
- Public-method simulation remains the Nat/Int fragment described in increment 4. Its executable range remains 32-bit; symbolic mathematical integers outside that range cannot be admitted through this adapter. JavaScript-inexact model integers are reported unresolved.
- Existing ordinary pair intentions retain their prior generation path. They are visibly separate from symbolic equation intentions. The older interval-based account CLI remains a compatibility demonstration; the GUI symbolic workflow uses the new engine.

## Verification

Real-Z3 tests cover account refinement and all four mutants, recursive/mutually recursive datatypes, structural equality, multivariate constraints, nested calls, contradictions, overlapping definitions, unknown/budget outcomes, strict source parsing and declarative protocol matching. GUI tests cover invalid draft preservation, custom XML import, PNML round trips, source editing and stale reports.

Desktop and mobile browser checks exercise the real WASM-backed Z3 connection, editable account and list intentions, separate derivation/admission, changed account setup, PNML save/load, mutation replay and readable instantiated pairs. Existing public-method calls and place-based observation editing are also retained in the browser regression run.

Validation for this increment: **30 focused tests passed**, **10 desktop/mobile browser scenarios passed**, and the production build passed. The full suite was not rerun; previously reported manufacturing/legacy-generator failures are outside this increment.

Programmatic entry points are exported from `petri-net-app/src/satel/index.js`: `compileSymbolicIntention`, `deriveGenericSubdomains`, `deriveSymbolicIntention`, and `admitSymbolicIntention`. The existing ordinary `generateTestSuite` API still accepts pair intentions; use these explicit symbolic entry points for `kind: "symbolic"`.
