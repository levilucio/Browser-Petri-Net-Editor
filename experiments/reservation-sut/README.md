# Waypoint: nondeterministic reservations and HML

A focused web SUT for comparing ordinary black-box HML evidence with controlled
branching exploration. Independent Python REST backend, SQLite relational data,
and a browser frontend exercised through real Playwright button clicks.

[Design and research log](../../docs/satel/increment-54-web-hml.md) ·
[Measured results](RESULTS.md) · [Concrete APN](specification/reservation.copn) ·
[Editor PNML with all five intentions](../../docs/satel/examples/methods-gates/reservation-hml.pnml)

## Run and inspect

From this directory, with Python 3 and the editor's Node dependencies installed:

```sh
python backend/app.py --db reservation.sqlite3 --port 8891
```

Open `http://127.0.0.1:8891`. Open the reservation, choose North/South or automatic
allocation, then complete it. Automatic allocation uses OS entropy in normal mode.
The database persists across restarts. This bounded experiment operates on one
active reservation; 50 completed historical rows and two warehouse records are
seeded on first use. To start another isolated experiment, use a fresh database
path. Test mode also provides an explicit reset endpoint.

Open `reservation-hml.pnml` in the Petri Net Editor to inspect the boundary,
black method ports, white gate ports, seven transitions and five HML intentions.
The JSON export retains those intentions too. The `.copn` file is the textual APN
class; it does not embed the HML test intentions.

## Public contract and abstraction

| Method | Arguments | Successful gate |
| --- | --- | --- |
| open | None | ready(true) |
| allocate | None | allocated(1) or allocated(2) |
| reserve | warehouse: 1 or 2 | allocated(warehouse) |
| finish | None | receipt(previously allocated warehouse) |

Each method is `POST /api/reservation/{method}` with a JSON object. A successful
response is `{status:"accepted", result:{...}}`; an explicit business refusal
returns HTTP 409 and `{status:"refused", reason:"..."}`. Protocol/transport errors
are separate. The adapter maps result fields to typed APN gate tokens.

Opening is allowed once. Allocation/reservation requires a ready state; finishing
requires a reserved state. The reference retains both manual choices after open.
All operations are synchronous: no concurrent users, pending jobs or interleavings.
Warehouses are available throughout this one-unit scenario; this is not an
inventory-capacity model. Historical rows are outside the tested active projection.

## HML properties

Labels below abbreviate method/gate pairs; A=1 and B=2. All five hold in the APN.

1. `⟨open/ready⟩ ⟨allocate/A⟩ true` — automatic A is possible.
2. `⟨open/ready⟩ ⟨allocate/B⟩ true` — automatic B is possible.
3. `[open/ready] [allocate/99] false` — the designated illegal allocation never occurs.
4. `[open/ready] (⟨reserve(A)/A⟩ true ∧ ⟨reserve(B)/B⟩ true)` — both choices coexist after every successful opening.
5. `[open/ready] [allocate/B] [finish/not receipt(B)] false` — no wrong completion receipt after automatic B.

Property 3 forbids the specific value 99, not every imaginable illegal value.
Property 5 is a safety property and is vacuously true if no B allocation or no
successful completion occurs. Properties 1/2 separately require allocation
possibilities; this corpus does not include a completion-liveness obligation.
These are five explicit finite SATEL intentions, not a new ADT unfolding benchmark.

## Access conditions

**Ordinary:** reset to the declared initial configuration, then use public calls.
Six modal paths, 16 fixed seeds each, per variant/transport. Seeded entropy makes
REST/browser comparisons repeatable; it does not make samples IID or exhaustive.
SATEL retains all compatible reference states and uses its existing conservative
per-execution HML evidence. No checkpoint or branch control is used in these paths.

**Controlled:** opaque checkpoint/restore plus selector 0/1 on each public call.
Every call uses at most one binary environmental choice. A separate evaluator
restores the same parent before each alternative and before each Boolean child.
It evaluates the finite HML AST over actual service responses, not APN successors.
State digests verify restoration identity, never provide expected gate values.

All evolving backend state, including hidden commitment and seeded entropy counter,
is in SQLite and copied using SQLite backup. Variant configuration is fixed for
one server process. There are no external services, background jobs or in-memory
business caches. Browser activity text is not restored: the frontend has no
business state affecting commands, and every action sends its explicit arguments.
The controlled endpoint chooses future environmental entropy; it does not claim
to enumerate alternatives along a single fixed PRNG trajectory.

The complete-enumeration assumption is limited to this audited binary-choice
implementation. More realistic applications need a separately justified control
contract. A checksum alone does not establish that arbitrary hidden state was
captured. Ordinary public testing cannot establish that contract.

Limits: 256 evaluator visits, 256 public calls and 60 seconds per controlled
property; HTTP operations have 10-second timeouts. Exhaustion yields inconclusive;
restoration/transport/protocol errors yield error. Refusals count as no accepted
HML edge only after all declared choices are enumerated in controlled mode.

## Reproduce

Install the existing editor dependencies in `../../petri-net-app` (`npm ci`).
Use Playwright's installed Chromium, or set `SATEL_CHROMIUM` to its executable.
No Python third-party packages are required.

```sh
python -m unittest discover -s tests -p '*_test.py'
node --test tests/controlled.test.mjs
node experiments/generate.mjs
node experiments/campaign.mjs --variants none
node experiments/campaign.mjs --variants illegal-output,missing-b,early-commitment,bad-b-receipt
node experiments/summarize.mjs
```

Both baseline transports must pass with matching source/corpus hashes before any
mutant runs. Campaigns start isolated servers/databases and reset every path.
Run serially: the harness uses port 8891. `--resume` reuses completed reports only
when source and corpus hashes match. Five selected tests yield six experimental
paths because the branching conjunction has two continuations.

Test endpoints require `--test-mode` and `X-Test-Key: local-experiment`. They are
local research facilities, not authentication for a production deployment. The
normal server binds only to loopback and rejects test controls. Non-baseline
variants require test mode. Mutations do not change the APN or properties.

Unexpected baseline traces or controlled property results trigger an immutable
source/corpus/report snapshot under `evidence/` before the campaign stops. The
current parent commit identifies the unchanged shared SATEL implementation;
source hashes identify the exact new application and harness used in each run.

For synchronized/remote workspaces, stage live reports outside the repository:

```sh
export RESERVATION_REPORT_DIR=/tmp/reservation-hml-reports
node experiments/campaign.mjs --variants none,illegal-output,missing-b,early-commitment,bad-b-receipt
node experiments/summarize.mjs
cp "$RESERVATION_REPORT_DIR"/*.json "$RESERVATION_REPORT_DIR"/*.png results/
unset RESERVATION_REPORT_DIR
node experiments/summarize.mjs
```

Use a fresh staging directory for a new campaign. The corpus stays in
`results/corpus.json`; the output override affects live reports/screenshots only.
The final run used this arrangement after a workspace persistence problem; see the
preserved report-finalization evidence. The last summary verifies the copied files.
