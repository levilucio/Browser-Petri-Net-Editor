# Warehouse/order management SUT

A reusable independent web application: Python HTTP/JSON REST backend, SQLite
relational database and a browser frontend. Part of the SATEL research experiments.
No SATEL dependency is needed to run the application. All data are synthetic.

```sh
cd experiments/warehouse-sut
python backend/app.py --port 8880
```

Open <http://127.0.0.1:8880>. Select a team member and sign in with
`research-demo`. Northstar actors 1/2/3/4 are sales/manager/warehouse/auditor;
Harbor uses 11/12/13/14. These are demonstration accounts, not production authentication.
The server binds to localhost; test reset is disabled unless `--test-mode` is set.

The first launch creates `data/warehouse.sqlite3`. It contains two companies,
eight actors, 48 products, eight warehouses, 192 stock rows, 800 completed orders
and 1,600 order lines. Historical orders are separate from the initial experiment
IDs. Closing/restarting the application preserves data. Use a new `--db` path
for a clean seeded database; existing databases are not overwritten on startup.

## Working with the application

Use the sidebar for orders, inventory or catalog. Clicking a table row fills its
identifiers into the operation form. The response panel displays accepted/refused
results. Each actor has company-scoped visibility. The same frontend actions are
used by Playwright; the browser adapter does not invoke REST operations directly.

For a first workflow: Sales opens order 1001, adds line 10011 for product 101 at
warehouse 11 with quantity 4, and submits. Manager approves. Warehouse reserves
and ships the line. Auditor reads the order, line, inventory and audit count.
Partial reservations, shipments, returns and cancellation are supported.

See [CONTRACT.md](CONTRACT.md) for exact roles, lifecycle, quantities, atomicity,
observations and limitations. REST resources are `/api/orders`, nested order
`lines`, order actions (`submit`, `approve`, `reserve-pair`, etc.), `/api/stock`,
`/api/products` and `/api/warehouses`. Login returns a bearer session token.
There is no general remote code-execution endpoint or APN evaluator in the SUT.

## APN and test intentions

In the editor: **Examples → Warehouse orders — Reference**. Then open
**SATEL → APN source** or **Generated tests**. The model uses the existing thesis
notation: surrounding system border, black method ports synchronized by name,
white gate ports connected to transitions.

- [Concrete APN source](specification/warehouse.copn)
- [Editor model and intentions](specification/warehouse.apn.json)
- [Model builder](../../petri-net-app/src/satel/examples/warehouse/editor.js)
- [ADT equations and protocols](../../petri-net-app/src/satel/examples/warehouse/intentions.js)

The reference has **42 generic transitions, six shared places, 28 methods and
eight gates**, compared with HR's 21 transitions. Its initial marking contains
three unused order IDs, nine unused line IDs and a bounded catalog/roster.
IDs have no owner until creation; the three-per-order ID pattern is only a fixture
naming convention, not an ownership restriction. The
SUT accepts more entity IDs than this finite marking; the experiment only tests
the declared model scope. Increasing order/line populations changes tokens, not
transition rules. The UI and DB size are not APN exploration coverage claims.

`Basket` is a recursive ADT. Its `fits` operation decrements per-product capacity
as it traverses an order, so duplicate product lines compete for the same stock.
The first experiment fixes two items and capacities 10/8, restricting quantities
to 1..12 and products to 101/102. Other intentions explicitly scope lifecycle and
permission examples; these are not comprehensive partitions of all workflows.

## Reproduce baseline evidence

Install editor dependencies once (`npm ci` in `petri-net-app`). Python uses only
its standard library. Browser tests use Playwright from the editor installation;
install its Chromium browser (`npx playwright install chromium`) or set
`SATEL_CHROMIUM` to an existing compatible executable.

```sh
python -m unittest discover -s tests -p '*_test.py'
node experiments/generate.mjs
node experiments/audit.mjs
node experiments/coverage.mjs
node experiments/allocation-check.mjs
node experiments/campaign.mjs --transport api --out baseline-final-api
node experiments/campaign.mjs --transport ui --out baseline-final-ui
node experiments/summarize.mjs
```

Every campaign starts a fresh server and temporary database. Every test path
resets it to seed 1. Refusal extensions use fresh resets and append three public
reads; they are separate trace experiments, without stronger HML claims.
Results are published atomically. The harness checks relational integrity and
stock/ledger reconciliation after each test/probe. Raw reports are ignored;
compact summaries, concrete selected pairs, source hashes and finite audits are
committed. Generation selects new representatives; use committed suites to replay
exactly the recorded stimuli. Keep source and suite hashes together.

## Preserve unseeded failures before repair

If a baseline mismatch or exception appears, stop and run:

```sh
python experiments/preserve.py meaningful-defect-name \
  --report results/baseline-api.json \
  --description 'Observed expected/actual discrepancy, without assuming its cause' \
  --reproduce 'node experiments/campaign.mjs --transport api'
```

This creates an immutable-by-convention directory under `evidence/`, refusing to
overwrite an existing case. It captures the source actually under test, model,
adapters, test suite, failing report, hashes, runtime and reproduction command.
Investigate and append a diagnosis before modifying the working implementation.
Preserved source lives below `snapshot/` at its original repo-relative paths;
restore it into a separate checkout of the recorded parent commit to reproduce.
Do not execute restored snapshots against a non-experiment database.

See [BASELINE_RESULTS.md](BASELINE_RESULTS.md) for measured outcomes and the
unseeded-defect inventory. No mutations are enabled in this baseline SUT.

## Scaling and mutation experiments

See [SCALING_MUTATION_RESULTS.md](SCALING_MUTATION_RESULTS.md) for the separate
basket-depth, token-population and history-length experiments, opt-in fault
injection, fixed browser subset, reconstruction commands and evidence limits.
The normal app.py entry point remains unchanged; faults require the separate
mutation_server.py runner.
