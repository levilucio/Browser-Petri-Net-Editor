# Increment 2 — GUI oracle validation, mutant APNs, V2-only intentions

## Review in the editor

1. Open **Examples → SATEL Account — Reference**. This loads an independent APN with a visible layout and switches to Algebraic mode.
2. Open **SATEL → Oracle validation**. Keep **Refined: less / equal / greater** selected.
3. Click **Generate and validate on loaded reference**. Expect **4/4 tests passed the reference oracle**. Expand each test to inspect its constructor pattern, residual constraints, equation IDs, witness, and stimulation/observation pairs.
4. Close SATEL. Load **Examples → SATEL Account — Mutant: reject-exact-balance**. Reopen SATEL and click **Replay frozen suite on loaded APN**.
5. Expect **3 passed · 1 failed · 0 errors**. The `Amount(10)` case fails at step 2: the reference expects payment, but the mutant refuses it. Expected/actual observations are shown.
6. Repeat with the **no-debit** and **refusal-resets-balance** examples. Both are detected. The APNs can be edited on the canvas; replay always uses the current editor model.
7. Reload the reference, choose **Coarse**, and regenerate. Expect **3/3** admitted tests. Load the exact-balance mutant and replay: all three pass, so this mutant survives the coarse suite.

The suite remains in memory across panel closure, tab changes, and example loads. It does not survive a page reload; **Download suite and results (JSON)** saves the evidence for review. Importing saved suites is not implemented. Changing the target invalidates displayed target results until replay. Changing the refinement selector only affects the next generation; the existing suite retains its recorded refinement.

## Expected outcomes

| APN | Refined suite (4 tests) | Coarse suite (3 tests) |
|---|---|---|
| Reference | 4 pass | 3 pass |
| no-debit | 2 pass, 2 fail | 2 pass, 1 fail |
| refusal-resets-balance | 3 pass, 1 fail | 2 pass, 1 fail |
| reject-exact-balance | 3 pass, 1 fail | 3 pass; mutant survives |

These are observations for the supplied examples, not a guarantee that the selected suite detects every possible mutation. An execution error is shown separately and never counted as a mutation detection. Attempting to use a mutant as the reference fails admission when its observations disagree with the supplied equations.

## Scope and assumptions

This integrates the first increment's symbolic selection and strict numeric APN adapter into the GUI. No state-space exploration is used for symbolic classes. The constructor and conditional operation equations remain in `src/satel/examples/oracle-account/algebra.js`; the constructor-to-public-request encoding is explicit. Translation from arbitrary editor ADT definitions and arbitrary V2 intentions into this symbolic representation remains a later increment. The GUI states this limit.

The loaded APN is used as the reference, not a hidden built-in reference net. The equation-derived observations must pass it before a suite is admitted. A snapshot of that reference and the fixed observations is retained; replay does not regenerate expectations from a mutant. The strict adapter remains limited to the synchronous singleton-Nat APN fragment documented in [increment 1](increment-01-symbolic-oracle.md).

## V2-only cleanup

- Removed the V1 editor, path-pattern generation, trace-based execution, V1 oracle/reduction/reachability modules, migration skeleton, type definitions, V1 example intentions, and their dependent tests/debug scripts.
- Removed fabricated demo suites/results and misleading “states explored” counts. V2 generation reports pair stimulations and explores zero states.
- The public `executeTestSuite` export now uses the same V2 checker as the editor.
- V1 inputs, including mixed V1/V2 lists, are rejected explicitly. Old localStorage transfer payloads are discarded with an explanation; manufacturing intentions now load with their model.
- V2 GUI generation checks all candidates on the loaded reference before admitting a suite. Failed admission displays the failures/errors and offers no executable suite. The low-level general `generateTestSuite` still returns candidates with `oracleValidated: false`; it does not claim independent symbolic validation.
- Fixed the missing ADT registry parameter in V2 pair execution. Malformed `notEnabled` stimuli now produce errors, including in negative tests. The UI uses the overall verdict and cannot paint an errored test green because one pair passed.

The existing general V2 checker still permits transition-directed injections and has broader semantic limitations than the strict account adapter. Passing its admission check must not be read as proving the full SATEL semantics. Manufacturing/path-selection issues remain visible in their existing unit tests; this increment does not relabel those failures as successes.

## Validation

- Focused symbolic and GUI/API tests cover oracle admission, mutant replay after panel closure/model loading, stale target invalidation, coarse-surviving mutation, unsupported-target errors, and V1 rejection.
- Production build succeeds.
- All 23 focused symbolic/GUI/API tests pass. Full Jest: 150/153 suites pass, 586/593 tests pass (seven existing failures, no new failures).
- Four Chromium end-to-end checks pass: account reference-to-mutant replay and manufacturing V2 loading on desktop and mobile viewports.
- Against the previous commit's regression failures: no new failing unit tests; two existing mutation-verdict failures are resolved by the V2 executor fixes. Seven failures remain in `all-fixes`, `path-subuniformity`, and `manufacturing-v2`.
- Three removed unit suites tested only the deleted V1 implementation. They are replaced by focused V2 rejection and GUI/oracle regression coverage, not counted as repaired semantic tests.

Run:

```sh
cd petri-net-app
npm test -- --runInBand --runTestsByPath src/__tests__/satel/oracle-gui.test.jsx src/__tests__/satel/symbolic-oracle-increment.test.js
npm run satel:oracle-example
npm run build
npx playwright test tests/e2e/satel/oracle-account.spec.js tests/e2e/manufacturing-satel-v2.spec.js --project=chromium
```

## Follow-up: instantiated pair presentation

Both the account example and ordinary V2 generated tests now render as a vertical
`HML( ⟨stimulation with observation⟩ … T ), truthValue` sequence, following the
pair notation illustrated in §7.1.1 (printed p. 131) of
[the SATEL thesis](https://archive-ouverte.unige.ch/unige:2498).

For example, the equality witness contains
`⟨withdraw(10) with ack(1) // paidAmount(10)⟩`. Constructor terms are displayed as
`Amount(10)` or `Order(10, High())`, with the selected substitution shown above the
pairs. Test cards are expanded initially. Expected/actual output comparisons also
use place/token notation instead of JSON.

This is an APN presentation adaptation: output events name places; input place
bindings and expected empty outputs are listed under each pair. Ordinary V2
stimulations retain their explicit transition and named-place bindings, displayed
as `transition [place ↦ ⟦tokens⟧]`. Repeated tokens remain repeated. An empty output
map is displayed as `unconstrained`, distinct from `null` with explicit empty-place
assertions. A `notEnabled` observation retains its meaning. The final truth value
is the test expectation, not a replay verdict. This rendering neither changes the
test data nor claims support for the full CO-OPN synchronization/HML semantics.

Validation for this presentation change: 10 focused GUI/API tests, production
build, and the account reference-to-mutant browser workflow on desktop and mobile.
The browser test checks that all 12 instantiated pairs are present and that the
equality case displays its exact stimulation and payment observation.
