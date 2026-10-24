# Increment 31 — local variable metadata for overlap queries

24 October 2026. Branch: `codex/satel-public-methods`. Starting commit:
`d4064d4851ea46fbe41c91e4c2a6020db9050055`.

## Change

Each class intersection query now carries only the variable declarations referenced
by its terms and conditions. Variables freshened for the right-hand class stay local
to that pair. Previously they accumulated in the shared declaration map and were
copied/serialized into later, unrelated overlap queries.

This is enabled by default in the common derivation path, including GUI generation.
`{ overlapQueryVariables: false }` restores the previous behavior for comparisons.
Constructor disjointness from increment 30 remains enabled in both benchmark modes.
No new GUI option or saved model format is introduced.

The SMT adapter already declares only referenced symbols. This increment therefore
reduces metadata copying, exact-query cache keys and retained answers' associated
keys; it does **not** reduce the mathematical conditions sent to Z3 or claim that
all accumulated metadata variables were previously SMT declarations.

Implementation: [GenericSubuniformity.js](../../petri-net-app/src/satel/core/GenericSubuniformity.js).
The existing enumeration and witness-query paths are unchanged. The new optional
profile fields `maxOverlapVariables` and `overlapVariableEntries` count declarations
in prepared overlap-query metadata, including queries prepared immediately before
a deadline check. They are not counts of actual Z3 declarations or solver calls.

## Preservation argument

For an overlap query with terms T, conditions C and declaration environment E,
let V be the variables occurring in T or C. The new environment is E restricted
to V, including the pair's fresh right-hand variable names with their original
sorts. Terms, conditions, witness mode, algebra and variable freshening remain
unchanged. Every referenced variable therefore has the same sort and scope.
The current backend consults declarations for referenced variables; discarded
entries cannot affect this query's formula. Removing declarations does not remove
sort constraints on retained Nat or structured values.

The argument assumes well-formed queries and this solver contract. A custom solver
callback that assigns meaning to unused declarations is outside that contract.
Exact-cache keys can change because irrelevant metadata is absent, but equality
of accepted keys still identifies the same query within its fixed algebra/settings.
Unknown responses, cancellation and resource-limit semantics remain unchanged.

This is a local correctness argument supported by differential tests, not a
machine-checked proof of the complete tool. Wall-clock limits can still produce
different sets of unknown intersections. These changes do not prove exhaustive
subuniformity or guarantee monotonic fault detection across generated suites.

## Experiment

Reproduce from `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-31-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-31-overlap-query-variables.json
```

The matrix reuses increment 30's recursive examples and inventory, workers and
fulfilment APNs: 12 workloads, enabled/disabled, three trials per configuration.
Modes alternate order across workloads. Each configuration runs in its own
sequential child after separately timed Z3 initialization and a trivial warm-up
query. Reported medians include all three trials, including the colder first one.
Tests and builds finish before the benchmark starts. Opt-in profiling is enabled
in both modes, and its cost is included. A preliminary run exposed overhead from
recounting the old growing declaration map. The final profiler maintains that
count incrementally; the reported matrix is rerun after this correction. No semantic cache or guard-disjointness
optimization is introduced in this increment.

Most recursive workloads allow ten seconds of derivation, one second per solver
query and 2,048 branch alternatives. Explicit zero-time and branch-limit controls
remain. APN workloads retain the harness's existing limits. RSS is a process-level
measurement including initialization, not incremental allocation.

All **72 trials** finished without runtime errors or child hard timeouts:
48 partial derivations, 6 fixed-spine frontier-resolved derivations and 18 selected
APN runs. Class counts and recursive frontier histograms agree between paired
modes. All **1,134 class witnesses** passed independent concrete evaluation.
All 67 measured JavaScript source hashes match this increment. Environment:
Node 24.19.0, Linux x64, AMD EPYC 9V74, 9 exposed logical CPUs.

Median selection time over three trials (milliseconds). Variable counts are
maximum declarations in prepared overlap-query metadata, not Z3 declarations:

| Workload | Baseline ms | Optimized ms | Baseline variables | Optimized variables |
|---|---:|---:|---:|---:|
| list-16 | 174.47 | 177.22 | 0 | 0 |
| tree-9 | 1,012.64 | 998.06 | 0 | 0 |
| membership-12 | 1,019.71 | 953.81 | 922 | 27 |
| lookup-4 | 3,183.74 | 2,800.07 | 2,723 | 20 |
| lookup-5 | 10,093.69 | 10,053.59 | 15,830 | 24 |
| repeated-12 | 197.75 | 195.61 | 0 | 0 |
| membership-fixed-12 | 874.78 | 839.43 | 1,118 | 26 |

Membership at depth 12 is about **6% faster**, and lookup at depth 4 about **12%
faster** in these medians. Metadata reduction is much greater: 922 to 27 variable
entries for membership, and 2,723 to 20 for lookup at depth 4. The fixed membership
spine improves by about 4%. Three trials do not establish a universal speedup.

At lookup depth 5, both modes still stop at the ten-second allowance with 62
classes and 32 recursive residuals. Baseline runs leave **917–969** pairwise checks
unknown; optimized runs leave **401–459** unknown. More intersections are decided
within the allowance, but this remains an incomplete derivation. The baseline's
15,830-variable maximum includes metadata prepared for deadline-skipped checks;
it is not a claim that a query with that many symbols reached Z3.

List/tree totals and repeated totals have zero remaining overlap queries after
increment 30's constructor proofs. Their small timing differences are noise for
this optimization, not saved solver work. The zero-time and branch-budget controls
retain their unknown/residual outcomes.

The APN baseline medians (disabled/enabled) are inventory 281/299 ms, workers
394/438 ms and fulfilment 748/673 ms. Their overlap work is tiny, so these mixed
measurements support no general APN speedup claim. Across both modes, all **24
reference replays passed**, and mutants produced **24 failing tests** with the same
**two expected stock-leak survivors** from unobserved stock. No replay errors or
newly missed expected mutations occurred.

Raw [report](performance/increment-31-overlap-query-variables.json) and
[JSONL records](performance/increment-31-overlap-query-variables.json.jsonl)
retain all trials, limits, counters and residual samples.


## Validation

Differential tests capture the actual queries in both modes and verify identical
terms, conditions and witness modes, and identical sorts for every referenced
variable. Enumeration queries retain their complete prior metadata. Tests compare
classes, residual frontiers, overlap verdicts and sort behavior for recursive
membership/lookup, all six basic sorts, overlapping equations, shared variables
across arguments, solver-unknown and time-limit controls. Concrete representatives
need not be identical across independent Z3 instances; their validity is checked
by the existing witness validation and independent benchmark evaluators.

All **523 SATEL tests** passed in 50 suites (45.751 seconds). The production build
passed with the existing dependency/browser, sourcemap and bundle-size warnings.
After replacing the profiling recount with an incremental counter, the five
focused tests (including checks against captured query sizes) and the production
build were rerun successfully. The semantic query-construction code was unchanged
by that diagnostic correction.

## Remaining work

This change does not reduce the number of nontrivial pairwise intersections.
Constructor-compatible classes that differ by conditions still need SMT checks.
A next candidate is proving disjointness of conditional sibling classes while
respecting their variable bindings, with the original solver as the fallback and
differential baseline. General recursive narrowing memoization still requires
careful treatment of conditions, substitutions, scopes and remaining budgets.
