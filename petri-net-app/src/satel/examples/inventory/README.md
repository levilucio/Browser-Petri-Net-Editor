# Inventory example generators

`models.js` builds configurable inventory/reservation APNs. `editor.js` registers
the three reference configurations and their mutants in the GUI's Examples menu.

The loadable PNML files, model descriptions and laptop instructions are in
[docs/satel/performance/models/inventory](../../../../../docs/satel/performance/models/inventory/README.md),
alongside the earlier scalability examples. Each PNML includes its test intention.

Regenerate those files from `petri-net-app`:

```sh
node tools/node/benchmarks/export-inventory.js
```
