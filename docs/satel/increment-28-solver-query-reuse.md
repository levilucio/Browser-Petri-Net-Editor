# Increment 28 — bounded reuse of exact solver queries

23 October 2026. Branch: `codex/satel-public-methods`. Starting commit:
`2060e9a066d1c1c2713fe7dcc5320f3e152c6173`.

## Result

The 20-pair inventory example now avoids **48 of 70 solver-adapter calls**.
In the initial three-trial comparison, median selection time fell from
**754.92 ms to 309.49 ms**. A five-trial confirmation with reversed mode order
measured **683.49 ms to 297.39 ms** (about 2.3 times faster).

The change is enabled by default through the shared symbolic solver adapter, so
the existing GUI generation flow benefits without new controls. It does not change
test intentions, observations, APN semantics, subuniformity classes or resource
limits. All examples remain in their established locations, including
[`docs/satel/performance/models/inventory`](performance/models/inventory/README.md).
No new APNs were needed for this increment.

The benefit depends on repeated queries. No-reuse cases can incur overhead, and
the four-worker/six-round audit model still exhausts HML construction. This is not
a solution to genuinely different history branches or residual ADT unfolding.

## Implementation and scope

`SolverQueryCache.js` wraps the backend returned by `createSymbolicSolver`:

- Each adapter captures its algebra and solver settings at creation. Caches are
  local to that adapter, with no global or cross-instance answer reuse. The existing
  shared Z3 runtime does not imply shared answer caches.
- A key contains the complete terms, conditions, variable declarations and witness
  mode. Names, order, scopes and term-graph structure are preserved. Omitted witness
  mode is normalized to its existing default, `true`. No alpha-renaming, constraint
  implication, subsumption or semantic equivalence is attempted.
- Cacheable queries are captured as independent JSON snapshots before asynchronous
  solving. Lossy/non-JSON inputs (including nonfinite numbers, undefined fields,
  custom serialization and exotic objects) bypass the cache and reach the adapter.
- Only completed SAT and UNSAT answers are retained. Unknown results, timeouts,
  errors and cancellation are never stored. No in-flight promises are cached or
  coalesced; concurrent identical calls may both run the backend.
- A SAT witness hit rechecks every required binding's sort and all original
  conditions, including lazy evaluation of term graphs. Missing/extra bindings
  fail validation. A failed cached validation evicts that entry and recomputes.
  The existing miss-path witness validation uses the same checking function.
- Answers contain serialized ordinary data, not Z3 handles. Each hit creates a
  fresh Map and fresh algebraic values, so callers cannot mutate retained answers.
- Both the entry point and return from asynchronous solving check cancellation.
  This also closes the previous gap after a witness-free SMT check: cancellation
  there now propagates instead of returning SAT/UNSAT.

The default LRU bounds are **128 answers** and **1,000,000 retained characters**
across serialized keys and answers. Oversized entries are not stored. Eviction
causes recomputation, not a logical verdict. These are retention bounds, not a
strict heap or total transient-allocation bound: key serialization occurs before
the length check, and JavaScript object overhead is additional.

Internal options for tests and experiments:

```js
{ solverQueryCache: false }
{ solverQueryCache: { maxEntries: 128, maxCharacters: 1000000 } }
```

`solve.cacheStats` returns a defensive snapshot of requests, hits, backend calls,
misses, bypasses, stores, evictions, validation failures and retained/peak character
counts. A backend call may perform both the initial SMT check and the optional
preference check; the counter is not a count of raw `solver.check()` invocations.
No cache settings are added to the GUI.

## Preservation argument and limits

For one fixed adapter context, equal accepted keys describe the same solver
problem, with the same witness requirement. Therefore:

1. A previously completed UNSAT answer can replace solving that identical problem,
   assuming the underlying backend's UNSAT answer was correct.
2. A stored SAT witness can replace solving only after its independently checked
   assignment still satisfies the requested sorts and conditions.
3. A witness-free SAT answer is reused only for a witness-free request; it cannot
   substitute for a concrete assignment needed to instantiate a test.
4. Eviction, bypass, failed witness validation and absence of an entry return to
   ordinary solving. They never turn unknown into UNSAT.

This is a local correctness argument, supported by regression tests, not a
machine-checked proof of the implementation or of equivalence to the thesis.
Cached UNSAT answers do not carry independently checked proof certificates.
The adapter still relies on Z3 and the existing encoding/ground-checking semantics.

Repeated unconstrained SAT queries can otherwise return different valid witnesses.
Reuse preserves validity, not the precise representative an uncached solver would
have chosen. It consequently does not establish inclusion of generated test suites
or guarantee monotonic fault detection for all possible SUTs. Reference admission
and concrete target replay remain mandatory and unchanged.

## Verification

The full SATEL suite passed **507 tests in 47 suites** (39.791 s).
The production build passed in **5.45 s**, with the existing large-chunk warning.
The new tests cover:

- Finite cached/uncached SAT and UNSAT comparisons for Int, Nat, Bool, String,
  Pair and List, including UTF-16 lone surrogates and supplementary characters.
- Distinct variable names, sorts, query terms, conditions and witness modes;
  graph scope and ground checking; mutable returned bindings and input requests.
- Revalidation on hits, fallback after failed validation, retries after unknown
  or errors, cancellation on a populated cache and after witness-free SMT success.
- LRU eviction by entry count and character budget, oversized/lossy-key bypass,
  concurrent identical requests, fixed algebra/settings and instance isolation.
- Reference generation and frozen-suite mutant replay with caching enabled,
  disabled and deliberately tiny retention limits.

Existing HML, refusal/negative selection, ADT, nondeterminism, GUI and PNML tests
also passed. There is no claim of exhaustive coverage over infinite domains.

## Performance experiment

The main matrix uses 13 existing workloads, cache enabled/disabled, and three
trials per configuration: **78 records**. Every mode pair agreed on outcome:

- 48 selected APN runs, all passing reference admission and independent replay;
- six satisfiable invoice runs and six UNSAT allocation controls;
- 12 partial custom List/Tree decomposition runs (bounded unfolding);
- six unresolved six-round audit runs (HML work allowance).

There were no runtime errors or child hard timeouts. Main-matrix reference replay
passed 72 individual tests. Mutation replay produced 64 failing tests and two
expected surviving fulfilment stock-leak tests, with no errors. The survivor is
the existing unobserved-stock limitation, not a new cache regression.

| Workload | Disabled median | Enabled median | Hits / adapter requests |
|---|---:|---:|---:|
| Inventory, 5 pairs | 110.03 ms | 107.88 ms | 0 / 10 |
| Inventory, 10 pairs / audit | 145.56 ms | 252.60 ms | 0 / 12 |
| Inventory, 20 pairs / 4 warehouses | 754.92 ms | 309.49 ms | 48 / 70 |
| Inventory, repeated permits | 184.98 ms | 136.21 ms | 2 / 14 |
| Workers, 4 workers / 4 audit rounds | 454.57 ms | 441.68 ms | 0 / 9 |
| Workers, 8 workers / 8 merged rounds | 184.62 ms | 166.40 ms | 0 / 9 |
| Fulfilment, 20 pairs | 810.83 ms | 671.38 ms | 13 / 64 |
| Allocation, 64 resources | 325.45 ms | 319.86 ms | 0 / 4 |
| Custom invoice, 8 lines | 119.65 ms | 135.67 ms | 0 / 10 |
| Custom List, unfolding depth 4 | 66.39 ms | 65.82 ms | 0 / 15 |
| Custom Tree, unfolding depth 3 | 44.77 ms | 42.70 ms | 0 / 10 |
| UNSAT slot allocation, size 6 | 193.34 ms | 194.97 ms | 0 / 1 |

List/Tree times measure partial decomposition, not complete coverage. The omitted
six-round worker row reaches its construction limit in both modes; its time to
stop is not a successful selection time. Differences in no-hit rows are not
evidence of saved solver work.

Because the no-hit audit and invoice rows measured slower, a focused confirmation
reversed mode order and used five trials per configuration (30 further records):

| Workload | Disabled median | Enabled median |
|---|---:|---:|
| Inventory, 10 pairs / audit | 135.81 ms | 137.33 ms |
| Inventory, 20 pairs | 683.49 ms | 297.39 ms |
| Custom invoice, 8 lines | 113.81 ms | 122.07 ms |

The confirmation adds 40 reference-test passes and 32 failing mutant replays,
with no errors. The initial large audit slowdown did not repeat; the invoice
still shows modest overhead without reuse. Both measurements are retained.
These small samples support the specific repeated-query improvement, not a
universal or statistically established speedup.

The target retains 22 answers totalling 43,599 serialized characters; the largest
cache in the main matrix retains 775,679 characters (audit workers, no hits).
No default-size cache evicts entries in these trials; explicit small-budget tests
exercise eviction. Process peak RSS includes Z3 initialization, admission and
mutation replay. For example, main target peaks were 360.86 MiB disabled and
357.75 MiB enabled; fulfilment peaks were 237.07 and 274.27 MiB respectively.
These are not isolated cache-memory measurements or a general memory improvement.

Method: one sequential child per configuration, first trial cold for model caches,
later trials warm; solver answer caches are fresh per trial. Cache-mode order
alternates between workloads and reverses in confirmation. Initialization,
admission and replay are timed separately. No tests or builds ran concurrently.
Node 24.19.0, Linux x64, AMD EPYC 9V74, nine reported logical CPUs. Budgets are
unchanged from increment 27. All 64 recorded JavaScript source hashes match the
measured implementation. The raw reports record the parent commit and dirty state.

Data: [main JSON](performance/increment-28-solver-cache.json),
[main JSONL](performance/increment-28-solver-cache.json.jsonl),
[confirmation JSON](performance/increment-28-confirmation.json),
[confirmation JSONL](performance/increment-28-confirmation.json.jsonl).

## Reproduction and next work

From `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-28-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/local-solver-cache.json
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-28-confirmation-cases.json --runs 5 --hard-timeout-ms 45000 --out ../docs/satel/performance/local-cache-confirmation.json
npm test -- --runInBand src/__tests__/satel
npm run build
```

For laptop review, use **Examples → Inventory → 20 pairs / 4 warehouses — reference**,
generate its tests, then load the corresponding mutants and replay the frozen suite.
Generation automatically uses the cache. Browser timings may differ from Node.

The next performance questions are no-hit retention/serialization costs and models
with genuinely distinct branch histories. State projection or branch merging needs
a separate preservation argument; incremental solver contexts also remain separate
work. Custom-ADT solver benchmarks do not imply arbitrary custom ADTs are supported
in APN method execution.
