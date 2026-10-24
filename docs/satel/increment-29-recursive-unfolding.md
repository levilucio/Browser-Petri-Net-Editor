# Increment 29 — measuring recursive ADT subuniformity unfolding

24 October 2026. Branch: `codex/satel-public-methods`. Starting commit:
`83ec58c75e8ce81649b1f09ae5ca65305587076b`.

## Purpose and scope

The recent APN/HML performance gains did not establish that deep recursive
subuniformity derivation scales. This increment measures that derivation directly,
separating equation expansion, solver feasibility queries and pairwise class
intersection checks. It adds diagnostics and benchmark examples; it does not
change the selection algorithm, introduce a new cache, or claim complete coverage.

The main finding is that **pairwise disjointness checking is the first optimization
target in several recursive workloads**. Exact solver-query reuse has no hits in
this matrix. Memoizing recursive equation expansion alone would not remove the
largest measured cost in these cases.

## Examples and locations

The existing list and tree `total` goals in
[`solver-cases.js`](../../petri-net-app/tools/node/benchmarks/solver-cases.js)
remain the baseline. New solver-level specifications are in
[`src/satel/examples/recursive-adt/models.js`](../../petri-net-app/src/satel/examples/recursive-adt/models.js),
with a [usage guide](../../petri-net-app/src/satel/examples/recursive-adt/README.md):

- **List membership:** empty list, equality at the head, or disequality followed
  by recursive membership in the tail. Unknown-shape goals derive classes for
  the first hit and for reaching the end without a hit. A hit allows an arbitrary
  unused tail; classes are not just a partition by list length.
- **Tree lookup:** empty tree, equal key, smaller key/left recursion, larger
  key/right recursion. All are conditional defining equations over free
  constructors. No globally sorted-tree invariant is imposed: this is the
  specified traversal, not a verified search-tree data structure.
- **Repeated totals:** `twice(xs) = total(xs) + total(xs)`. Both calls share the
  same symbolic list, exposing repeated computation after constructor bindings.
- **Fixed membership spine:** supplied list structures of 4, 8 and 12 elements,
  with symbolic integer elements and search key. These distinguish known-shape
  solving from unknown-shape enumeration.

These custom ADTs are **not new executable APN place or method parameter types**.
They are not PNML nets and are not added to the GUI Examples menu. Existing APNs,
mutants and their files under `docs/satel/performance/models` stay in place.

## What the measurements mean

`deriveGenericSubdomains(goal, { profileUnfolding: true })` now returns optional
`unfoldingProfile` diagnostics. Without the option, the report shape is unchanged.
The profile records visited branches, peak pending branches, attempted/matched
rules, operation expansion counts, Boolean branching, deepest equation path,
solver requests by phase, and timings:

- `feasibilityMs`: solver-adapter time during narrowing, including witness
  extraction, independent checking and any cache overhead.
- `overlapSolverMs`: adapter time for pairwise class intersection queries.
- `equationExpansionMs`: freshening rules, matching/unifying patterns and building
  successor branches. This is a subset of the time outside the solver.
- `nonSolverMs`: total search time minus both adapter phases. It also includes
  substitution, traversal, witness bookkeeping and overlap-query construction;
  it is **not** a measurement of pure unfolding alone.
- `overlapPhaseMs`: the whole pairwise phase, including query preparation.

The benchmark additionally records exact class/frontier counts, frontier reason
and rule-path-length histograms, up to six residual examples and three class
examples, overlap unknowns, cache statistics and process RSS. A separate concrete
JavaScript evaluator checks every returned class witness for the measured
operations. This verifies those witnesses, not completeness of the derived set.

`maxDepth` counts defining-equation applications along a narrowing branch, not
constructor-tree height or APN sequence length. All recursive calls in a branch
share it. The branch allowance counts attempted equation alternatives and Boolean
alternatives, not just feasible classes.

The status `frontier-resolved` means no unresolved narrowing branches or unknown
overlap checks were reported. It does not replace `coverage: not-proved` with a
coverage theorem. Unknown overlap checks are reported as partial. Resource limits
remain unknown/residual outcomes, never proofs of infeasibility.

## Experiment

Reproduce from `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-29-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-29-recursive-unfolding.json
```

The [configuration](../../petri-net-app/tools/node/benchmarks/increment-29-cases.json)
contains 28 configurations with three trials each. It varies list/tree depth,
conditional branching, known versus unknown structure, and repeated calls.
Four cache-disabled configurations and explicit branch/time-limit controls are
included. Each configuration runs in an isolated sequential child, after separately
timed Z3 initialization and a trivial warm-up query. The first measured trial has
colder model/runtime caches; the table uses the median of all three trials.

Most cases allow 10 seconds of derivation, 1 second per solver query and 2,048
branch alternatives; two controls deliberately lower a limit. The parent uses a
45-second hard timeout per three-trial child. The internal time limit is checked
between operations, so cleanup/report construction can exceed it slightly.

The final matrix was run after tests/build finished, without competing test jobs.
The raw report records environment, baseline commit, dirty-worktree flag and
SHA-256 hashes of the measured JavaScript sources. Timings describe this host,
not guaranteed laptop performance. RSS includes Z3 initialization and retained
process state; it is not an incremental-memory measurement.

All **84 trials** completed without child hard timeouts or runtime errors:
75 were partial and 9 resolved their frontier (the three fixed-spine cases).
Independent evaluation passed for **1,029 returned class witnesses** across the
trials. All 66 recorded JavaScript source hashes match the committed sources.
Environment: Node 24.19.0, Linux x64, AMD EPYC 9V74; 9 logical CPUs exposed.

Selected results (milliseconds; each timing column is its own three-trial median):

| Workload | Classes | Residual branches | Total | Feasibility adapter | Overlap adapter | Other search work |
|---|---:|---:|---:|---:|---:|---:|
| list-4 | 4 | 1 | 68.0 | 44.1 | 22.4 | 1.2 |
| list-16 | 16 | 1 | 632.8 | 159.2 | 460.0 | 9.1 |
| tree-3 | 2 | 3 | 51.9 | 45.5 | 4.9 | 1.0 |
| tree-9 | 23 | 126 | 2,052.1 | 1,025.7 | 981.1 | 54.6 |
| membership-4 | 8 | 1 | 227.2 | 115.6 | 107.6 | 2.7 |
| membership-12 | 24 | 1 | 1,639.7 | 360.9 | 1,256.2 | 22.5 |
| lookup-3 | 14 | 8 | 774.5 | 274.8 | 492.0 | 7.4 |
| lookup-4 | 30 | 16 | 3,683.3 | 617.4 | 2,963.3 | 51.3 |
| lookup-5 | 62 | 32 | 10,087.6 | 1,158.5 | 8,729.1 | 194.8 |
| repeated-12 | 5 | 7 | 235.4 | 194.9 | 34.0 | 5.9 |
| membership-fixed-12 | 13 | 0 | 902.0 | 262.7 | 598.3 | 10.0 |

For **lookup at depth 5**, the 62 classes imply 1,891 pairwise checks. Between
928 and 999 checks per trial remained unknown when the total time allowance ran
out, in addition to the 32 unresolved recursion branches. The approximately
10-second result is a **budget stop**, not completed disjointness validation.
The unknown count varies with timing; no such unknown is interpreted as UNSAT.

Membership at depth 12 spends roughly 77% of median selection time in overlap
adapter calls; lookup at depth 4 spends roughly 80%. The explicit rule-expansion
loop takes less than 2 ms in both cases. This does not make all non-SMT work free:
other traversal, substitution and query-construction costs are recorded separately.

For list totals, depth 16 yields 16 classes and one residual tail. For tree totals,
depth 9 yields 23 classes and 126 residual branches. Those frontier counts describe
symbolic branches, not input counts, coverage percentages or failure probabilities.
Branching structures grow substantially faster than linear lists.

All enabled-cache trials recorded **zero exact-query hits**. The four disabled
controls agreed on class counts, frontier histograms and overlap verdicts with
their enabled counterparts. Disabled/enabled medians were 177/187 ms for list-8,
717/726 ms for membership-8, 3,443/3,683 ms for lookup-4 and 277/235 ms for
repeated-12. These short runs show timing variability and possible cache overhead;
they provide no evidence of saved solver work or a universal speed comparison.

The 32-alternative lookup control returned seven branch-budget residuals and two
depth residuals. The zero-time control returned one time-budget unknown and issued
no solver queries. Neither was recorded as successful exhaustive generation.

Raw artifacts: [full report](performance/increment-29-recursive-unfolding.json)
and [per-configuration JSONL](performance/increment-29-recursive-unfolding.json.jsonl).


## Next increment justified by this evidence

1. Add a conservative disjointness precheck that can prove constructor clashes
   without invoking SMT. Preserve the existing solver path whenever that check
   cannot establish disjointness. Compare every bypass against the old check on
   finite cases, including shared variables, arithmetic patterns and overlapping
   equations. Do not skip pairwise validation merely because rules have different
   names or constructors appear somewhere in their terms.
2. Measure branch-local variable declarations and query preparation: the current
   declaration map accumulates fresh variables across sibling branches and overlap
   checks. Remove irrelevant declarations only with sort/constraint/witness
   preservation tests. The SMT adapter already filters which symbols it declares; this proposal
   targets excess metadata copying and cache-key serialization, not a claim that
   every accumulated variable is currently declared to Z3.
3. Reassess recursive narrowing memoization after those costs are reduced. Safe
   reuse would need the algebra, substitutions, relevant conditions, variable
   scopes and remaining budgets. Unknown frontiers cannot be reused as complete
   answers. These runs alone do not justify a general semantic-equivalence cache.

Keep each change independently switchable for differential comparison. Compare
classes, residual frontiers and overlap verdicts as well as runtime. Deeper
exploration can expose more real classes, but neither these measurements nor a
cache establish the thesis' semantic subuniformity equivalence or monotonic fault
detection for every SUT.

## Verification

- 512 SATEL tests passed in 48 suites (41.508 seconds).
- Production build passed (6.64 seconds), with existing dependency/browser,
  sourcemap and bundle-size warnings.
- New tests check membership and tree lookup against independent finite concrete
  evaluation, profiling-on/off structural results, fixed-spine frontier resolution,
  repeated-total witnesses, and branch/time/solver-unknown controls.
- Profiling does not change queries or branch order. Its small timing overhead can
  affect which work fits immediately next to a wall-clock deadline; identical
  deadline-limited frontiers are not promised.
