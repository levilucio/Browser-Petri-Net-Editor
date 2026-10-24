# Increment 35 — direct refutation of impossible numeric preferences

24 October 2026. Branch: `codex/satel-public-methods`. Starting commit:
`1714bc486640fc36f3e333e172ea1b3c73ec41bb`.

## Change

After obtaining and independently validating a SAT witness, the solver adapter
normally tries setting all numeric variables to 1 jointly. Increment 34 showed
that this optional preference frequently fails on lookup paths: 252 of 254 checks
at depth 7 returned UNSAT. This increment avoids that extra solver interaction
when a whole condition directly refutes the preference.

For example, a path condition `key < pivot` becomes `1 < 1`. Since that is false,
no assignment to any other variable can make the joint numeric preference satisfy
the original conjunction. The adapter returns the already validated original
witness without the optional push/assert/check/pop sequence. It does not reject
the original query or remove a class.

This is enabled by default in the solver used by GUI generation. There are no new
editor controls or model fields. Set the solver option
`numericPreferenceRefutation: false` to retain the original preference check for
comparison. When supplying a custom `solve` callback, configure its adapter with
the desired option at creation time, as for other solver settings.

Implementation:
[NumericPreference.js](../../petri-net-app/src/satel/core/NumericPreference.js),
called from [SymbolicZ3.js](../../petri-net-app/src/satel/core/SymbolicZ3.js).

## Conservative proof rule

Let `C = c₁ ∧ … ∧ cₖ` be the original solver-ready constraints and `P` the set of
Nat/Int variables selected by the existing preference policy. Let `σ` map every
variable in `P` to 1. A shortcut is allowed only when some whole conjunct `cᵢ`:

1. Uses only the supported numeric/Boolean term fragment.
2. Has all its free variables in `P`.
3. Evaluates under `σ` to the Boolean value `false` using the existing ground
   evaluator, without an exception.

Then `C ∧ (∧ₓ∈P x = 1)` is unsatisfiable, independently of every variable outside
`P`. The current fallback would keep the original validated witness after an
UNSAT preference check; the shortcut keeps that same already-read witness.
Neither the primary solver check nor witness extraction/validation is skipped.

The supported fragment includes safe integer and Boolean literals, numeric
variables, `+`, `-`, `*`, comparisons, Boolean connectives, conditionals and shared
term graphs with local backward references. The existing evaluator uses exact
integer arithmetic and rejects results outside the safe JavaScript integer range.
An overflow or failed interpretation is inconclusive and retains the SMT fallback.
Malformed graph references are excluded, including references in unused nodes.

Strings, constructors, ADT tests/selectors, operation calls and runtime-validity
predicates are deliberately outside this shortcut. A condition involving an
unfixed Bool, String or structured variable also falls back. Even a Boolean
formula with an easily false numeric subexpression is not shortcut when the
whole condition contains unfixed variables. Another independent numeric conjunct
can still establish the contradiction.

For example, `n == 2 or b` with unfixed Boolean `b` must reach Z3: choosing `n = 1`
and `b = true` can satisfy it. Testing only the old witness's value for `b` would
be unsound. This implementation never uses old assignments to unfixed variables
as a proof that the preference is impossible.

The helper adds no answer cache or learned constraint. Algebra definitions,
class unfolding, primary feasibility queries, witness obligations, exact-cache
keys and reference admission remain unchanged. Unknown or UNSAT primary queries
never enter the shortcut. Cancellation is checked before and after the optional
refutation, and cache-hit witness validation still runs.

This is a local preservation argument for the supported exact fragment, not a
machine-checked proof of the entire tool. Timed searches and later representative
choices can still differ because solver interactions and resource consumption
change. It does not establish exhaustive subuniformity or global monotonic bug
detection under finite search budgets.

## Diagnostics and reproduction

The optional solver profile adds the `preferenceRefute` phase and the counters
`preferenceRefutationAttempts` and `preferenceRefutations`. Successful refutations
are distinct from `preferenceChecks.unsat`: a refutation makes no optional Z3
check. Backend-request and main-check counts need not decrease; the saved check
is a second check inside a SAT witness request.

From `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-35-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-35-numeric-preference-refutation.json
```

The matrix reuses all 14 existing recursive ADT and APN workloads, in both modes,
with three trials per isolated configuration. All earlier optimizations remain
enabled. Solver-phase and unfolding profiling are enabled in both modes; their
cost is included. Each configuration has separate Z3 initialization and a trivial
warm-up. Medians include the colder first trial, mode order alternates by workload,
and tests/builds finish before the sequential benchmark run. Existing per-query,
derivation and branch budgets remain, including explicit exhaustion controls.

## Results

The main matrix completed all **84 trials** without runtime errors or child hard
timeouts: 60 partial derivations, 6 fixed-spine frontier-resolved derivations and
18 selected APN runs. Paired modes agree on class counts, infeasible branches,
frontier reason/depth histograms, overlap/unknown counts, backend-request counts
and main-check status counts. All **3,414 class witnesses** passed independent
concrete evaluation. All 71 measured JavaScript source hashes match this increment.
Environment: Node 24.19.0, Linux x64, AMD EPYC 9V74, 9 exposed logical CPUs.

Main-matrix median selection times over three trials, milliseconds:

| Workload | Baseline | Refutation enabled |
|---|---:|---:|
| list-16 | 122.67 | 118.58 |
| tree-9 | 194.06 | 173.28 |
| membership-12 | 434.90 | 467.35 |
| lookup-4 | 683.50 | 632.70 |
| lookup-5 | 1,603.34 | 1,389.73 |
| repeated-12 | 41.49 | 43.54 |
| membership-fixed-12 | 396.89 | 409.34 |
| lookup-branch-limit | 370.51 | 321.00 |
| list-time-limit | 0.80 | 0.69 |
| inventory-20 | 284.11 | 400.56 |
| workers-audit | 397.39 | 385.70 |
| fulfilment-20 | 510.04 | 500.30 |
| lookup-6 | 3,119.76 | 2,654.09 |
| lookup-7 | 6,542.38 | 5,460.57 |

Lookup depths 5, 6 and 7 improve by approximately **13%, 15% and 17%** in these
medians. At depth 7, every enabled trial replaces **252 UNSAT preference checks**
with direct refutations. The two feasible preferences still go through Z3.
The same 698 backend requests and main solver checks remain; the total number
of solver checks falls from 952 to 700 because the saved checks are optional
second checks within witness requests.

Using each mode's median-selection depth-7 trial, preference setup/checking drops
from **852.53 ms to 5.92 ms**, with **3.54 ms** spent on refutation. The same 254
completed classes, 128 recursive residuals and zero unknown intersections remain.
The total selection-time improvement is larger than the measured preference-phase
saving; parsing, cleanup and other timings also vary between runs, so the whole
wall-clock difference should not be attributed solely to the shortcut.

List total, tree total and repeated total have feasible preferences and skip no
checks. Their timing differences provide no evidence of a shortcut benefit.
Some smaller workloads have slower medians in the initial three-trial matrix,
so those were investigated separately rather than omitted from the report.

### Focused repeats of the slower small cases

Membership, fixed-spine membership and inventory were rerun with **seven trials
per configuration and reversed mode order**, after the main matrix finished:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-35-repeat-cases.json --runs 7 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-35-preference-repeat.json
```

| Workload | Baseline median, ms | Enabled median, ms |
|---|---:|---:|
| membership-12 | 472.95 | 423.74 |
| membership-fixed-12 | 344.85 | 316.72 |
| inventory-20 | 270.45 | 279.52 |

The membership slowdowns in the original matrix do not persist in these repeats.
Inventory saves only one optional check and has similar timing ranges: baseline
263.93–471.17 ms, enabled 261.25–451.49 ms. Its enabled median is still about 3%
slower, so no inventory speedup is claimed. Median recognition cost is below
0.3 ms in each of these three enabled workloads. Other phases, including primary
solver checking, account for most observed timing variation; these experiments
do not prove its cause or guarantee a speedup for every model.

All **42 repeat trials** completed without errors/hard timeouts, retained matching
class/frontier/overlap and mutation outcomes, and independently validated another
**518 class witnesses**. Main-matrix reference replay passed 24 tests; repeat
reference replay passed 28. Mutants produced 24 and 16 failing tests respectively,
with the same two expected fulfilment stock-leak survivors in the main matrix.
There were no replay errors or changed mutation verdicts.

Raw main [report](performance/increment-35-numeric-preference-refutation.json) and
[JSONL](performance/increment-35-numeric-preference-refutation.json.jsonl), plus
focused-repeat [report](performance/increment-35-preference-repeat.json) and
[JSONL](performance/increment-35-preference-repeat.json.jsonl), retain every trial,
configuration, source hash, profile and frontier sample. Both datasets are kept;
the repeat results do not replace the initial measurements.

## Validation and remaining work

All **576 SATEL tests passed in 54 suites** (48.399 seconds); the production build
passed (5.85 seconds), with the existing dependency/browser, sourcemap and
bundle-size warnings. The focused numeric-preference/profiler tests passed, as did
the expanded solver-fallback tests before the final full run.

The new tests check strict and non-strict numeric guards, feasible preferences,
unfixed Boolean/string alternatives, independently contradictory conjuncts,
shared term graphs and invalid references, exact-arithmetic overflow, unsupported
terms, primary UNSAT/unknown results, cache-hit validation and cancellation.
An arithmetic/Boolean corpus independently asks Z3 to confirm UNSAT for every
refutation produced by the helper. Recursive membership/lookup/repeated-operation
tests compare class patterns, conditions, results, provenance, frontiers and
overlap verdicts across both modes.

Earlier mechanism tests expected a second solver check even for `n >= 3`. The
initial full run exposed those three obsolete call-count assumptions. They now
explicitly cover the disabled baseline and an enabled-mode condition with an
unfixed Boolean that must reach the real SMT fallback. Both retain their strict
assertions about preserving the first validated witness on optional UNSAT,
unknown or error, with exactly two checks and no third retry. The earlier profiler
test isolates its original preference-check timing by disabling this shortcut.

The change removes redundant optional checks; it does not reduce the number of
classes, alter the ADT unfolding bound or eliminate recursive residuals. Cases
whose preferences are feasible, or whose conditions lie outside the supported
fragment, retain the existing SMT path and incur a small recognition cost.

The next larger target remains repeated SMT parsing/setup and primary solver
checks. Any reduction in algebra declarations or reuse of parsed context needs
separate dependency/scope analysis and differential tests; this increment does
not introduce it. No new APN/ADT definitions were needed for these comparisons.
