# Warehouse/order baseline results

31 October 2026 · increment 52 · branch `codex/satel-warehouse`.

## What was built

Independent Python REST/SQLite SUT with a browser frontend, role/tenant checks,
order approval, partial reservation/fulfilment/returns, cancellation, atomic
multi-line reservations, inventory transfers, stock counts and availability.
The database starts with two companies, eight users, 48 products, eight warehouses,
192 stock balances, 800 historical orders and 1,600 historical lines, plus audit
and movement records. The app can be restarted and reused with its persisted DB.

The APN has **42 transitions**, twice HR's 21, with **six places, 28 methods and
eight gates**. All transitions are generic over IDs and token data. The initial
marking has 34 tokens: eight principals, four products, three warehouses, seven
stock balances, three unused order IDs and nine unused line IDs. Thus the model
is larger in transition/interface structure, not in every population dimension.
Its catalog is deliberately smaller than the SUT database.

The concrete syntax and graphical boundary/method/gate notation are available in
the editor. [warehouse.copn](specification/warehouse.copn) and
[warehouse.apn.json](specification/warehouse.apn.json) are generated snapshots.

## Selection and independent checks

| Intention | Selected tests | What it varies |
| --- | ---: | --- |
| Recursive two-item basket | 12 | Shared/distinct products, quantity interactions and capacity exhaustion |
| Lifecycle and inventory | 12 | Explicit approval, editing, partial fulfilment, cancellation, availability, competing orders and ID allocation histories |
| Approval permissions | 8 | Four roles across two tenants |
| Reservation permissions | 8 | Four roles across two tenants |
| Read permissions | 8 | Four roles across two tenants |
| State/atomicity refusals | 14 | Explicit invalid-state, ownership, stock and quantity scenarios |
| **Total** | **62** | **22 positive and 40 terminal-refusal tests** |

Every selected test is admitted by replay against the APN. There are no unresolved
or blocked selections and no reported overlap obligations. The longest selected
history has **24 stimulation/observation pairs**. Explicit lifecycle/actor cases
must not be presented as automatically discovered exhaustive workflow coverage.

The `Basket` equations recursively subtract each item's demand from the relevant
product's remaining capacity. Duplicate product IDs therefore interact across
entries. Its finite audit uses a separate term matcher/arithmetic interpreter,
with no SATEL/Z3 evaluation imports. Fresh arithmetic variables are resolved only
through explicit defining equalities; unsupported forms fail the audit.

Across **3,136** product/quantity combinations (products 100..103, quantities
0..13), **576** belong to the intention's domain. Of those, 233 are acceptable
and 343 exceed aggregate capacity. Every defined input belongs to exactly one
computed region and has the correct result; no out-of-scope input is covered.
All 12 witnesses check. Engine coverage remains `not-proved`: this is a finite
bounded cross-check, not a proof for arbitrary baskets or quantities.

All **42/42 transitions** occur in selected-test replay. The initial discrepancy
below demonstrates why this metric is insufficient to establish adequate input
or guard coverage.

Generation stage timings and profiling are recorded in
[generation.json](results/generation.json). These are single development-run
measurements, not an isolated repeated scaling study or performance comparison.

## Unseeded finding preserved before repair

The original 60 generated tests passed both transports and exercised all 42
transitions. Additional review deliberately varied ownership while keeping IDs
inside the modeled initial identifier set:

| Stimulus | Original APN | SUT |
| --- | --- | --- |
| Tenant-2 salesperson opens unused order 1001 | Refused | Accepted; order belongs to tenant 2 |
| Order 1001 adds unused line 10021 | Refused | Accepted; line belongs to order 1001 |

The initial marking had mistakenly assigned ownership to unused IDs based on
the fixture numbering convention. The backend assigns ownership when creating
records. No requirement prescribed ownership of a number before creation.

**Diagnosis: an unseeded specification/model-abstraction defect.** It is not
counted as a discovered SUT implementation fault. Both complete pre-fix source
implementations, the contract, adapters, selected tests, hashes and two failing
traces were preserved **before any corrective change**:

[Preserved source and diagnosis](evidence/initial-slot-ownership/README.md).

The APN now assigns tenant/order ownership at creation, frees removed draft-line
IDs, and preserves authorization on existing records. The contract makes the rule
explicit. Two new generated lifecycle tests cover this behavior. The backend and
frontend sources are unchanged from the preserved snapshot. Both original
reproducers now pass. No intentionally seeded mutations were introduced.

A separate harness omission was also found: its first post-refusal selector used
`refused` instead of normalized assertion `blocked`. The first canonical runs
therefore had no probes. The selector was repaired and explicit extension runs
were performed. Final campaigns include the extensions and assert their count;
this omission is not counted as a SUT defect.

## Final external campaigns

The frozen suites run through real HTTP and actual browser forms/buttons. The
Playwright adapter signs in, chooses operations, fills visible fields and reads
the rendered response; it does not bypass the UI to call backend operations.

The canonical HML path planner yields **102 executions per transport** from the
62 tests: the 40 prefixed negatives also have separate positive-prefix paths.
An additional **40 executions per transport** append order summary, order audit
count and stock-balance reads after the full refused history. Each path/extension
starts from a fresh seeded database. These extensions are separate trace tests;
they do not change the canonical intention's HML meaning.

Final source-hashed results and exact transport comparisons are retained in
[baseline-summary.json](results/baseline-summary.json). The summary command refuses
missing cases, any non-compatible trace, changed source/suite hashes, database
integrity errors, missing transition coverage or transport disagreement.

The DB checks independently reconcile all stock reservations with line records,
physical stock with movement ledgers, foreign keys and SQLite `quick_check`.
They are supporting diagnostics, never the source of expected gate observations.
A finite set of public probes cannot establish that every hidden field is unchanged.

## Interpretation for the paper

- A second domain exercises real dependencies between recursive data elements,
  reservations and shared resources, retaining synchronous methods/gates.
- Finite test generation and external execution transfer to this structurally
  larger APN. This baseline does not establish scaling across all dimensions.
- Passing all selected tests and exercising every transition did not expose the
  ownership abstraction error. Review and additional input variation did.
- Preserve the distinction between a faulty reference abstraction and a faulty
  implementation. Here the observed two mismatches led to an APN repair.
- The SUT is separately implemented and computes order aggregates from SQL lines,
  while the APN updates counters. Both were nevertheless developed within the
  same research process; this is not independent or blinded development.
- Positive-path HML evidence and inconclusive negative evidence must be reported
  separately from compatible observable traces. No universal conformance or
  thesis-level correspondence claim is established.

Next experiments should vary basket length, token population and history length
separately, then measure their interaction; compare SATEL representatives against
matched-budget random tests before drawing effectiveness conclusions. Mutation
campaigns and those scaling comparisons are outside this baseline increment.

## Reproduction

See [README.md](README.md). Replay the committed `results/suites.json` for the
exact recorded inputs. Re-running generation is a new selection and may choose
different witnesses; run new campaigns against that resulting suite. The evidence
snapshot is intentionally self-contained for the failed baseline, not silently
updated to the corrected model. Raw reports/live temporary databases are omitted
from git; committed summaries retain hashes, per-trace outcomes and provenance.

## Recorded final outcome

| Measure | REST | Browser |
| --- | ---: | ---: |
| Canonical executions | 102 | 102 |
| Post-refusal extensions | 40 | 40 |
| Total compatible executions | **142** | **142** |
| Executed stimulation/observation pairs | 871 | 871 |
| Mismatch / error / inconclusive trace verdicts | 0 / 0 / 0 | 0 / 0 / 0 |
| DB integrity/reconciliation checks | 102 | 102 |
| Canonical HML witnessed / inconclusive | 22 / 80 | 22 / 80 |

All **142 matched execution traces**, verdicts and HML records agree exactly.
The 80 inconclusive HML records include the two paths associated with each
prefixed negative; an accepted prefix does not settle the original full property.
The 40 separate extensions per transport have no whole-formula HML verdict.

Final generation took 16.20 seconds for all six intentions in one development
run. The model's 42 transitions do not imply more ADT regions than HR: the basket
experiment has 12 regions under its particular goal, equations and input scope.
No cross-domain timing superiority is inferred.

Validation: **1,476 repository tests in 216 Jest suites**, **12 Python backend
tests**, production build and one built-editor Playwright test. The editor test
loads the 28 black method ports, eight white gates and 42 gate synchronization
edges, then generates/admit all 12 basket cases in its worker. A browser screenshot
was visually inspected for the SUT layout. Node 24.22.1, Python 3.12.14, SQLite
3.53.1 and Chromium 153.0.8010.0 were used on Linux x64; exact runtime metadata and
source hashes are in the summary. Timings are not isolated repeated benchmarks.
