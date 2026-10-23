# Increment 33 — feasibility query projection and reuse

Branch: `codex/satel-public-methods`. Starting commit:
`60c55decb24866eb86e3f79863d2e492de02aed0`.

## Change

Narrowing's feasibility requests now contain only the terms and variable
declarations that the solver actually uses. Previously, each request carried a
growing declaration map from all visited branches. Satisfiability-only requests
also carried input/result terms, including residual operations, that the backend
does not read in this mode. These differences enlarged exact-cache keys and kept
some identical constraint checks from sharing an answer.

The new projection has two cases:

- **Satisfiability only** (`witness: false`): keep every condition, remove the unused
  terms, and retain declarations for variables occurring in the conditions.
- **Witness required**: keep all terms and conditions, and retain declarations for
  their combined variables. This includes unconstrained variables that must be
  instantiated in returned inputs or outputs.

Conditions, names, sorts, expression order, shared-variable relationships and
term-graph references are unchanged. The existing bounded exact-query cache then
reuses eligible complete answers; no new cache or alpha-renaming is introduced.
The same projection applies to sequence-prefix constraint checks. Overlap and
ancestor-disjointness queries are untouched.

This is enabled by default, including GUI generation. No editor controls, model
format or interpretation of test intentions change. The comparison switch is
`feasibilityQueryProjection: false`; the existing `solverQueryCache: false` still
turns off answer reuse independently.

Implementation:
[FeasibilityQuery.js](../../petri-net-app/src/satel/core/FeasibilityQuery.js), used by
[GenericSubuniformity.js](../../petri-net-app/src/satel/core/GenericSubuniformity.js).

## Preservation argument and scope

Let `C` be the solver-ready conditions, `T` the requested witness terms and `E`
the variable-sort environment. The existing Z3 adapter builds its declarations
from `vars(C)` for satisfiability-only checks, or `vars(T, C)` for witness queries.
The projection restricts `E` to exactly that set. For satisfiability-only queries
it also replaces ignored `T` with an empty list. Therefore the effective formula,
referenced sorts and witness obligations remain the same under this adapter's
contract. In particular, Nat nonnegativity, structured-value validity predicates,
string restrictions and cross-condition variable coupling remain in force.

A SAT result for a partial solver-ready conjunction still only permits narrowing
to continue. Residual algebraic calls remain in the branch and must be unfolded;
a completed class still requires an independently checked ground witness. The
projection never infers that a stronger descendant constraint is SAT merely
because its ancestor was SAT. Prefix checks retain their existing partial-check
contract, including unknown when no solver-ready prefix exists.

Equivalent requests may now reach the same existing cache entry. That cache is
owned by one fixed algebra/solver configuration, bounded by entries and serialized
characters, and stores only complete SAT/UNSAT answers. Unknowns and errors are
not reused. Witness hits retain independent validation, and cancellation checks
remain active. Algebra definitions are not shared across incompatible contexts.

This argument assumes the existing query contract: a custom callback that gives
meaning to unused declarations or to terms in satisfiability-only mode is outside
that contract. Timed execution can still differ, and altered cache hits/query
order can affect representative choices. The change does not establish exhaustive
subuniformity, complete bug detection, or a machine-checked proof of the entire
implementation. Constructor unfolding and all residual frontiers are preserved.

## Profiling

The opt-in unfolding profile now separates `feasibilityCheckQueries` /
`feasibilityCheckMs` from `feasibilityWitnessQueries` / `feasibilityWitnessMs`.
These count requests and adapter time, including cache hits, rather than only
backend SMT calls. Witness time includes encoding, solving, model extraction,
independent validation and the optional preferred-value check; it is not a pure
model-extraction measurement.

`maxFeasibilityVariables` and `feasibilityVariableEntries` count declarations in
prepared narrowing feasibility-query metadata, including a request prepared just
before a deadline is detected. They do not count actual SMT declarations or the
separate prefix checks. The disabled-mode count is maintained incrementally so
the profiler does not repeatedly enumerate the growing map solely to measure it.
The benchmark's existing solver-cache counters show backend calls and hits.

## Reproduction

From `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-33-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-33-feasibility-query-projection.json
```

The matrix uses the existing recursive ADTs and inventory/workers/fulfilment APNs.
All 14 workloads, including lookup depths 6 and 7, run in both modes: 28 isolated
configurations and three trials each. Constructor disjointness, local overlap
metadata, ancestor proofs and the existing exact cache remain enabled in both
modes. Mode order alternates by workload. Each configuration initializes Z3 and
runs a trivial warm-up before its trials; medians include the colder first trial.
Tests/builds finish before the sequential benchmark run. Profiling is enabled in
both modes and included in reported times. Recursive cases retain a ten-second
derivation allowance, one second per query and 2,048 branch alternatives, except
explicit zero-time/branch-limit controls. APNs retain the previous harness limits.

## Results

All **84 trials** completed without runtime errors or child hard timeouts:
60 partial derivations, 6 fixed-spine frontier-resolved derivations and 18 selected
APN runs. Both modes agree on class counts, infeasible branches, recursive frontier
reason/depth histograms, overlap counts and unknown-intersection counts. All
**3,414 class witnesses** passed independent concrete evaluation. All 69 measured
JavaScript source hashes match this increment. Recorded 23 October 2026 UTC,
using Node 24.19.0 on Linux x64, AMD EPYC 9V74, 9 exposed logical CPUs.

Median selection time over three trials, milliseconds:

| Workload | Baseline | Projection enabled |
|---|---:|---:|
| list-16 | 166.66 | 127.18 |
| tree-9 | 1,013.21 | 194.52 |
| membership-12 | 394.87 | 409.63 |
| lookup-4 | 815.38 | 659.24 |
| lookup-5 | 1,512.14 | 1,575.21 |
| repeated-12 | 195.27 | 39.44 |
| membership-fixed-12 | 364.57 | 350.11 |
| lookup-branch-limit | 444.38 | 376.50 |
| list-time-limit | 0.62 | 0.67 |
| inventory-20 | 303.88 | 322.76 |
| workers-audit | 428.60 | 391.79 |
| fulfilment-20 | 689.45 | 519.51 |
| lookup-6 | 3,031.52 | 3,197.12 |
| lookup-7 | 6,688.39 | 6,457.79 |

The large gains occur where many intermediate feasibility requests have identical
conditions but previously differed in ignored terms or unused declarations:

| Workload | Backend calls before → after | Cache hits before → after | Median speedup |
|---|---:|---:|---:|
| list-16 | 33 → 17 | 0 → 16 | 1.31× |
| tree-9 | 297 → 24 | 0 → 273 | 5.21× |
| repeated-12 | 54 → 6 | 0 → 48 | 4.95× |
| fulfilment-20 | 51 → 39 | 13 → 25 | 1.33× |

Call/hit counts agree across all three trials of these configurations. For example,
tree total retains 23 completed classes and 126 recursive residuals. Its 24 backend
calls comprise the shared satisfiability-only check and the 23 separate witness
queries. A hit for the partial check does not skip equation unfolding or the
final ground-witness check. The repeated-total example similarly retains five
classes and seven residuals while sharing intermediate checks.

At lookup depth 7, maximum feasibility metadata falls from **1,653 declarations
to 16**, but both modes still make **698 backend calls**, with no cache hits.
The baseline already restricted actual SMT declarations to used variables;
this is a metadata reduction, not a 100-fold reduction of the SMT problem.
Median time falls only from 6.69 s to 6.46 s, and lookup depth 6 is slightly slower
in this run (3.03 s to 3.20 s). Membership and lookup depth 5 also show small
slowdowns. Three trials do not establish a general improvement for distinct-query
workloads; projection has its own traversal cost.

The new enabled-mode depth-7 counters show 255 satisfiability-only requests
(about **2.34 s**) and 254 witness-producing requests (about **2.79 s**), plus
ancestor-disjointness proofs (about **1.08 s**). These are adapter-time medians,
not isolated solve or extraction times. Both types of feasibility work matter;
further diagnosis should separate encoding/setup, solving and model handling
before selecting a more invasive optimization. The same 254 classes and 128
recursive residuals remain, with zero unknown intersections in both modes.

All **24 reference test replays passed**. First-trial mutant replays produced
**24 failing tests** and the same **two expected fulfilment stock-leak survivors**
from unobserved stock. Failure reasons and verdicts agree exactly between paired
modes; no replay errors occurred. Inventory has unchanged backend-call counts,
while workers saves one call. Their small timing differences should not be
interpreted as broad scalability evidence.

Raw [report](performance/increment-33-feasibility-query-projection.json) and
[JSONL records](performance/increment-33-feasibility-query-projection.json.jsonl)
retain every trial, configuration, counter, source hash and frontier sample.

## Validation and remaining work

The full SATEL suite passed: **550 tests in 52 suites** (50.921 seconds). After the
final profiling-counter addition, all 15 focused projection tests passed again
(2.888 seconds), and the production build passed (5.43 seconds), with the existing
dependency/browser, sourcemap and bundle-size warnings. The change to effective
query construction was already covered by the full run.

Tests compare captured baseline/projected requests and verify that the effective
conditions, used-variable sorts, witness terms and overlap/proof queries are
preserved. They compare classes, results, residuals and overlap verdicts for
recursive membership/lookup/repeated operations, including with the cache disabled.
Additional cases cover every basic sort, unconstrained witness outputs, shared
variables, Nat bounds, UTF-16 strings, graph references, prefix answer reuse,
unknown retries, cancellation and time/branch exhaustion. They also check that
projecting a request does not mutate the caller's request.

No new APN or ADT definitions are introduced: the benchmark deliberately uses the
existing examples as the baseline. Existing GUI generation uses the change without
any additional user-facing configuration. Custom recursive ADTs remain solver-side
examples; executable APN sorts remain Nat/Int/Bool/String/Pair/List.

This increment is limited to removing solver-irrelevant request data and enabling
existing exact reuse. It does not combine differently named variables, simplify
constraints, reuse weaker ancestor answers for stronger descendants, reuse Z3
solver stacks or memoize recursive narrowing. Distinct constraints still require
solver work; ground witnesses still require extraction and validation. The new
mode-specific timing counters support deciding which of those costs to address
next. Any later reuse of witnesses must check them against the entire current
query and preserve shared-variable and structured-value validity constraints.
