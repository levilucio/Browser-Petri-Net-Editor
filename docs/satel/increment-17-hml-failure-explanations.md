# Increment 17 — HML failure evidence and readable explanations

Date: 17 October 2026. Branch: `codex/satel-public-methods`.
Baseline: `bba393cae3aa9cac7f6549d0e78f9f43cb557e5e` (increment 16).

## Purpose

Explain why a frozen HML test fails on a target APN, alongside its formal
satisfaction result. Distinguish an unavailable public call from an enabled call
with an incorrect output or resulting marking, and from a failed continuation.
Support expected-false properties without describing every false subformula as
an implementation error.

The explanation is generated deterministically from the evaluator's evidence.
It does not use an LLM, perform a second simulation, change selection or replay
semantics, or infer a source-code defect from a behavioural mismatch.

## Evidence and GUI

Previously, an outcome outside a modality's observation filter was discarded.
The evaluator now preserves each inspected outcome, including:

- Its rule, variable binding, produced tokens and complete resulting marking.
- The observation check and its first mismatch: place, actual tokens, and
  expected tokens or marking predicate.
- Its outcome number and whether it entered the continuation or was excluded
  by the observation filter.

Modal evidence also preserves the marking before the call. Standalone marking
predicates preserve their marking and failed assertion. Successor counts,
enumeration completeness, short-circuit behaviour and shared evidence references
remain available. Outcomes never inspected after a decisive result are explicitly
distinguished from inspected outcomes outside the filter.

The GUI adds a short verdict explanation and links to the relevant evidence.
Following a link opens the enclosing branches and focuses the precise outcome
or obligation. Each obligation shows plain-language reasoning beside its formal
result, using `M[path] ⊨ φ`, `M[path] ⊭ φ`, or an unresolved result. Method
arguments are displayed. Bindings, produced tokens and markings use readable
notation rather than JSON. Shared proofs have working links instead of expanded
copies. Distinct test displays use distinct link identifiers.

The overview shows at most twelve findings, with a count of additional details
available in the evidence tree. Full retained evidence is not truncated by this
presentation limit. Replay results additionally contain `propertyExplanation`;
the existing nondeterminism CLI includes this explanation for failed tests.

## Logical distinctions

| Evaluated obligation | Evidence explaining the result |
|---|---|
| False diamond, no successors, complete search | Required call unavailable in this marking |
| False diamond, enabled outcomes but none inside the filter | Observation mismatch or exclusion by a complemented filter |
| False diamond with matching outcomes | Every matching continuation fails; different branches may fail differently |
| False box | One matching outcome with a false continuation suffices |
| True box with no matching outcomes | Vacuous truth, separating a disabled call from enabled outcomes outside the filter |
| False negated diamond | An enabling witness establishes the forbidden possibility |
| Expected-false property that evaluates true | Evidence of truth, rather than an invented bad output or refusal |
| Undecided result | Inconclusive; absence or universal success has not been established |

The explanation follows the proof of the **actual** truth value. An observation
mismatch is not automatically a test failure: it can exclude an outcome from a
box, or include it in a complemented observation filter. Such outcomes are
labelled accordingly. Only the comparison with the test's expected truth value
determines the verdict.

## Actual examples from the existing mutants

The linked [recorded smoke run](performance/hml-explanations-2026-10-17.json)
contains generated explanations from all five nondeterminism mutants. Six
reference intentions are now available: the original five plus the stock-marking
intention described below. All pass their reference oracle; all five mutants
are detected by at least one frozen test.

### Missing choice: an unavailable call

Generate **Both token orders, multiplicity and final refusal** on **Multiset
reference**, then replay on **Multiset mutant: missing choice**. After taking
`1` twice, the stock contains `2`, but the mutant only permits taking `1`.

At evidence `1.1.1.1`, the generated explanation is:

> No implementing transition with a valid token binding can fire take() in this marking. The required possibility is absent; the successor search is complete.

The valid prefix remains in the parent branches, with its produced tokens and
reached markings.

### Missing duplicate: enabled call, wrong observation

Replay the same intention on **Multiset mutant: missing duplicate**. After
taking the first `1`, stock is `{2}`. The next call can fire, but cannot produce
the second required `1`.

At evidence `1.1.1.outcome-1`:

> At place picked, this firing produced ⟦2⟧; the observation requires ⟦1⟧. These are produced tokens, not the whole resulting marking.

The linked outcome shows rule `take`, binding `x = 2`, and the resulting empty
stock. This is different from a call having no enabled firing.

### Missing duplicate: correct output, wrong marking

A new selectable intention, **Taking 1 retains one 1 and one 2**, uses the same
reference APN. It requires a `take()` outcome producing `picked = {1}` and
leaving `stock = {1, 2}`. It passes on the reference and fails on the existing
missing-duplicate mutant. At evidence `1.outcome-1`:

> Place stock has marking ⟦2⟧; the assertion requires it to equal ⟦1, 2⟧.

The produced token is correct here; the resulting marking is not. Other
possible outcomes are retained separately, including their output mismatches.

### Early choice: both traces exist, but no suitable branching state

Generate **One open outcome retains both choices** on **Branching reference**,
then replay on **Branching mutant: early choice**. At the root:

> open() can fire with a matching observation, but every matching outcome fails the continuation. Outcomes outside the filter cannot witness this possibility either. Follow the separate branches: they need not fail for the same reason.

The `openBoth` outcome now reaches `state = {4}` and cannot fire `left()`.
The `openLeft` outcome reaches `state = {2}` and cannot fire `right()`.
Both refusals have their own linked evidence. The explanation preserves the
branching distinction instead of presenting a misleading single trace.

### Extra output and lost alternative

On **Multiset mutant: extra output**, the no-third-value property fails because
the prohibited diamond is true. Its witness explanation begins:

> Rule takeBad can fire take(), producing picked ↦ ⟦99⟧.

On **Branching mutant: lost alternative**, **Not every open outcome retains both
choices** fails with:

> The test fails: the property was expected to be false, but it is true.

Its evidence establishes that every remaining `open()` outcome retains both
continuations. It does not falsely identify an output mismatch or refusal.

## Validation and performance

- `npm test -- --runInBand src/__tests__/satel`: 34 suites and 323 tests passed.
  This includes the existing exercise/fulfilment baselines and new explanation
  tests. The final HML-focused rerun covers 36 tests in three suites.
- Six browser checks pass, covering reference generation, mutant replay, expected-false
  explanations and opening the precise rejected outcome from its overview link,
  on desktop Chromium and Mobile Chrome.
- Production build succeeds, retaining the existing large-bundle warning.
- The depth-20 smoke check still visits 121 distinct formula/state obligations,
  with 341 binding visits and 100 reused formula results. Richer serialized
  evidence occupies 84,015 bytes, versus 61,232 in increment 16's recorded run.
  The new recorded run took 13 ms; this is a single functional smoke measurement,
  not a statistically meaningful speed comparison.

From `petri-net-app`:

```sh
npm test -- --runInBand src/__tests__/satel
node tools/node/run-satel-nondeterminism.js
npx playwright test tests/e2e/satel/nondeterminism.spec.js
npm run build
```

## Remaining boundaries

- Evidence is a bounded explanation tree/DAG, not a separately certified or
  minimized proof. A failed existential can require several alternatives.
- An unavailable call is a detected behavioural discrepancy; its root cause
  might be a guard, token availability or an earlier hidden state error. The
  explanation does not attribute that cause without evidence.
- Observation checking retains the first failed assertion per firing. It does
  not claim to list every wrong place in that firing.
- Existing outcome deduplication still merges identical produced bags and full
  resulting markings; the evidence identifies a representative rule/binding.
- Incomplete enumeration and undecided continuations remain inconclusive unless
  a decisive witness or counterexample has already established the result.
- Regenerate/replay old suites to obtain the new rejected-outcome information;
  it cannot be reconstructed from old evidence that discarded those outcomes.
