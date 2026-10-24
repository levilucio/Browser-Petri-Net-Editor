# Increment 36 — SMT declaration projection and a shared-context regression

Date: 24 October 2026.

## Outcome

This increment implements dependency-aware SMT declaration projection behind the
**opt-in** `smtPreambleProjection: true` solver option. The default remains the full
preamble used in increment 35. The GUI therefore retains its existing solver
behaviour. Projection is not recommended as the production default yet.

The investigation found a concrete reason to keep that gate: omitting datatype
and validity declarations from a preceding String query can make an existing HML
List witness query time out in the shared Z3 context. The List query's SMT text is
byte-for-byte identical in both modes. This is a performance/completeness-under-
budget regression, not a demonstrated change to the meaning of its constraints.
Unknown remains unresolved; it is never treated as UNSAT or a failed property.

## Implementation

`SymbolicPreamble.js` extracts declaration rendering from `SymbolicZ3.js` and
computes a dependency closure for each backend query:

1. Start from the sorts of the variables actually declared by that query.
   Witness requests retain variables used only by witness terms; check-only
   requests retain the existing conditions-only policy.
2. Add datatype roots encountered while encoding constructors, recognizers,
   selectors and typed term-graph definitions. A ground ADT term also needs its
   datatype even when the query has no user variables.
3. Retain **every constructor** of a required sort. Follow every constructor's
   field sorts transitively, including mutual recursion. Do not restrict a type
   to the constructor encountered in the current condition.
4. Emit the same datatype and recursive validity definitions, in the original
   declaration order, for the resulting closure. Nat field nonnegativity and the
   UTF-16 string domain are unchanged.
5. Emit the runtime List/Pair/Any validity group only when an encoded condition
   uses it. Keep its full dependency closure and existing depth/machine-integer
   restrictions. Primitive runtime predicates need no datatype declarations.

Built-in Any has wrappers for all custom sorts. Consequently a List or Pair query
can legitimately depend on the entire algebra. Projection deliberately keeps
those alternatives, even if a particular test uses only integer elements.

An adapter-local memo stores only immutable declaration strings, at most 32
entries and 262,144 retained string characters. Oversize entries are rendered
without retention. It caches no solver answers, parsed ASTs, native handles,
models, assertion stacks or mutable solver contexts. Algebra snapshots remain
owned and frozen by the existing adapter. Eviction only causes regeneration.

The projector checks the whole constructor signature for known field sorts,
finite constructor inhabitation, safe names, generated-symbol conflicts and
well-formed runtime signatures. If these checks do not establish eligibility, it
uses the original full preamble. An unrelated malformed/ill-founded datatype must
not disappear and turn an earlier parser error into a seemingly successful query.
This eligibility check is conservative, not a new general algebra validator.

Optional profiling adds cumulative `preambleChars`, `fullPreambleChars`,
`datatypeSorts` and `fullDatatypeSorts`. These count emitted versus baseline
preambles for backend requests reaching parsing; cache hits do not parse again.
The existing encode/parse/check phase clocks remain separate.

## Local semantic argument and its limits

For an eligible finite constructor signature, the retained sorts contain their
complete constructor signatures and all dependencies. Projected query terms,
assertions and validity predicates are unchanged. Omitted datatype definitions
are unused by those assertions and are inhabited; their interpretations can be
added to a model of the retained declarations. Conversely, restricting a model
of the full declarations preserves the query. This supports equisatisfiability
of the two encodings for the supported signature fragment.

It does **not** prove identical solver search, model choice, execution time,
resource usage or results under a timeout. The observed history regression is
an example of that distinction. It also does not prove full semantic
subuniformity, exhaustion of infinite data spaces, or identical bug detection
under fixed search budgets. Existing witness validation, reference admission,
concrete replay, unknown handling and unfolding bounds remain in place.

## Reproduction

From `petri-net-app`:

```sh
npm test -- --runInBand src/__tests__/satel
npm run build
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-36-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-36-smt-preamble-projection.json
node tools/node/benchmarks/run-solver-history.js --runs 3 --out ../docs/satel/performance/increment-36-solver-history.json
```

The main matrix reuses increment 35's existing decomposition, recursive-ADT,
inventory, workers and fulfilment examples. All earlier optimizations remain
enabled, including numeric-preference refutation. It changes only the preamble
projection switch and alternates which mode runs first across paired workloads.

The additional history probe reuses the existing HML ADT regression scenarios,
now also available from `src/satel/examples/hml-selection/solver-history.js`.
Each fresh child performs String → List → Pair queries in the normal shared Z3
context, with no solver warm-up to perturb that history. It records hashes of
the actual parser input, request profiles, and concrete replay of every SAT
witness. Disabled-mode queries must all solve; enabled-mode unknown is recorded
as a regression, not silently discarded. The probe is a benchmark fixture, not
an additional example in the GUI menu.

## Paired benchmark results

Recorded 24 October 2026 at 10:40 CEST on Node v24.22.1, Linux x64, AMD EPYC 9V74 (9 logical CPUs). These are paired measurements in this environment; timings from earlier increments used a different Node version and are not substituted for the baseline.

All **84 main-matrix trials** completed without runtime errors or hard process timeouts. There were 60 partial decompositions, six fixed-spine frontier-resolved decompositions and 18 selected APN runs. Corresponding trials matched class counts, infeasible counts, residual reason/depth histograms, overlap/unknown counts, backend request counts, main-check statuses and reference/mutant outcomes. The recursive differential tests additionally compare complete class patterns, conditions, results and rule paths.

Median selection time (milliseconds; three trials per mode):

| Workload | Full preamble | Projected preamble |
|---|---:|---:|
| list-16 | 113.21 | 90.35 |
| tree-9 | 158.44 | 144.31 |
| membership-12 | 364.79 | 289.04 |
| lookup-4 | 578.22 | 503.67 |
| lookup-5 | 1290.18 | 1045.90 |
| repeated-12 | 51.07 | 34.57 |
| membership-fixed-12 | 322.04 | 289.50 |
| lookup-branch-limit | 316.68 | 281.81 |
| list-time-limit | 0.48 | 0.53 |
| inventory-20 | 311.41 | 266.25 |
| workers-audit | 400.29 | 363.73 |
| fulfilment-20 | 498.86 | 481.93 |
| lookup-6 | 2461.91 | 2332.70 |
| lookup-7 | 5305.10 | 4886.71 |

At lookup depth 7, median selection improved from **5.31 s to 4.89 s** (about
8%) while retaining 254 completed classes and 128 recursive residuals. Both modes
still made 698 backend queries (509 SAT / 189 UNSAT). In trial 1, accumulated
preamble text decreased from 1,823,874 to 161,772 characters and parsing time
from 1,141.08 to 797.13 ms. These phase values refer to that specific trial,
not medians. Primary solver checking still dominated the projected run
(3,450.46 ms of 4,623.85 ms measured backend time).

The main matrix independently checked **3,414 class witnesses**. Reference replay
passed 24 tests; mutant replay produced 24 failures and the same two expected
fulfilment stock-leak survivors (stock is not observed by those tests), with no
replay errors. Projection did not remove bounded recursive frontiers or make the
subuniformity calculation complete.

The zero-time-budget control performs no solver work; its 0.48/0.53 ms difference
is not evidence about parsing. Three repeats and alternating case order do not
establish a universal speedup. In particular, the separate history probe below
is a counterexample to enabling this optimization on performance grounds alone.

Raw [main report](performance/increment-36-smt-preamble-projection.json) and
[JSONL](performance/increment-36-smt-preamble-projection.json.jsonl) retain every
trial, configuration, profile, witness sample, reference/mutant result and source
hash.

## Reproduced history regression

The [history report](performance/increment-36-solver-history.json) contains three
fresh-process trials per mode, alternating mode order. The full-preamble List
query returned SAT in **26.94–29.87 ms**; projection mode returned unknown in
**3,136.27–3,136.91 ms**, in all three trials. String and Pair returned SAT in both
modes. All 15 SAT results passed concrete HML replay; the three unknown results
remain unresolved.

All six List parser inputs have the same SHA-256:

```text
7eccecab14f20b52649b0ee7a6bf238f445f2a310b3f754079caa91dc8cbbd0a
```

The Pair inputs also match across modes. The preceding String inputs differ:
projection omits their unused datatype declarations. The evidence establishes
sensitivity to earlier use of the shared context; it does not identify the
internal Z3 heuristic responsible or establish a Z3 defect. The configured
3,000 ms solver timeout is unchanged; reported wall times include adapter work
and timeout handling.

This is why the production switch stays off despite the successful main matrix.
Testing each query only in isolation, or comparing only formulas and class
counts, would have missed this regression.

## Validation

All **605 SATEL tests passed in 55 suites** (51.857 seconds). The production build
passed (5.39 seconds), retaining the existing dependency/browser, sourcemap and
bundle-size warnings. No GUI controls were added.

The 29 new cases cover primitive sorts; heterogeneous List/Pair values; full
constructor alternatives; transitive and mutual datatype dependencies; custom
sorts reachable through Any; ground constructors/recognizers/selectors; nested
term graphs; witness-only variables; runtime depth and machine-integer limits;
UTF-16 strings and primitive string operations; malformed/ill-founded signatures;
independent witness rejection of undefined selectors; per-owner isolation of
signatures and memo entries; memo eviction; unknown and cancellation handling;
cache-hit validation; and differential recursive class/frontier/overlap results.
A dedicated test locks the production default to the full preamble.

During development, enabling projection by default failed the existing
`List has a solver witness checked by concrete HML replay` test. Rechecking it
alone reproduced the failure. A temporary comparison against the exact
increment-35 adapter solved the same case, as did disabled mode. The history
probe preserves the reproduction instead of weakening that test or increasing
its timeout.

## Next increment

Investigate solver-context history and declaration lifetime before enabling
projection. The next candidate needs to isolate or explicitly manage parsed
signatures without leaking native handles or changing symbol/selector semantics.
Use the history probe as an acceptance gate alongside the main matrix: a faster
lookup benchmark is insufficient if an existing HML witness becomes unresolved.

Do not add retries or larger timeouts merely to hide this regression. If a later
strategy includes retries, document their budget accounting and measure them
explicitly. Further caching should target measured repeated work and preserve
independent witness validation and concrete reference replay.
