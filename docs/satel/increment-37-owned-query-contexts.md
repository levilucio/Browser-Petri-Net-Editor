# Increment 37 — Owned Z3 query contexts

Date: 24 October 2026.

## What changes

Projected SMT queries now use a fresh, explicitly owned native Z3 context for
each backend request. This addresses increment 36's mixed String → List → Pair
history regression, including reuse of a single SATEL solver adapter.

The production default remains shared context/full preamble for now. Enabling
`smtPreambleProjection: true` automatically selects the new query ownership mode.
`solverContext: 'query'` also permits isolation with the full preamble.
`solverContext: 'shared'` is an explicit comparison override; combining it with
projection retains the known history-sensitive experiment and is not the
recommended configuration. No GUI options were added.

The fixed algebra, declaration-string memo and exact-answer cache still belong
to the SATEL adapter. Native contexts, solvers, models, vectors and AST handles
are not cached. An exact answer-cache hit creates no native context and still
independently revalidates SAT witnesses.

## Why separate contexts per adapter were insufficient

A fresh SDK Context per adapter resolved the original reproduction with separate
adapters. It did not resolve the same String → List → Pair history when one
adapter handled all three requests. Isolation therefore happens at the backend
request boundary, not at the APN or intention boundary.

Allocating fresh SDK Context wrappers per request was also unsuitable: native
contexts were not reclaimed during a bounded probe, even after explicit garbage
collection requests. The final implementation does not depend on those
finalizers. A separate diagnostic in the persisted lifetime report retains a
small reproduction of the rejected approach; it is not a production code path.

## Ownership and concurrency

`src/utils/z3/owned-solver.js` implements the small native interface used by SATEL:
timeout configuration, SMT parsing, check, push/pop and release. It owns its
configuration, context, solver and temporary parameters. The existing SATEL
adapter continues to own assertion vectors, temporary preference terms and model
references, releasing those before releasing the solver and deleting the context.

Every normal result and exceptional path closes the request: SAT, UNSAT, unknown,
encoding/parser errors, rejected witnesses, cancellation and optional preference
failures. Setup failure also releases the solver/context. A vector-release error
cannot bypass the final solver/context cleanup. Release is idempotent, and the
native wrapper rejects mutation or release during an outstanding check.

Only ground JavaScript bindings escape a request. There are no SDK Context, AST
or Model wrappers registered for finalization against its native context. This
avoids a later finalizer attempting to use an already deleted context.

Owned requests queue before allocating a context, with at most one live owned
context per runtime. Cancellation is checked when a queued request starts, so an
already cancelled waiter allocates nothing. An in-flight check is awaited before
cleanup, preserving the existing cancellation model; no hard interruption or
additional retry is introduced. This queue's waiting time is included in caller
elapsed time, but not in the backend phase clock that begins on execution.

The SDK's high-level mutex does not cover direct low-level checks or every other
native asynchronous API. `src/utils/z3/async-runtime.js` therefore serializes the
runtime's common `em.async_call` entry point before `getContext()` publishes it.
Both SDK and owned queries use that queue; rejection does not block subsequent
requests. A concrete concurrency test interleaves SDK checks with a burst of
owned requests. The underlying WASM check remains single-call-at-a-time.

This integration depends on the exposed runtime entry point in the installed
`z3-solver` 4.15.3. It checks that the entry point exists and needs review when
upgrading the SDK. It does not patch installed dependency files.

## Names, semantics and limits

Isolated queries use a fixed local prefix and reset their generated variable and
term-graph counters on each request. Unrelated earlier calls therefore cannot
change their SMT text through an adapter serial number or accumulated counter.
Shared-mode queries retain their existing unique names.

The asserted constraints, datatype dependency closure, constructor alternatives,
validity predicates, model decoding and independent witness checks are unchanged.
Moving a query to its own context and consistently renaming local symbols
preserves its logical interpretation. The declaration-projection argument and
restrictions from increment 36 still apply. Runtime datatype redefinitions and
ill-founded signatures retain the conservative full-preamble fallback.

This does not prove that all Z3 heuristics or timings are independent of process
history, nor that bounded searches detect every bug. Solver budgets, unfolding
bounds, unknown handling and reference admission are unchanged. Unknown is still
unresolved, never a negative test witness or a failed property.

## Reproduction

From `petri-net-app`:

```sh
npm test -- --runInBand src/__tests__/satel
npm test -- --runInBand src/__tests__/utils/z3 src/__tests__/utils/z3-arith.test.js src/__tests__/features/algebraic-simulator.test.js src/__tests__/features/simulator-core.test.js src/__tests__/satel/solver-context.test.js
npm run build
node tools/node/benchmarks/run-solver-history.js --ownership --runs 3 --out ../docs/satel/performance/increment-37-solver-history.json
node tools/node/benchmarks/run-context-lifetime.js
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-37-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-37-owned-query-contexts.json
```

The history matrix extends the existing APN/HML fixtures under
`src/satel/examples/hml-selection/solver-history.js`. It exercises separate and
reused adapters, forward and reverse query order, an isolated List query, both
preamble modes and both ownership modes. Every SAT witness must replay concretely.
Unknown is allowed only in the explicit legacy shared/projected reproduction.

The scale matrix reuses the existing recursive-ADT and APN reference/mutant
baselines. It compares shared/full against owned/projected with the same solver
and search budgets. Source fingerprints now include the common Z3 utilities as
well as the existing core/domain/example/benchmark sources.

## History and lifetime evidence

The [history report](performance/increment-37-solver-history.json) contains
**27 fresh-process trials / 75 HML solver queries**. All query-owned cases solved
and replayed successfully, including separate/reused adapters, reversed order,
List alone, and full/projected preambles. Across the whole matrix, 69 SAT
witnesses passed concrete replay. The six UNKNOWN results occurred exclusively
in the deliberately retained legacy shared/projected controls.

For the forward sequence with a reused adapter, the previously problematic List
query now solves in **36.26–38.24 ms**, compared with **3,143.36–3,215.32 ms** and
UNKNOWN in shared/projected mode. Shared/full solves in 26.03–29.21 ms. Owned
contexts fix the timeout at some setup cost; they are not faster for this small
query. List alone takes 201.34–219.78 ms as the first check in a fresh process;
these deliberately un-warmed timings should not be compared directly with List
after String. No claim of fully history-independent execution time is made.

All query-owned List parser inputs have the same SHA-256 across ownership-probe
orders, adapter reuse and both preamble modes:

```text
421b61f198bb3ab1005f093d730ea44147e3b3c8a456330d214a95e49262a7ca
```

The [lifetime report](performance/increment-37-context-lifetime.json) records:

| Probe | Queries | New contexts | Released | Peak live | Final RSS (MiB) |
|---|---:|---:|---:|---:|---:|
| Shared adapter | 150 | 0 | 0 | 0 | 176.16 |
| Owned, sequential | 150 | 150 | 150 | 1 | 180.07 |
| Owned, batches of 15 | 150 | 150 | 150 | 1 | 180.69 |
| Rejected SDK-wrapper approach, forced GC | 50 | 50 | 0 | 50 | 585.57 |

The shared context is initialized before instrumentation and intentionally remains
alive. The rejected SDK case is a bounded diagnostic of non-reclamation **during
this probe**, not proof of a permanent SDK leak. Owned cleanup does not depend on
garbage collection. WASM buffer size remains 2 GiB in these processes; buffer
capacity/RSS need not shrink when native objects are released, so allocation and
deletion counts are reported separately. The lifetime probe is not a controlled
end-to-end speed comparison between the SDK and SATEL pipelines.

## Paired scale measurements

Recorded 24 October 2026 at 11:08 CEST; Node v24.22.1, Linux x64, AMD EPYC
9V74, 9 logical CPUs. All **84 main trials** completed without runtime errors or
hard process timeouts: 60 partial decompositions, six fixed-spine
frontier-resolved decompositions and 18 selected APN runs.

Paired trials matched class counts, infeasible counts, residual reason/depth
histograms, overlap/unknown counts, backend request counts, main-check statuses,
reference replay and mutant counts/failure explanations. The recursive tests
also compare full class patterns, conditions, result patterns and rule paths.
This is a combined shared/full versus owned/projected comparison, not a factorial
experiment attributing every timing change solely to parsing or context ownership.

Median selection times (ms; three trials per mode):

| Workload | Shared/full | Owned/projected |
|---|---:|---:|
| list-16 | 116.35 | 110.11 |
| tree-9 | 174.11 | 198.70 |
| membership-12 | 381.44 | 298.18 |
| lookup-4 | 584.41 | 481.42 |
| lookup-5 | 1321.12 | 1076.74 |
| repeated-12 | 44.56 | 38.63 |
| membership-fixed-12 | 355.39 | 265.81 |
| lookup-branch-limit | 343.08 | 267.64 |
| list-time-limit | 0.53 | 0.59 |
| inventory-20 | 285.57 | 299.05 |
| workers-audit | 391.06 | 339.81 |
| fulfilment-20 | 503.59 | 540.65 |
| lookup-6 | 2520.39 | 2279.45 |
| lookup-7 | 5131.96 | 4599.09 |

Lookup depth 7 improves from **5.13 s to 4.60 s** (about 10%), retaining 254
completed classes and 128 recursive residuals. Both modes issue 698 backend
queries (509 SAT / 189 UNSAT), and still skip the same 252 impossible optional
numeric preferences.

In the second trial, context/solver creation rises from **22.54 to 288.60 ms**
across those requests; parsing falls from **1,090.20 to 744.00 ms**. Primary
checking changes from 3,420.76 to 2,868.93 ms. The observed speedup therefore does
not come from eliminating setup cost: context isolation incurs real cost, while
both parsing and solver-search behaviour change. Those figures describe one
trial, not phase medians or a guaranteed decomposition of the median speedup.

### Focused repeats

The initial matrix showed slower medians for tree, inventory and fulfilment.
A second matrix repeats those cases **seven times per mode**, reversing the mode
order. Both datasets are retained:

| Workload | Shared/full | Owned/projected |
|---|---:|---:|
| tree-9 | 174.74 | 152.67 |
| inventory-20 | 276.09 | 282.87 |
| fulfilment-20 | 525.50 | 457.90 |

The tree and fulfilment slowdowns did not persist in the repeats. Inventory is
still about 2.5% slower; no inventory speedup is claimed. This evidence supports
mixed workload-dependent costs rather than a universal speedup. The zero-time-
budget control makes no solver call and is not evidence about context ownership.

All **42 focused repeat trials** also retained matching class/frontier and
reference/mutant outcomes, with no runtime errors or hard timeouts. Across both
scale datasets, **3,736 class witnesses** were independently checked, reference
replay passed **66 tests**, and mutants produced **44 failures** plus the same
**four expected fulfilment stock-leak survivors** (those tests do not observe
stock). There were no replay errors. Recursive residual frontiers remain bounded
and visible; ownership does not make subuniformity enumeration complete.

Raw evidence:

- [Main report](performance/increment-37-owned-query-contexts.json) and
  [JSONL](performance/increment-37-owned-query-contexts.json.jsonl).
- [Focused repeats](performance/increment-37-owned-query-repeat.json) and
  [JSONL](performance/increment-37-owned-query-repeat.json.jsonl).

Repeat command:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-37-repeat-cases.json --runs 7 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-37-owned-query-repeat.json
```

## Validation

All **625 SATEL tests passed in 56 suites** (53.853 seconds). A related run passed
116 tests in 25 suites, including the 20 new ownership tests already counted in
SATEL: **96 additional simulator/Z3 tests**. The production build passed in
5.98 seconds, with the existing dependency/browser, sourcemap and bundle-size
warnings. A browser-worker soak test has not been performed in this increment.

The new tests cover forward/reverse mixed HML queries and concrete replay,
projection's automatic ownership selection, cache-hit validation without native
allocation, stable per-query SMT names, concurrent SDK/owned execution, bounded
live contexts, normal/error/cancelled cleanup, setup/creation failure, model
validation failure, optional preference fallback, mutation/release during checks,
idempotent release and cleanup when vector release throws. Existing tests cover
the remaining SATEL semantics and GUI behaviour under the unchanged default.

## Next increment

Exercise the owned-context path in the browser worker under repeated generation,
cancellation and concurrent simulator activity before promoting it to the GUI
default. The Node history and lifetime regressions are now explicit acceptance
checks for future changes. The default remains unchanged during this reviewable
lifecycle increment.

Further parsing reuse must respect the new ownership boundary. Do not retain
native AST/model handles from a context after a request ends. A proposal to reuse
contexts or parsed signatures needs to demonstrate correct lifetime and replay
the mixed-history probe, not merely reduce context creation time. Keep UNKNOWN
and residual frontiers visible under the existing budgets.
