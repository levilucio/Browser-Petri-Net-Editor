# Increment 32 — reusable equation-branch disjointness proofs

Branch: `codex/satel-public-methods`. Starting commit:
`50b131371ab2a6e4f1e34db26d6fbaa3bbd80d2f`.

## Change

Subuniformity unfolding can now prove that two equation alternatives describe
incompatible input regions once, then reuse that result for their completed
descendants. This reduces repeated SMT intersection queries for classes that share
constructor shapes but differ in equation conditions. It follows the constructor
clash shortcut (increment 30) and local query metadata (increment 31).

The optimization is enabled by default in the common derivation path used by the
GUI. No new editor controls or saved model fields are needed. The original
leaf-pair solver check remains the fallback. Set `branchDisjointness: false` in
API/benchmark options for the comparison baseline. `maxBranchProofs` defaults to
256 distinct split-pair attempts per derivation (accepted range 0–2048); reaching
the cap falls back to leaf checks. Setting the cap to zero suppresses proof
queries but still builds lineage, unlike disabling the feature entirely.

Implementation:
[BranchDisjointness.js](../../petri-net-app/src/satel/core/BranchDisjointness.js),
called from
[GenericSubuniformity.js](../../petri-net-app/src/satel/core/GenericSubuniformity.js).

## What is proved

For each actual equation split, record the substituted **original goal argument
patterns** and the solver-ready conditions of each alternative. Conditions still
containing algebraic calls or undefined terms are omitted from this snapshot;
this deliberately enlarges the region. If an input pattern itself still contains
such a term, no region proof is attempted for that alternative. Descendants add
constraints or specialize patterns, so their input domains are subsets of these
ancestor regions.

Write an alternative's region as:

\[
R_i = \{\mathbf{x}\mid \exists\mathbf{u}_i.\;
\mathbf{x}=\mathbf{p}_i(\mathbf{u}_i)\land C_i(\mathbf{u}_i)\}.
\]

The query conjoins both alternatives' conditions and equality of their argument
patterns. All variables on the right are independently renamed, preserving sorts.
Only an **UNSAT** response proves that the two projected input regions are
disjoint. For descendants \(D_i\subseteq R_i\), \(D_j\subseteq R_j\), this implies
\(D_i\cap D_j=\varnothing\). Output values are not part of the intersection:
different operation results for the same input can still represent overlapping
classes.

The independent existential scopes matter. Conditions `h < 0` and `h >= 0` do
not distinguish input regions when `h` is an unconstrained internal variable.
Likewise, opposite signs of `h` need not distinguish an input equal to `h * h`.
Equating variables merely because their names match would be unsound. The new
queries equate input patterns instead. Proof reuse is tied to actual split
identity and alternative indexes, not rule names or matching condition text.

Snapshots and lineage exist only inside one derivation. A proof is attempted
lazily when an intersection is encountered and the alternatives have more than
one descendant pair between them. The result is reused within that split pair.
SAT, unknown and optional proof errors are remembered to avoid retrying the same
speculative query, but never suppress descendant intersection checks. Cancellation
propagates; expired time budgets retain the existing unknown behavior. Constructor
clash proofs still run first. Boolean guard/result splitting inherits equation
lineage but does not create its own certificates in this increment. Witness-only
existential search does not use this mechanism.

This is a local preservation argument, conditional on the solver's UNSAT answers,
the supported term semantics and correct ancestor snapshots. These are not
independently checked proof certificates or a mechanized correctness proof of the
tool. Bounded unfolding remains incomplete; this does not prove the semantic
subuniformity relation from the thesis. Different timing and query order can
change unknown outcomes or chosen representatives. It does not guarantee monotonic
bug detection or eliminate all false negatives of bounded test selection.

## Measurement and reproduction

From `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-32-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-32-branch-disjointness.json
```

The matrix reuses the 12 workloads from increment 31 in paired modes, with
constructor disjointness and local query variables enabled in both. Enabled-only
lookup depths 6 and 7 extend the stress range. Modes alternate order across the
paired workloads; each configuration gets a separate sequential child process,
Z3 initialization and a trivial warm-up. Three trials run in each process. Medians
include the first, colder trial. Tests and build finished before measurements.
All configurations enable profiling, so its cost is included. Time allowances
remain ten seconds for recursive derivation and one second per solver query,
with 2,048 branch alternatives except the explicit limit controls. APNs retain
the existing harness limits. Peak RSS includes initialization and is not incremental
workload memory.

The opt-in unfolding profile adds `branchProofQueries`, `branchProofMs`,
`branchDisjointPairs`, `branchProofCacheHits` and `branchProofStatuses`.
`branchDisjointPairs` counts leaf intersections bypassed by proved ancestor
regions. Cache hits include remembered unsuccessful attempts. The existing
`overlapQueries` counts only actual fallback leaf queries; proof queries are
reported separately. `nonSolverMs` excludes both kinds of solver adapter time.

## Results

All **78 trials** completed without runtime errors or child hard timeouts:
54 partial derivations, 6 fixed-spine frontier-resolved derivations and 18 selected
APN runs. The paired modes have the same class counts, recursive frontier reason
and depth histograms, and infeasible-branch counts. All **2,274 class witnesses**
passed the independent concrete evaluator. All 68 measured JavaScript source
hashes match the committed implementation. Environment: Node 24.19.0, Linux x64,
AMD EPYC 9V74, 9 exposed logical CPUs. Recorded 23 October 2026 UTC.

Median selection time over three trials, milliseconds:

| Workload | Baseline | Branch proofs enabled |
|---|---:|---:|
| list-16 | 162.83 | 167.14 |
| tree-9 | 1,010.28 | 1,011.72 |
| membership-12 | 947.18 | 470.29 |
| lookup-4 | 2,595.51 | 702.28 |
| lookup-5 | 10,052.16 | 1,497.80 |
| repeated-12 | 200.11 | 201.77 |
| membership-fixed-12 | 871.18 | 352.64 |
| lookup-branch-limit | 676.27 | 365.20 |
| list-time-limit | 0.72 | 0.71 |
| inventory-20 | 290.84 | 325.92 |
| workers-audit | 397.53 | 431.88 |
| fulfilment-20 | 663.84 | 685.82 |
| lookup-6 | — | 3,322.01 |
| lookup-7 | — | 6,400.20 |

Membership at depth 12 replaces 132 leaf queries with 11 ancestor proof queries,
for about a **2.0×** median improvement. Lookup at depth 4 replaces 352 leaf queries
with 21 proofs, for about **3.7×**. Fixed-spine membership replaces 77 of its 78
leaf queries with 11 proofs. List/tree totals and repeated totals already have
all intersections decided by constructor clashes; no new proof queries are made,
and small timing differences do not demonstrate a benefit.

At lookup depth 5, the baseline still reaches its ten-second allowance, leaving
**401–502 unknown intersections** across trials. With branch proofs, 45 proof
queries discharge 1,664 leaf intersections, and all remaining intersections are
handled by constructor clashes. All three enabled runs have zero unknown
intersections, while retaining the same 62 classes and 32 recursive residuals.
The timing comparison is against a time-limited baseline, not the baseline's
unknown eventual completion time.

Depths 6 and 7 are enabled-only stress cases, not paired speedup measurements:

| Lookup depth | Completed classes | Recursive residuals | Ancestor proof queries | Leaf pairs bypassed | Unknown intersections |
|---|---:|---:|---:|---:|---:|
| 6 | 126 | 64 | 93 | 7,296 | 0 |
| 7 | 254 | 128 | 189 | 30,720 | 0 |

The remaining pairs are constructor-disjoint, with no fallback leaf queries.
At depth 7, median feasibility-query time is about **5.19 s**, ancestor-proof time
**1.01 s**, and other unfolding work **0.21 s**. The bottleneck has largely moved
to feasibility checks and the growing number of branches. These depth numbers
count rule applications along a derivation, not a bound on every input tree's
height. Every open recursive case still reports coverage as `not-proved`.

The APN medians are slightly slower in this run; their small overlap workloads
provide little opportunity for reuse. Three trials do not establish the cause or
a general regression/speedup. All **24 reference test replays passed**. Mutant
replays, run on the first trial of each configuration, yielded the same **24 test
failures** and **two expected stock-leak survivors** on fulfilment's unobserved
stock. There were no replay errors or changed mutation verdicts. The explicit
zero-time and branch-budget controls retain their unknown/residual results.

Raw [report](performance/increment-32-branch-disjointness.json) and
[JSONL records](performance/increment-32-branch-disjointness.json.jsonl) preserve
all trials, configuration limits, counters, source hashes and frontier samples.

## Validation and limits

All **535 SATEL tests passed in 51 suites** (52.257 seconds), and the production
build passed (6.05 seconds), with the existing dependency/browser, sourcemap and
bundle-size warnings. The new tests compare enabled/disabled class patterns,
conditions, results, rule provenance, residuals, infeasible branches and overlap
verdicts. They cover recursive membership/lookup, complementary and overlapping
compound guards, nondeterministic operation results, independent hidden variables,
non-injective inputs, unknown/error/SAT fallback, zero and exhausted proof
allowances, expired deadlines and cancellation. Mechanism-specific tests from
increments 30 and 31 disable branch proofs to isolate their original query-count
comparisons.

This increment does not reduce the number of generated classes or erase recursive
residuals. It still visits every completed class pair, and ancestor lookup also
costs time. Only successful ancestor proofs amortize solver work. Overlapping
regions, weak projected constraints and one-off intersections may receive no
benefit; unsuccessful speculative queries add bounded overhead. The proof-attempt
cap bounds that cache, while lineage/snapshot storage remains dependent on the
bounded unfolding tree.

The next useful target is repeated feasibility work as recursive depth increases,
which now dominates the deeper lookup measurements. Pair traversal remains
quadratic and could later use the proved branch separation to skip whole blocks.
Any such shortcut must preserve reporting of genuine overlaps and unknowns. Resumable unfolding and general narrowing memoization remain separate
increments: neither is implemented here. Custom recursive examples still exercise
the solver-side ADT path; executable APN sorts remain Nat/Int/Bool/String/Pair/List.
