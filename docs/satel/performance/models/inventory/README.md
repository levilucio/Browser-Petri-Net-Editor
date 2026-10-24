# Inventory reservations and mutants

The 15 loadable PNML files live here, alongside the earlier worker, fulfilment
and allocator benchmarks under `docs/satel/performance/models`. In Levi's checkout:
`C:\Users\levil\cursor\Browser-Petri-Net-Editor\docs\satel\performance\models\inventory`.

The JavaScript generator and GUI catalogue remain in
[`petri-net-app/src/satel/examples/inventory`](../../../../../petri-net-app/src/satel/examples/inventory).
The PNML files include their test intentions; concrete tests are generated in the GUI.

In **Examples**, search **Inventory**. Start with **5 pairs — reference**, then
open **SATEL → Intentions** and **Generated tests**. Generate on the reference;
load a matching mutant and use **Replay frozen suite on loaded APN**. Do not
regenerate the expected behaviour on the mutant. The PNML files can also be
opened directly with **Load**.

| Size | Sequence | Warehouses | HML recovery rounds | Audit |
|---|---:|---:|---:|---|
| [small](inventory-small-reference.pnml) | 5 pairs | 1 | 1 | no |
| [medium](inventory-medium-reference.pnml) | 10 pairs | 1 | 2 | yes |
| [large](inventory-large-reference.pnml) | 20 pairs | 4 | 2 | yes |

Each five-pair cycle reserves quantity `q`, inspects it, cancels, observes the
restored stock (6), and checks that the warehouse is ready to reserve again.
One quantity is shared by the entire sequence and HML requirement. The two
equation classes are `1 <= q <= 2` and `3 <= q <= 5`; generation selects a valid
representative in each. The full method domain is larger than those classes.

Each warehouse has a stock token, a busy flag, a `(quantity, permit)` reservation,
a route flag and a multiset of permit tokens. Reservation requires **two equal
permit tokens**, consuming distinct occurrences. Two enabled rules implement
different acceptance routes. Cancellation restores stock and permits on either
route. Optional audit lists append `(route, permit)` pairs and retain history.
Parameters enter through public method calls; no tokens are injected.

The HML requirement first requires a possible reservation, then requires every
reservation outcome to allow cancellation, a correct stock report and readiness.
It is not satisfied vacuously when reservation is unavailable. The explicit
sequence also checks the reported reserved quantity. Sequence length and HML
depth are separate dimensions.

| Mutant suffix | Fault | Detecting expectation |
|---|---|---|
| stock-leak | Reservation does not debit stock | Cancellation followed by stock report returns too much |
| missing-cancel | Only one acceptance route permits cancellation | Universal recovery requirement |
| wrong-held | Inspection reports `q + 1` | Sequence's `held(q)` observation |
| lost-permit | Cancellation restores one of two permits | Subsequent readiness is unavailable |

All four mutants are detected for each supplied small/medium/large configuration.
When experimenting with additional permit kinds or copies, a lost permit can
remain unobserved while another matching pair remains. Such configurations need
stronger or longer intentions to detect that mutant; no general mutation-coverage
claim is made.

`inventory(config)` independently varies warehouses, cycles, permit kinds/copies,
stock, audit and recovery rounds. Configurations with insufficient tokens or stock
may have no valid test in a declared class. They must remain blocked/unresolved,
not be admitted by changing the expectations. This is a service abstraction,
not a complete commerce implementation (no shipping, payments or persistence).

Regenerate the saved PNML files from `petri-net-app`:

```sh
node tools/node/benchmarks/export-inventory.js
```

See [increment 27](../../../increment-27-cache-comparison.md) for
the correctness comparison, measured performance and limitations.
