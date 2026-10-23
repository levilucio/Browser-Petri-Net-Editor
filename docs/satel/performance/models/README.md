# Loadable scalability models

Open a reference using the app’s Load action, then SATEL → Intentions / Generated tests. Generate on the reference before loading a matching mutant and replaying the frozen suite. Large/stress examples may exhaust generation limits. See [the experiment report](../../increment-20-scalability.md) for measured limits and model assumptions.

| Reference | Places / rules | Matching mutants |
|---|---:|---|
| [allocation-8-resources](allocation-8-resources-reference.pnml) | 12 / 2 | [missing-confirmation](allocation-8-resources-missing-confirmation.pnml), [wrong-allocation](allocation-8-resources-wrong-allocation.pnml) |
| [allocation-32-resources](allocation-32-resources-reference.pnml) | 36 / 2 | [missing-confirmation](allocation-32-resources-missing-confirmation.pnml), [wrong-allocation](allocation-32-resources-wrong-allocation.pnml) |
| [fulfilment-4-sites](fulfilment-4-sites-reference.pnml) | 63 / 20 | [missing-dispatch](fulfilment-4-sites-missing-dispatch.pnml), [wrong-receipt](fulfilment-4-sites-wrong-receipt.pnml), [stock-leak](fulfilment-4-sites-stock-leak.pnml) |
| [fulfilment-16-sites](fulfilment-16-sites-reference.pnml) | 243 / 80 | [missing-dispatch](fulfilment-16-sites-missing-dispatch.pnml), [wrong-receipt](fulfilment-16-sites-wrong-receipt.pnml), [stock-leak](fulfilment-16-sites-stock-leak.pnml) |
| [fulfilment-128-sites](fulfilment-128-sites-reference.pnml) | 1923 / 640 | [missing-dispatch](fulfilment-128-sites-missing-dispatch.pnml), [wrong-receipt](fulfilment-128-sites-wrong-receipt.pnml), [stock-leak](fulfilment-128-sites-stock-leak.pnml) |
| [workers-audit-small](workers-audit-small-reference.pnml) | 5 / 4 | [missing-worker](workers-audit-small-missing-worker.pnml), [wrong-receipt](workers-audit-small-wrong-receipt.pnml) |
| [workers-merged-large](workers-merged-large-reference.pnml) | 4 / 16 | [missing-worker](workers-merged-large-missing-worker.pnml), [wrong-receipt](workers-merged-large-wrong-receipt.pnml) |
| [workers-audit-stress](workers-audit-stress-reference.pnml) | 5 / 8 | [missing-worker](workers-audit-stress-missing-worker.pnml), [wrong-receipt](workers-audit-stress-wrong-receipt.pnml) |

The stock-leak mutant is an expected survivor of the current bounded public observations; this exposes a coverage gap. Custom invoice/List/Tree ADT analysis workloads are defined in `tools/node/benchmarks/solver-cases.js`, separately from these executable built-in-sort APNs.

## Inventory reservations

[Inventory examples and mutants](inventory/README.md) provide 5-, 10- and 20-pair
intentions with branching recovery requirements: three references and twelve mutants.
Their PNML files include the intentions. Regenerate them from `petri-net-app` with
`node tools/node/benchmarks/export-inventory.js`.
