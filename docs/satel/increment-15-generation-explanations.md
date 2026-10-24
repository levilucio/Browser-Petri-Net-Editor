# Increment 15 — Generation explanations and integrated verification

## Review in the GUI

Generated tests now distinguish accepted sequences from tests ending in refusal.
Each test has a collapsed **Why this test was selected** explanation:

* Symbolic intentions: class pattern, conditions, defining equations, static
  representative, executable substitution and whether the representative had to
  change to satisfy the whole sequence.
* Explicit intentions: the fixed-value selection policy and substitution.
* Automatic refusal companions: the source test and prefix position, the relaxed
  terminal parameter domain, and counts of all rules/bindings considered.
* All admitted tests: reference marking history, shown as place/token bags under
  each pair's execution details. Refused calls read **refused; marking unchanged**.

The optional refusal checkbox explains that the final parameters may leave the
positive intention's conditions. The coverage panel distinguishes selected
candidates, completed searches with no refusal, unresolved searches and work not
attempted after a cap. Full per-prefix outcomes are available in a collapsed list.
No raw JSON is required to understand a pair or inspect its marking. JSON export
continues to contain the complete report, limits, frozen suite and replay results.

The existing job controller carries the new option, preserves cancellation and
prevents old jobs from replacing newer runs. Loading a mutant retains the frozen
reference expectations. Refusal is enabledness at the APN method interface, not
an arbitrary error response; Account's `ack(0)` remains an accepted observation.

## Laptop walkthrough

1. On branch `codex/satel-public-methods`, run `npm ci` and `npm run dev` in
   `petri-net-app`.
2. Load **SATEL Refusal — Quota reference** from Examples. Open SATEL, then
   Generated tests; choose **Reserve then refuse zero release** if necessary.
3. Generate: expect one three-pair test, ending with `release(0)` refused. Its
   final marking has `available = [7]` and `held = [3]`, unchanged from the audit.
4. Expand **Why this test was selected**, then the final pair's **Execution
   details** and **Marking after pair 3**.
5. Load **SATEL Refusal — Quota mutant: accepts zero**. Under Replay results,
   replay the frozen suite: expect one failure and no execution error.
6. Repeat with the refusal thermostat reference/mutant. The reference selects
   two three-pair tests with final adjustments -6 and 6. The mutant passes the
   negative-side test and fails the positive-side test.
7. Load the original **Thermostat — Reference (2 pairs)** exercise. Enable
   **Also select bounded refusal tests from validated positive prefixes** and
   generate. Expect three original positive tests plus one refusal companion.
   Its final parameter is outside the original [-5, 5] condition; its explanation
   makes that change explicit. Counts for other models can be capped.

## Verification on 17 October 2026

* Full SATEL Jest run: **34 suites, 306 reported passing tests**. This comprises
  304 ordinary passing tests and the two pre-existing `it.failing` cases for
  unsupported legacy automatic conditional-path synthesis. Those limitations
  remain; expected failures are not new feature successes.
* New focused files contain 28 tests across refusal construction/replay,
  automatic selection and GUI/PNML behavior. They include alternative enabled
  rules, shared variables and token multiplicity, solver unknown, resource
  exhaustion, cancellation, marking assertions and malformed-output errors.
* **Four end-to-end browser cases passed**: explicit refusal/reference/mutant and
  automatic-companion/explanation flows on desktop Chromium and mobile Chromium.
  Screenshots were inspected. The container used a separately installed Chromium
  binary because Playwright's browser download failed. An initial single-process
  browser configuration closed between cases; rerunning with normal multiprocess
  launch completed all four cases. Safari was not checked.
* Production build passed; the existing large-bundle warning remains.
* The original ten specs retain **32 positive tests / 354 pairs**, including the
  depth-20 journal. All twenty original mutants remain detected. The bounded
  default companion run adds **23 negative tests**. All 55 combined tests pass
  the reference models; combined replay detects all original mutants with zero
  execution errors.
* Both newly added permissive-guard mutants are detected by authored refusal
  tests and pass their unchanged original positive intentions. This demonstrates
  additional detection rather than a relabeling of existing positive failures.

Commands:

```sh
npm test -- --runInBand src/__tests__/satel src/satel/core/__tests__
npm run build
npx playwright test tests/e2e/satel/refusals.spec.js --project=chromium
node tools/node/run-satel-refusals.js ../docs/satel/performance/refusals-2026-10-17.json
```

The browser tests also run under the existing Mobile Chrome project. The smoke
runner records the source commit, whether the tree was dirty, timing, selected
final calls, limits, mutation outcomes and unresolved diagnostics.

## Bounded-run observations

See [raw measurements](performance/refusals-2026-10-17.json). This is a single
sequential smoke run with a warmed Z3 context, not a statistically controlled
benchmark; timing is environment-dependent and no speedup is claimed.

| Existing spec | Positive tests | Refusal companions | Searches attempted | Limit reached |
|---|---:|---:|---:|---|
| Thermostat | 3 | 1 | 4 | No |
| Door | 4 | 0 | 13 | No |
| Tickets | 2 | 1 | 11 | No |
| Labels | 3 | 1 | 22 | No |
| Coordinates | 4 | 0 | 37 | No |
| Queue | 3 | 0 | 34 | No |
| Parcel | 4 | 0 | 40 | Attempt cap |
| Quota | 3 | 10 | 20 | Test cap |
| Kits | 2 | 0 | 33 | No |
| Journal | 4 | 10 | 19 | Test cap |

No solver search was unresolved in this run. Parcel's cap still means some
prefix/call positions were not attempted. Zero companions does not establish
that a model has no refused behavior: the policy only visits the selected
positive prefixes and their next method. It does not try arbitrary methods at
arbitrary reachable states.

The largest added selection cost in this run was roughly three seconds for the
journal; quota was roughly one second. Companion admission was much cheaper in
these examples. Solving multiple refusal formulas can therefore be a noticeable
addition to generation. The default caps and cancellation remain necessary.
Solver witnesses are not promised to be minimal or aesthetically simple; the
String example can produce unusual Unicode values. Friendly representative
selection and scheduling fairness are useful follow-up work.

## What remains open

The feature covers final method refusal, not every notion of negative test in
SATEL. Negative output patterns, refusal-domain subuniformity, nondeterministic
conformance, arbitrary custom-ADT runtime parameters and external-SUT adapters
remain open. Neither bounded success nor completed equation cases establish the
thesis's general semantic equivalence or completeness claims.
