# Increment 27 — cache comparison and inventory reservations

23 October 2026. Branch: `codex/satel-public-methods`. Starting commit:
`db91024207819e19c3cbd29bb879a54b8cd8960f` (increment 26).

## Reviewable result

This increment adds internal cache controls, opt-in profiling, differential
correctness checks, and an inventory/reservation example family. It does **not**
introduce another result cache, change default limits, or remove existing caches
from normal GUI execution.

All new example sources and 15 PNML files are in
[`petri-net-app/src/satel/examples/inventory`](../../petri-net-app/src/satel/examples/inventory/README.md).
This maps to Levi's requested Windows folder beneath
`C:\Users\levil\cursor\Browser-Petri-Net-Editor\petri-net-app\src\satel\examples`.
There are three references (5, 10 and 20 pairs) and four mutants per reference.
They are also available directly in the GUI's **Examples** search.

The reference starts with stock, permit tokens and idle warehouses. A five-pair
cycle reserves `q`, inspects the reservation, cancels, observes restored stock and
checks readiness. Reservation consumes two equal permit tokens at distinct indices.
Two enabled rules choose different acceptance routes. Cancellation must work for
both, returning stock and both permits. Optional lists retain `(route, permit)`
audit history. The model uses Int, Nat, Bool, Pair and List; it does not add custom
ADT support to APN simulation.

The two authored equation classes are `1 <= q <= 2` and `3 <= q <= 5`. One shared
quantity instantiates the entire sequence and HML requirement. The latter requires
a possible reservation and recovery after **every** enabled reservation outcome.
The 20-pair example visits four warehouses; its additional HML obligation checks
two recovery rounds. Sequence length is not HML modal depth.

Each reference produces two admitted tests. Frozen reference suites detect all
four matching mutants: omitted stock debit, missing cancellation on one route,
wrong reserved quantity, and lost permit. Both reference replay and mutant replay
are checked; replay errors do not count as fault detection. With larger permit
inventories, losing a permit may remain unobserved while another matching pair is
available. Mutation coverage is specific to the supplied configurations.

## Internal comparison controls

`options.hmlCaches` independently disables five reuse mechanisms by setting the
corresponding entry to `false`:

| Entry | Reuse controlled |
|---|---|
| `ruleEffects` | Completed guard/output effects for a rule and input binding context |
| `bindingPrefixes` | Previously enumerated input-arc prefixes |
| `expressions` | Typed expression preparation and evaluation results |
| `operations` | Bounded algebraic operation expansion results |
| `formulaStates` | Formula-node/full-marking results |

Omitted entries remain enabled. No switches are exposed in the GUI. The seven
benchmark modes are all enabled, each individually disabled, and all five disabled.
“None” means these five HML caches only: shared term graphs, compiled-model reuse
and concrete replay caches remain in place. This is not a reconstruction of an
early historical implementation.

Effect-only mode still traverses/stores a trie for complete-result lookup, but
recomputes bindings from the root on a miss. It therefore isolates prefix *reuse*,
not all memory used by the prefix data structure. All caches remain local to one
construction and incomplete effect iterators are never published as complete.

`options.profileHmlCaches` records key construction and lookup time, expression
preparation/evaluation, binding enumeration and effect computation, alongside
counts of key characters and retained records. Timings are inclusive wall time:
effect computation includes expression work, so these categories must not be
summed as disjoint CPU costs. Key characters are cumulative strings processed,
not retained bytes. Record counts and process RSS are not an isolated measurement
of cache memory. Exhausted constructions currently do not return partial profiles.
Normal runs do not take a performance-clock timestamp at every cache access, but
still execute the diagnostic wrapper calls.

The benchmark's separate query profiler counts exact JSON-structural duplicates
within a fixed-algebra solver instance. It does not reuse answers or identify
logically equivalent queries with different syntax.

## Correctness evidence and proof boundary

The reusable finite-domain harness is
`tools/node/benchmarks/hml-cache-comparison.js`. For each valuation it independently
evaluates the concrete HML property, then compares that truth with ground evaluation
of the symbolic conditions in all seven modes, for both expected truth values.
An incomplete concrete comparison throws instead of reporting agreement. It does
not compare arbitrary Z3 witness choices.

New regression checks cover:

- Inventory quantities below, within and above available stock; the existing
  worker example with Pair parameters, including both Bool tags.
- Complete successor sets against concrete multiset firing: permuted tokens,
  duplicates, shared variables across arcs, changing later inputs, changing method
  arguments, empty markings and accumulated outputs. Comparison retains each
  marking's token multiplicity while deduplicating identical semantic edges.
- Observation complements, disabled guards, both HML polarities, unsafe list
  operations and overflowing outputs. An unsafe computation cannot become an
  accepted positive or negative witness.
- Cancellation, work exhaustion, and stopped effect iterators. Existing increment
  26 interruption and increment 25 unfolding/dependency tests remain in the suite.
- GUI example selection/loading and all saved PNML files, compared after the same
  importer normalization used by the application.

These tests support, but do not prove, the preservation argument. The intended
local obligations are unchanged: fixed typed rule/algebra and equal dependency
keys give equal results including definedness; cached effects are applied to the
current full marking; complete formulas retain every eligible branch. Completed
cache hits may replace recomputation, not incomplete universal obligations.

The uncached symbolic path shares algorithms with the cached one; concrete replay
provides an additional implementation comparison, not a formal semantic proof.
Finite valuation checks are not exhaustive over infinite ADTs. Neither these tests
nor the benchmark establish global absence of false positives/negatives, thesis
equivalence, or monotonic bug detection across different generated representatives.
Existing saved suites should remain regression inputs when selection changes.

## Paired cache-mode measurements

The timing matrix has six workloads, seven cache modes and three trials per mode:
**126 trial records**. Results: **108 selected, 18 unresolved**, no runtime-error
outcomes and no child hard timeouts. Selected trials passed 192 reference-test
admissions and independent reference replays. First-trial mutation checks produced
128 failing test replays, with no mutant replay errors. Counts include repetitions
of the same fault families, not 128 distinct bugs.

| Workload | All caches, median selection | Five caches disabled | All-cache work units |
|---|---:|---:|---:|
| Inventory, 5 pairs | 96.85 ms | 104.40 ms | 179 |
| Inventory, repeated permits, 10 pairs | 195.69 ms | 354.36 ms | 526 |
| Inventory, same permits plus audit | 183.48 ms | 333.95 ms | 1,389 |
| Inventory, 20 pairs / 4 warehouses | 677.97 ms | 707.42 ms | 832 |
| Workers, 4 workers / 4 rounds / audit | 405.23 ms | Unresolved | 9,398 |
| Workers, 8 workers / 8 rounds / no audit | 158.19 ms | Unresolved | 2,016 |

Unresolved rows hit the 10,000-work construction limit; their shorter runtimes
must not be compared as successful speedups. Disabling rule effects, prefixes or
expressions individually also prevents the audit-worker case from resolving.
Disabling full-marking formula reuse prevents the merged-worker case from resolving.

All inventory configurations resolve in every mode. Some individual removals are
faster in these small samples: the repeated-permit model takes 153.52 ms without
prefix reuse versus 195.69 ms with everything enabled. This is evidence to measure
overhead, not grounds to disable a cache globally. Only three trials were taken;
there are no statistical significance or general speedup claims.

Each configuration runs in a separate sequential child. First trials have cold
model caches; subsequent trials reuse process caches. Mode order reverses on
alternating workloads to reduce a simple fixed ordering bias. No tests or builds
run concurrently with the measurements. Timed runs have detailed cache/query
profiling disabled. Initialization, admission and replay have separate timings.

Environment: Node 24.19.0, Linux x64, AMD EPYC 9V74, nine reported logical CPUs.
This differs from increment 26's host, so cross-report timing comparisons are not
an optimization claim. Raw records include source SHA-256 hashes and limits.
Defaults remain 1 second per SMT check, 4 seconds derivation/HML construction,
5 seconds sequence search, 256 narrowing branches, 100,000 sequence work units,
10,000 HML work units, 2,000 formula/state visits and 100,000 stored expression
entries. Each child has a 45-second hard timeout.

Peak process RSS with all caches ranged from 223.41 to 359.32 MiB across these
three-trial processes, including initialization, admission and mutations. It does
not establish how much memory a particular cache retains.

Raw data: [timing JSON](performance/increment-27-cache-comparison.json),
[timing JSONL](performance/increment-27-cache-comparison.json.jsonl),
[profile JSON](performance/increment-27-cache-profile.json),
[profile JSONL](performance/increment-27-cache-profile.json.jsonl).

## What to optimize next

Six separate single-trial profiling runs all selected and passed reference replay.
The clearest new candidate is the **solver boundary in longer sequences**:

| Profiled workload | Solver calls | Exact duplicate calls | Solver adapter time / selection time |
|---|---:|---:|---:|
| Inventory, 5 pairs | 10 | 0 | 229.86 / 263.41 ms |
| Inventory, repeated permits | 14 | 2 | 281.61 / 335.42 ms |
| Inventory, audit | 14 | 2 | 298.70 / 377.47 ms |
| Inventory, 20 pairs | 70 | 48 | 748.13 / 874.23 ms |
| Workers, audit | 9 | 0 | 321.26 / 510.24 ms |
| Workers, merged | 9 | 0 | 212.06 / 262.35 ms |

Adapter time includes encoding, solving, extraction and independent checking.
Duplicate counts do not quantify their individual cost or promise that 48/70 of
the time is recoverable. Nevertheless, the 20-pair case provides a concrete target
for a bounded, request-local exact-query cache. It should preserve variables,
sorts, algebra, query terms/conditions and witness requirements, with independent
witness validation retained. Unknown, timeout and cancellation results must not
be turned into SAT/UNSAT evidence. Compare against this suite before enabling it.

The worker profiles have no exact repeated SMT queries; that cache would not solve
their history growth. Further HML key/term reuse and genuinely distinct branch
growth require separate work. No state/history abstraction is introduced here.

## Reproduction and laptop review

From `petri-net-app`:

```sh
node tools/node/benchmarks/cache-cases.js
node tools/node/benchmarks/export-inventory.js
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-27-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/local-cache-comparison.json
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-27-profile-cases.json --runs 1 --hard-timeout-ms 45000 --out ../docs/satel/performance/local-cache-profile.json
npm test -- --runInBand src/__tests__/satel
npm run build
```

In the GUI, search **Inventory** in **Examples**, load a reference, inspect its
intention, generate tests and replay that frozen suite on the matching mutants.
Start with 5 pairs, then try 10 and 20. No benchmark switches need to be set in
the interface. The controls and profiler are for internal experiments only.

Verification: the full SATEL suite passed **491 tests in 46 suites** (37.370 s).
The production build passed in **5.71 s**, with the existing large-chunk warning.
