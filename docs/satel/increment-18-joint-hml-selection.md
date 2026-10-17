# Increment 18 — Joint scalar sequence and HML parameter selection

Date: 17 October 2026. Branch: `codex/satel-public-methods`.
Baseline: `2dba4f248c653dc087f40c0ce325b2e36b4ca1d8`.

## Observable improvement

Previously, a symbolic intention selected a representative satisfying its pair
sequence, then checked any additional HML requirement without choosing a new
representative. A failed HML requirement could reject a class even when another
member of that class would satisfy the complete test.

This increment solves for one shared assignment satisfying both the complete
sequence and the additional HML requirement. The requirement can be expected true
or false. It remains evaluated from the model's initial marking, independently
of the sequence's final marking. All branches use the same assignment.

The new **SATEL HML selection — Reference** example demonstrates the difference:

- The selection class is `0 < n <= 5`; its static representative is `1`.
- The pair sequence calls `open(n)` and observes `reply(n)`. It admits `n = 1`.
- Two `open` rules return that same response but leave different internal states.
- One state can always finish. The other can finish only when `n >= 3`.
- The additional property requires every open outcome to be able to finish,
  producing `reply(0)`. Joint selection chooses `3` in the recorded run.

The intended feasible values are `3`, `4`, and `5`; selection does not promise the
smallest representative. A second intention expresses the same requirement as
an expected-false property: there must not be an open outcome unable to finish.
Both selected tests pass concrete reference validation and detect both supplied
mutants: **missing finish** and **wrong receipt**.

## Constraint construction

`HmlConstraints.js` builds constraints over symbolic scalar markings using the
same compiled public-method plans as the existing simulator and sequence search.
For each invocation, it enumerates finite input-token occurrence assignments for
all implementing rules. Shared input variables add equalities; repeated input
arcs consume distinct occurrences. Each outcome carries a separate symbolic
successor marking. Equal token expressions avoid symmetric duplicate choices.

For an outcome `b`, let `E_b` denote input-matching and guard conditions, `O_b`
its observation predicate, and `M_b` its successor marking. The modal truth
constraints have the following structure:

```text
F(M, <a/O> phi) = OR_b  (E_b AND O_b AND F(M_b, phi))
F(M, [a/O] phi) = AND_b ((E_b AND O_b) IMPLIES F(M_b, phi))
```

Thus a box does not require every rule to be enabled. An empty matching successor
set makes a box true and a diamond false. Complemented observation filters negate
`O_b`. Conjunction/disjunction evaluate their requirements at the same marking;
negation reverses truth. Marking predicates support exact bags, multiset
containment, length and emptiness. Output predicates compare this firing's
production, not the accumulated output-place marking.

The solver query combines class constraints, a complete symbolic sequence path,
global signature/value validity, definedness of the HML evaluation, and the HML
truth constraint (negated when the additional property must be false).

Definedness is separate from enabledness: signed 32-bit intermediate arithmetic
and output-sort bounds prevent overflow from becoming a disabled edge or a
successful negative test. Guard and formula short-circuit semantics are reflected
in conditional definedness checks. All outcomes of an evaluated call have their
output computations checked, as in concrete successor enumeration, even if an
observation filter subsequently excludes them. Reached continuations are checked
according to the evaluator's order and short-circuit rules.

The preferred class representative is tested against the combined constraints;
if unsuitable, the preference is released and another assignment is solved for
within the class. No separate parameter assignment is allowed per branch.

Completed Boolean formulas in these witness queries go directly to Z3 rather
than being expanded into all Boolean alternatives. Class derivation retains its
existing equation/Boolean decomposition behaviour. This distinction avoids
unnecessary combinatorial expansion while preserving reported class boundaries.

## Supported scope and boundaries

- Joint HML selection currently accepts **Nat, Int and Bool** places, parameters
  and symbolic variables. Method expressions use scalar arithmetic `+`, `-`, `*`,
  comparisons, equality and Boolean operators. Values follow simulator bounds.
- String, List, Pair, constructor-valued variables and method operation calls
  are explicitly unsupported in this joint constraint builder. They remain
  available in the existing sequence-only workflow. Extending joint selection to
  those ADTs is the next increment, rather than silently reverting to post-checks.
- Existing algebraic equation-based class derivation remains upstream. This
  change does not prove the subuniformity hypothesis or change class definitions.
- Symbolic intentions still require their protocol sequence. This increment adds
  jointly solved branching requirements to that workflow; it does not add a
  standalone symbolic HML-only intention format.
- Explicit finite intentions retain fixed candidate values. Their existing
  concrete HML validation is unchanged.
- No automatic hidden/internal transition exploration or bisimulation proof is
  introduced. Supported APNs use synchronous public methods.
- Every generated candidate must pass the existing concrete reference oracle.
  The frozen combined test is `sequence AND property` or `sequence AND NOT
  property`; its overall expected truth is true in both cases.
- No satisfiable representative and incomplete search are distinct. Any
  unresolved or blocked class prevents partial suite admission under the existing
  policy. A failed bound is never converted into a truncated universal claim.

Defaults: at most 10,000 construction work units, 2,000 distinct formula/state
nodes, 100,000 expanded constraint-size units and 10 seconds per HML construction,
also subject to the existing sequence-search deadline. Cancellation propagates.
Shared formula/full-symbolic-marking results are memoized. Syntactically distinct
but mathematically equivalent symbolic markings are not generally merged.

## Review on a laptop

1. Load **Examples → SATEL HML selection — Reference**.
2. Open **SATEL → Generated tests** and select **Choose an amount allowing every
   open outcome to finish**.
3. Generate. Expect one admitted test. Expand **Why this test was selected**:
   the static representative is `1`, while the selected value is in `[3, 5]`.
   The explanation identifies joint sequence/HML selection.
4. Inspect the formal test and branching reference evidence. Both open outcomes
   must have a matching finishing continuation.
5. Load **Mutant: missing finish**, then **Replay results → Replay frozen suite
   on loaded APN**. Expect one failure and no execution error.
6. Repeat using **Choose an amount with no dead-end open outcome** and the
   **wrong receipt** mutant. The additional property's expected truth is false;
   its negation appears in the combined expected-true test.
7. In the symbolic intention editor, **Expected additional property truth**
   selects “Must hold” or “Must not hold”. It is preserved through PNML export.

## Validation and measurements

The final SATEL regression run passes **35 suites and 343 tests**.

Tests cover joint reselection, false expectations, shared assignments, disabled
rules, vacuity, complemented filters, all marking predicates, token multiplicity,
signed integers, Boolean arguments, overflow, short-circuiting, cancellation and
construction limits. Symbolic results are compared with concrete HML evaluation
for every bounded example amount and every property in the existing two-reference,
five-mutant nondeterminism collection. Existing exercise and fulfilment suites
remain part of the SATEL regression run.

Four new browser scenarios pass across desktop Chromium and Mobile Chrome:
reference selection, generation explanations and frozen mutant replay, for both
expected truth values. The editor also has a save/PNML round-trip check.
Production build succeeds with its existing large-bundle warning.

The [recorded functional smoke run](performance/hml-selection-2026-10-17.json)
selected `3` for both intentions, admitted both and detected both mutants with
each test. Joint generation plus admission took approximately 68 and 58 ms in
that run after the sequence-only baseline had initialized the solver. These are
single-process smoke timings, not a statistical performance claim.

For the existing depth-20 multiset example, symbolic construction visited 121
formula/state nodes with 100 cache hits, 220 outcome visits and 786 work units in
approximately 8 ms. This ground-token example simplifies to constant truth; it
does not establish scalability for general symbolic branching formulas.

From `petri-net-app`:

```sh
npm test -- --runInBand src/__tests__/satel
node tools/node/run-satel-hml-selection.js
npx playwright test tests/e2e/satel/hml-selection.spec.js
npm run build
```

Next: extend the joint builder to supported algebraic values/operations, with
explicit unfolding frontiers and concrete cross-checks, then provide a richer
selection explanation showing how branching constraints restrict each class.
