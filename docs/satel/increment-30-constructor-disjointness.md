# Increment 30 — constructor disjointness before SMT

24 October 2026. Branch: `codex/satel-public-methods`. Starting commit:
`f6247f100f8b818757907aa1287610a3f093eca3`.

## Change

Subuniformity class intersection checks now first look for an aligned clash
between free constructors. For example, `End()` and `More(x, xs)` cannot describe
the same argument. Neither can `Fork(End(), xs)` and `Fork(Leaf(n), ys)`.
A proved clash skips that pair's variable renaming, constraint construction and
solver query. If the check cannot prove disjointness, the existing SMT check runs.

The default is enabled. `{ constructorDisjointness: false }` retains the old path
for differential tests and benchmarks. There are no new GUI settings; the shared
class-derivation path used by the GUI benefits automatically. This does not add
custom executable APN sorts, deepen recursive unfolding or change intentions.

Implementation: [ConstructorDisjointness.js](../../petri-net-app/src/satel/core/ConstructorDisjointness.js),
called by [GenericSubuniformity.js](../../petri-net-app/src/satel/core/GenericSubuniformity.js).
The iterative check examines constructor patterns only. Variables, primitive
values/expressions, operation calls, unknown constructor names and malformed
constructor arities do not provide a proof. It does not unify shared variables
or infer disjointness from rule names or conditions.

## Preservation argument and limits

The implementation's constructor semantics are free, typed constructors encoded
as algebraic datatypes in Z3. For equal-sort constructor terms:

1. Distinct constructors cannot denote the same value.
2. Equal constructor applications can be equal only if corresponding arguments
   are equal. Thus a recursively established clash in one aligned child suffices.
3. A class intersection requires equality of every corresponding goal argument.
   A clash in any argument makes the intersection empty, regardless of additional
   conditions restricting the two classes.

The precheck implements only these sufficient rules. A false return means
"no proof; use the solver", not "the classes overlap". It does not reason beneath
arithmetic or operation calls. Independent class variable scopes need no renaming
for this proof because variables are treated as opaque. The original solver path
still renames variables before checking all other intersections.

This argument relies on **free constructors**, not arbitrary equational quotients
of constructor terms. It is a local preservation argument with regression tests,
not a machine-checked proof of the whole tool or the thesis' semantic partitions.

Class enumeration, candidate witnesses and unresolved recursion branches are
unchanged by this optimization. Under adequate budgets, intersection verdicts
should agree with the old path. With a time limit, saved work may turn unknown
intersection checks into definitive answers; the exact unknown set can differ.
The precheck respects the existing derivation deadline and never interprets an
unknown solver answer as UNSAT. It does not prove exhaustive coverage or guarantee
monotonic bug discovery when selected representatives or resource limits differ.

## Measurements

The experiment reuses increment 29's recursive examples and the existing inventory,
worker and fulfilment APNs. Enabled/disabled configurations alternate order across
workloads, with three trials each. Each configuration uses an isolated sequential
child after Z3 initialization and warm-up. No tests or build run concurrently with
the final matrix. Timings include the existing opt-in diagnostic overhead.

Additional `unfoldingProfile` counters are `overlapPairs`,
`constructorDisjointPairs`, and `constructorCheckMs`; `overlapQueries` continues to
count actual solver-adapter calls. Pair counts include pairs left unknown by a
deadline, so proofs plus queries need not equal all pairs in a limited run.

Reproduce from `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-30-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-30-constructor-disjointness.json
```

All **72 trials** finished without runtime errors or child hard timeouts:
48 partial derivations, 6 fixed-spine frontier-resolved derivations and 18 selected
APN runs. Every paired configuration retained the same class counts and recursive
frontier histograms. All **1,134 class witnesses** passed independent concrete
evaluation. All 67 measured JavaScript source hashes match this increment.
Environment: Node 24.19.0, Linux x64, AMD EPYC 9V74, 9 exposed logical CPUs.

Median selection time over three trials (milliseconds):

| Workload | Disabled | Enabled | Constructor proofs / all pairs | Interpretation |
|---|---:|---:|---:|---|
| list-16 | 626.37 | 162.07 | 120 / 120 | Same 16 classes, 1 residual |
| tree-9 | 2,049.80 | 1,022.37 | 253 / 253 | Same 23 classes, 126 residuals |
| membership-12 | 1,639.95 | 1,022.30 | 144 / 276 | Same 24 classes, 1 residual |
| lookup-4 | 3,466.56 | 3,153.45 | 83 / 435 | Same 30 classes, 16 residuals |
| repeated-12 | 236.15 | 200.09 | 10 / 10 | Same 5 classes, 7 residuals |
| membership-fixed-12 | 940.80 | 966.25 | 0 / 78 | No constructor clashes; no gain |
| lookup-branch-limit | 966.00 | 684.09 | 64 / 120 | Same 9 residual branches |

This is approximately **3.9× faster** for list totals, **2×** for tree totals, and
**1.6×** for membership. Solver calls are eliminated entirely from overlap checking
in the list/tree total cases. Both still have unresolved recursive frontiers;
these speedups do not mean complete partition enumeration.

At lookup depth 5, both modes hit the 10-second allowance with 62 classes and 32
recursive residuals. Baseline trials leave 934–978 intersection checks unknown;
optimized trials leave 872–908 unknown. The optimization makes more intersection
verdicts available in these runs, but does not finish the task. Timing determines
where the loop stops; no fixed-budget monotonicity theorem is claimed.

The supplied 12-element membership spine has identical constructor shapes in all
13 classes, so all 78 intersections still reach Z3. It measured 941 ms disabled
versus 966 ms enabled. Three trials are insufficient to separate small overhead
from ordinary timing variation; there is no speedup claim for this case.

Existing APN baselines also have little constructor-disjointness work. Inventory
medians were 299/349 ms (disabled/enabled), workers 434/404 ms and fulfilment
756/713 ms. These mixed times are not evidence of a general APN speedup. Across
both modes, **24 reference replays passed** and mutants produced **24 failing tests**
with the same **two expected stock-leak survivors** (the existing unobserved-stock
limitation). There were no replay errors or newly missed expected mutations.

The zero-time and branch-limit controls retained their unresolved results. No
budget stop was reported as exhaustive selection or proof of infeasibility.

Raw [report](performance/increment-30-constructor-disjointness.json) and
[JSONL records](performance/increment-30-constructor-disjointness.json.jsonl)
include all trials, resource limits, counters and residual samples.


The loop still examines pairs of classes, so its worst-case pair count remains
quadratic. This increment replaces some expensive solver checks with cheap proofs;
it does not remove genuine recursive branching or guarantee a speedup when
constructor patterns are compatible.

## Verification and next work

The regression tests compare optimized and baseline class reports, witnesses and
frontiers for membership, lookup and repeated totals. A finite symbolic constructor
corpus checks every precheck bypass against the original Z3 equality query. Tests
also cover nested clashes, shared variables, differing primitive values, arithmetic
patterns, opaque operations, overlapping equations and unknown overlap results.
These are finite checks, not exhaustive verification over all specifications.

All **518 SATEL tests** passed in 49 suites (41.001 seconds). The production build
passed in 5.99 seconds with the existing dependency/browser, sourcemap and
bundle-size warnings. No GUI workflow or saved-model format changes were needed.

The next candidate is reducing irrelevant variable metadata accumulated during
pairwise checks, followed by measuring conditional sibling-class disjointness.
Any extra proof rules should preserve the same conservative fallback. General
recursive narrowing memoization remains a separate decision: its keys must include
conditions, substitutions, scopes and remaining allowances, and its performance
benefit must be measured rather than assumed.
