# Increment 34 — solver phase profiling

Branch: `codex/satel-public-methods`. Starting commit:
`f7f421285c9fc04ac76412220ad2601f94c094de`.

## Purpose and implementation

Increment 33 exposed two substantial costs in deep lookup: satisfiability-only
checks and witness-producing queries. This increment measures the work inside
those queries before choosing a more invasive optimization. It introduces no
new solver reuse, cache policy, constraint simplification or witness policy.

Enable it with `profileSolver: true` when creating the symbolic solver. Read
`solve.solverProfile` for a detached snapshot. It is disabled by default, with
an undefined snapshot and no phase clock reads. There is no new GUI control.
The benchmark worker records the snapshot in `sample.solver.backendProfile`,
including when a workload throws an error.

Implementation:
[SolverProfile.js](../../petri-net-app/src/satel/core/SolverProfile.js), integrated
into [SymbolicZ3.js](../../petri-net-app/src/satel/core/SymbolicZ3.js).

The profiler stores counts and elapsed times only; it retains no terms, witnesses,
Z3 models or handles. Each backend request has its own phase clock, allowing
interleaved requests to be accounted independently. All snapshots are copies.
Concurrent durations may overlap and therefore sum to more than shared wall time;
the benchmark runs requests sequentially. These are elapsed wall-clock measurements,
not CPU measurements or internal Z3 search statistics.

## What each phase measures

| Phase | Included work |
|---|---|
| `create` | Per-query solver creation and timeout setup |
| `encode` | Referenced-variable discovery, term/graph encoding, declarations, validity predicates and SMT-LIB string assembly |
| `parse` | `solver.fromString`, including parsing the datatype/function preamble and loading assertions |
| `handles` | Assertion-vector ownership and symbol-handle extraction |
| `check` | Awaiting the initial `solver.check()` |
| `decode` | Model acquisition, evaluation of variables and decoding ground values |
| `validate` | Independent validation of decoded witness sorts and conditions |
| `preferenceSetup` | Push and assertions for the existing joint numeric-value-1 preference |
| `preferenceCheck` | Awaiting the optional preferred-value solver check |
| `cleanup` | Final assertion-vector release and solver release |
| `other` | Remaining control flow, model-handle release, preference pop and profiler bookkeeping |

Decode and validation totals include a second witness when the preference succeeds.
Error paths account elapsed work up to the exception, so the active phase can
include associated exception handling. The original validated witness remains
available when the optional preference is infeasible or its check fails.

Backend totals and phase totals are reported globally and separately for witness
and satisfiability-only requests. The latter include feasibility checks, prefixes,
overlap checks and ancestor-disjointness proofs; they are not the same aggregate
as the unfolding profiler's feasibility-only counters. Main-check and preference-check status counts
are separate from final backend outcomes: for example, a SAT solver result can
still become unknown if its model cannot be decoded safely. Encoding failures
have no main-check status. Cancellation and thrown setup/cleanup failures have
separate outcome labels.

Cache hits do not start a backend trace. Witness validation on a cache hit is
reported separately as `cacheWitnessChecks` / `cacheValidationMs`. Cache lookup,
key serialization, answer copying and general cache bookkeeping are outside the
backend phase totals; the existing adapter-time measurement includes that work.
A failed cached-witness validation followed by recomputation can contribute to
both the cache-validation timer and a new backend trace.

Shared Z3 initialization, adapter creation and one-time preamble text construction
are outside these per-query timings. Parsing that preamble for each actual query
is included in `parse`. Admission/replay using other adapters is outside the
selection adapter snapshot. This distinction matters when interpreting total
application latency.

## Preservation scope

The instrumentation leaves query construction, solver assertions, solver-check
order, model extraction, preference policy and cache keys unchanged. It adds no
solver calls. Existing resource releases remain in their original execution order;
profiling state is finalized in error paths as well as successful ones. It does
not suppress unknowns, errors or cancellation.

This is a diagnostic increment, not a semantic completeness result. Clock reads
and counter updates have cost, and wall-clock limits can make profiled and
unprofiled runs stop at different points. The paired benchmark checks this on
current examples; it cannot prove zero overhead or identical timed outcomes for
all models. No guarantee about exhaustive bug detection follows from these data.

## Reproduction

From `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-34-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-34-solver-phase-profiling.json
```

The 14 existing workloads from increment 33 run with phase profiling disabled and
enabled, giving 28 configurations and three trials each. All optimizations from
increments 30–33 remain enabled in both modes. Unfolding-level profiling also
remains enabled in both; this comparison isolates the new backend phase profiler.
It compares the two modes of this revision, not two different source revisions.

Each configuration runs in a separate sequential child, with separately timed Z3
initialization and a trivial warm-up query. Medians include the colder first trial.
Tests and build finish before the benchmark starts. Existing ten-second recursive
budgets, one-second per-query limits, branch limits and APN settings are retained,
including explicit zero-time and branch-limit controls. No new example definitions
are introduced.

## Results

All **84 trials** completed without runtime errors or child hard timeouts:
60 partial derivations, 6 fixed-spine frontier-resolved derivations and 18 selected
APN runs. Profiling modes agree on class counts, infeasible branches, frontier
reason/depth histograms, overlap/unknown counts and backend-call counts. All
**3,414 class witnesses** passed independent concrete evaluation. Every measured
phase sum agrees with its backend total, including separate request-mode totals.
All 70 JavaScript source hashes match this increment. Recorded 23 October 2026 UTC,
Node 24.19.0, Linux x64, AMD EPYC 9V74, 9 exposed logical CPUs.

Median selection times over three trials, milliseconds:

| Workload | Profiler off | Profiler on |
|---|---:|---:|
| list-16 | 118.99 | 123.10 |
| tree-9 | 174.02 | 186.18 |
| membership-12 | 421.48 | 405.02 |
| lookup-4 | 687.84 | 651.96 |
| lookup-5 | 1,693.81 | 1,483.90 |
| repeated-12 | 43.21 | 47.04 |
| membership-fixed-12 | 358.71 | 360.71 |
| lookup-branch-limit | 383.10 | 383.78 |
| list-time-limit | 0.73 | 0.71 |
| inventory-20 | 345.35 | 317.97 |
| workers-audit | 465.75 | 382.03 |
| fulfilment-20 | 582.70 | 562.63 |
| lookup-6 | 3,214.30 | 3,088.93 |
| lookup-7 | 6,588.69 | 6,537.16 |

The differences are mixed: some profiled runs are slower and others faster.
Three trials do not isolate a reliable overhead estimate from run-to-run noise,
and faster profiled medians are not optimization gains. The profiler remains off
by default. It made no additional solver calls in these workloads.

### Deep lookup breakdown

The following numbers use the profiled depth-7 trial whose selection time is the
median (**6,537.16 ms**, trial index 2). Using one actual trial keeps the phase
percentages and totals additive rather than combining independent medians.
It makes 698 backend requests, with **6,248.74 ms** inside the backend:

| Work | Time, ms | Backend share |
|---|---:|---:|
| Initial solver checks | 3,776.35 | 60.4% |
| SMT-LIB parsing/assertion loading | 1,198.49 | 19.2% |
| Preference setup and checks | 828.27 | 13.3% |
| Final query cleanup | 280.96 | 4.5% |
| Ground-value decoding | 70.91 | 1.1% |
| Independent witness validation | 8.99 | 0.1% |
| Creation, encoding, handles and other control work | 84.78 | 1.4% |

The preference checks return **252 UNSAT and 2 SAT**, identically in all three
profiled depth-7 trials. Most lookup paths contain a numeric strict inequality;
fixing both sides to 1 makes that condition false. This suggests avoiding provably
impossible optional preference checks before attempting model-extraction caching.
The measured 828 ms is an opportunity estimate for the entire preference phase,
not a demonstrated future speedup or a claim that all of it can be eliminated.

The 254 completed classes, 128 recursive residuals and zero unknown intersections
are the same in both modes. Primary solver-check cost remains the largest part,
so the preference shortcut alone will not solve deep recursive scalability.

### Other workloads

In the median-selection tree-total trial, parsing is about 26% of backend time,
initial checks 24%, preference setup/checking 32%, and decoding 11%. All 23
preferences succeed, so an impossible-preference shortcut would not help this
case. This illustrates why an optimization must be evaluated across the existing
examples rather than selected only for the lookup workload.

The corresponding inventory trial spends about 63% in initial checks and 24% in
parsing; fulfilment spends about 59% and 31%, respectively. Decoding plus validation
is below 2% in both. These APN measurements support investigating solver checking
and parsing, while providing little evidence for prioritizing witness-decoding
optimizations. They do not separate parsing the algebra preamble from parsing
query assertions, or internal SMT search from wrapper/scheduling time.

All **24 reference test replays passed**. Mutant replays on each configuration's
first trial produced **24 failures** and the same **two expected fulfilment
stock-leak survivors** from unobserved stock. Paired modes have identical mutation
verdicts and failure reasons, with no replay errors.

Raw [report](performance/increment-34-solver-phase-profiling.json) and
[JSONL records](performance/increment-34-solver-phase-profiling.json.jsonl) retain
all trials, phase breakdowns, limits, source hashes and frontier samples.

## Validation and next increment

All **561 SATEL tests passed in 53 suites** (50.613 seconds); the production build
passed (5.96 seconds), with the existing dependency/browser, sourcemap and
bundle-size warnings. The focused profiler/cache run also passed all 27 tests.
New tests cover phase accounting with interleaved clocks, detached snapshots,
SAT/witness/UNSAT behavior for all six basic sorts, cache-hit validation, successful
and infeasible preferences, encoding failures, undecodable models, cancellation
before a cache hit, and recursive class/frontier/overlap and call-count agreement.

The next small optimization candidate is **direct refutation of an impossible
numeric preference**. For example, a fully numeric condition `key < pivot`
becomes `1 < 1` when all numeric variables are fixed to the preferred value.
That condition alone proves the preference impossible. Returning the already
validated original witness could avoid the optional push/check/pop sequence.

A safe implementation would require a decisive false condition independent of
all remaining unfixed variables, use the existing ground evaluator, and fall
back to the current Z3 preference check whenever it cannot establish that fact.
It must not reject a preference merely because one chosen assignment of other
variables fails. This proposed shortcut would affect only optional representative
selection, not branch feasibility or class completeness. It is **not implemented
in increment 34** and needs its own baseline switch and differential tests.

Repeated parsing is another candidate for investigation, but the current parse
measurement combines algebra-preamble parsing and query-specific assertions.
It does not prove that reusing the algebra preamble would eliminate that entire
cost. Any reuse or slicing would need to preserve datatype dependencies, validity
predicates, symbol scope and error behavior. The measured initial solver-check
phase also includes wrapper/async scheduling overhead; it is not evidence that
all of its time is internal SMT search.
