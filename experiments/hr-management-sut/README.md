# HR management SUT

[Automatic refusal results](NEGATIVE_RESULTS.md) document 160 scoped prefix/method targets, generated negative companions and real REST/browser checks. Run `node experiments/negative-export.mjs` to create an editor-importable APN of the frozen positive controls and negative tests.

[Observable-history results](EFFECTIVENESS_RESULTS.md) add a separate richer protocol, frozen representatives, real REST/Playwright campaigns and within-region fault-detection comparisons. Run `node experiments/effectiveness-export.mjs` to create an editor-importable APN containing the three new intentions. The original examples and frozen suite remain intact.

The latest [scaling measurements](SCALE_RESULTS.md) extend the fixed-marking
depth experiment with exact scalar feasibility checks, compact region metadata
and larger explicit branch budgets. The application and original frozen tests
are unchanged. Reproduce the new measurements sequentially:

```sh
node experiments/depth-benchmark.mjs --mode scale
node experiments/depth-report.mjs scale-benchmark --out scale-audit
node --test experiments/depth-audit.test.mjs
node experiments/verify-index.mjs --out scale-verification
node experiments/scale-summary.mjs
```

A standalone research application for model-based testing: browser frontend,
Python REST backend and a persistent SQLite relational database. The application
has no dependency on SATEL. The optional experiment scripts use the separate
Browser-Petri-Net-Editor checkout to generate and check tests.

## Run on Windows

Extract `hr-management-sut.zip` into `C:\Users\levil\cursor`. The resulting
project is `C:\Users\levil\cursor\hr-management-sut`.

```powershell
Set-Location C:\Users\levil\cursor\hr-management-sut
py -3 backend\app.py
```

Open <http://127.0.0.1:8765>. Python 3.11+ is sufficient; the backend uses only
the standard library. SQLite data persists in `data/hr.sqlite3`. The downloadable
package includes a preloaded DB. The repository copy creates the same deterministic
mock dataset on first launch when that database is absent.
Use `--seed` only to deliberately replace that database with a fresh dataset.

Demo password: `research-demo`. Employee **1001**, another employee **1002**,
assigned manager **101**, another manager **102**, company-one HR **11**, and
company-two HR **21** provide useful starting accounts. Managers and HR also
have their own time records and allowances. The UI offers time entry, approval,
correction, vacation and audit-history screens. Select a visible employee or
enter an employee ID; the backend independently checks every operation.

This is a local experiment fixture with shared demo credentials, not a
production HR product. It binds to localhost. It is not intended for real
employee data or public deployment.

## Data and research policies

- Two companies, 12 departments, 256 people (240 employees, 12 managers, four HR
  accounts), 7,680 September 2026 time records, 512 historical vacation requests
  and 256 audit import records. All identities are synthetic.
- Work types: standard, business trip, home office, training and on call. Amounts
  are integer minutes between 15 and 720. Standard entries start approved;
  non-standard entries require the employee's assigned manager to approve or
  decline. A manager cannot approve their own entry.
- Employees submit only their own time and vacation requests. Managers can read
  their reports. HR can read and correct records only within their company.
- Each employee has 30 vacation-day units per year. Approval reserves the balance;
  taking already-approved leave does not charge it again. Pending leave cannot
  be taken. Declined requests do not consume allowance.
- HR may correct amounts, work types and states, including a manager's decisions.
  A reason is mandatory. Vacation corrections reconcile the reserved/used amount.
  Every successful write records actor, before/after values and reason in an
  audit row in the same transaction. Refused operations leave no partial writes.
- The policies are explicit research choices. Day units do not implement a
  jurisdiction's holiday calendar, weekends, overlapping bookings, payroll,
  overtime law or future effective dates. No legal compliance is claimed.

## Relational architecture and REST interface

The backend owns companies, departments, employees (including manager and company
foreign keys), time entries, vacations, sessions and audit rows. Indexed queries
serve employee/date views. Each mutation executes under `BEGIN IMMEDIATE`, so
allowance checks and writes are serialized atomically. Permission checks use the
session identity loaded from the database, not an actor supplied in a payload.

| Endpoint | Operation |
| --- | --- |
| `POST /api/login` | Demo login: employee ID and password; returns bearer token |
| `GET /api/dashboard?employee=1001` | Visible staff, summaries, records and audit history |
| `POST /api/time-entries` | Submit employee, record reference, date, kind and minutes |
| `GET /api/time-entries/{id}?employee=1001` | Read a record |
| `POST /api/time-entries/{id}/decision` | Manager approval/decline |
| `PATCH /api/time-entries/{id}` | HR correction with reason |
| `POST /api/vacations` | Request employee, reference, start date and day units |
| `GET /api/vacations/{id}?employee=1001` | Read a request |
| `POST /api/vacations/{id}/decision` | Manager approval/decline |
| `POST /api/vacations/{id}/take` | Record approved leave taken |
| `PATCH /api/vacations/{id}` | HR correction with reason |
| `GET /api/employees/{id}/balance` | Remaining vacation days |
| `GET /api/employees/{id}/totals?period=2026-11` | Approved work minutes |
| `GET /api/employees/{id}/audit-count?period=2026-11` | Public audit row count |

Accepted operations return `{status:"accepted",result:...}`; explicit business
refusals return HTTP 409 with `{status:"refused",reason:...}`. Malformed input
is HTTP 400, missing authentication HTTP 401. Missing/unknown routes are HTTP 404.
Frontend and API adapters both interpret the completed public result as gates.

## SATEL integration and reproduction

The editor branch containing the HR example is required. Install its dependencies
with `npm ci` in `petri-net-app`. Then, in this standalone directory:

```powershell
$env:SATEL_EDITOR_ROOT = 'C:\Users\levil\cursor\Browser-Petri-Net-Editor\petri-net-app'
$env:PYTHON = 'py'
npm install
npx playwright install chromium
npm run generate
npm run test:baseline
npm run test:mutants
npm run stress
py -3 -m unittest discover -s tests -p '*_test.py' -v
```

Node 22+ and Python 3.11+ are required for the experiment scripts. Set
`SATEL_CHROMIUM` to use an existing Chromium binary if desired. Tests start their
own backend and use a separate database per campaign process and mutation mode
under `data/runs/`; they do not reset the interactive application's database.
The test-only reset endpoint is enabled only by `--test-mode` and requires the
`X-Test-Key` header (`HR_TEST_KEY` in adapters; backend `--test-key`). It clears the
November test fixtures and sessions while retaining historical mock data.

`specification/hr.copn` is the concrete APN source; `hr.apn.json` includes the
initial marking and test intentions. The editor also exposes **HR management —
Reference** in Examples. The generic APN has four shared places, 21 transitions, 12 public methods and
six gates. Its default initial marking contains 12 staff members with two work
and two vacation slots each in November 2026. Employee identities, company and
manager relationships, and record IDs are data in tokens; no rule is specialized
to an employee or record slot. Increasing the roster or the slot bound changes
only the initial marking. The seeded database is intentionally much larger.
The APN is an abstraction of the tested scope, not a model of every historical row.

The previous expanded model remains in **Examples → HR management — Expanded
benchmark** and `specification/hr-expanded.copn`. Its earlier measurements are
in `EXPANDED_RESULTS.md` and `results/expanded/`.

Nine intentions cover all 25 ordered pairs of the five work types, four vacation
scenarios, three authorization scenarios and all 12 modeled staff members.
The generated suites are admitted only after concrete replay on the reference
APN. They are then frozen and used unchanged against both transports and mutants.
Tests are not hand-selected or re-derived to fit a mutant.

The REST adapter uses authenticated resource endpoints. The Playwright adapter
signs in, fills fields and clicks actual frontend controls, then reads the
completed response displayed by the UI. It uses the reset endpoint only for
fixture setup. It does not call the REST action endpoints to perform test steps.
Both adapters expose the same independently declared method/gate interface.
Neither imports the SUT implementation or receives expected results.

One interaction completes before the next. Timeouts are inconclusive, malformed
responses are adapter errors, and explicit refusals remain distinct from both.
Negative tests can produce multiple experimental paths (including a positive
prefix), so campaign run counts can exceed the number of generated tests.

## Mutations and evidence

Mutation mode is selected when launching the backend; it defaults to `none`.
Available faults: automatic approval of non-standard work, approval by an unrelated
manager, taking pending vacation, double charging taken leave, omitted correction
audit rows, HR crossing company boundaries, and including pending work in totals.
The model and generated expected results remain fixed across those runs.

`results/generic-evidence.zip` contains the tested generic APN JSON, frozen
suites, generation results and all baseline/mutation traces. Compact current
measurements are in `results/generic-summary.json` and `generic-stress.json`. See `RESULTS.md` for outcomes and limitations. Reference
baseline checks are performed before mutation campaigns. `results/expanded/preflight-findings.json`
records the original authoring/harness issues.
Run `npm run generate` before campaigns in a fresh checkout, or extract
`results/generic-evidence.zip` at this project root to reuse the exact tested suite.
The double-charge mutant deliberately violates the Nat gate type for long leave;
this is retained as an interface error, so the full mutant command exits nonzero.
Use `node experiments/probe-type-error.mjs` to inspect that output independently.

## Stress methodology

The recursive `WorkLog = End | Entry(kind, minutes, rest)` ADT has one equation
per work type. `reviews` recursively counts entries requiring manager review.
The two-entry executable suite derives 25 classes through SATEL term unfolding
and class-disjointness checking, then performs whole-sequence selection/admission.
The stress matrix increases known list lengths and unknown-shape depth bounds.

The benchmark separately records classes, residual branches, overlap unknowns,
visited branches, equation attempts, solver timings and memory, with an independent
procedural check of every returned witness. Each configuration runs in its own
process after Z3 initialization, twice, with explicit branch/time bounds. Run it
without other test jobs for meaningful timings. Partial results and hard timeouts
are reported as limits; they never imply infeasibility or exhaustive coverage.

The custom WorkLog ADT belongs to symbolic test derivation. Executable APN record
tokens use the supported Pair/Nat/Bool representation; it is not a new arbitrary
custom-sort runtime. Increasing mock DB volume, APN breadth, sequence length and
ADT depth are separate dimensions and must not be conflated.

## Generic marking benchmark

Run `node experiments/generic-stress.mjs` without other experiment jobs. It
compares the expanded reference with the generic reference, then increases the
generic roster to 48, 120 and 256 staff, and finally uses eight slots per person.
The same two-entry WorkLog intention is derived in each configuration. This
measures symbolic selection over larger shared markings; it does not claim
SUT coverage of every employee or record in those enlarged configurations.

The four shared places use right-nested built-in Pair values:

| Place | Token fields, in order |
| --- | --- |
| `employees` | ID, company, manager, remaining days, audit count, approved minutes |
| `principals` | ID, company, role (1 employee, 2 manager, 3 HR) |
| `timeEntries` | Record ID, employee ID, work type, minutes, status |
| `vacations` | Record ID, employee ID, days, status |

Empty reserved records have status 0; the normal statuses are unchanged. Read
operations consume and reproduce the same tokens. Writes update only the matched
employee and record. Approved minutes are maintained incrementally; differential
tests compare them against the expanded model's independent summation across
interleaved employees and every old/new approval-state correction combination.
This uses existing Pair/Nat/Bool support, not a new custom Employee-sort runtime.

## Indexed selection follow-up

[INDEX_RESULTS.md](INDEX_RESULTS.md) records the follow-up profiling and indexing
experiment. `node experiments/index-benchmark.mjs` runs the 256-person, two/eight
slot cases with a five-minute sequence budget. Use `--configs` with a JSON array
of `{employees, slots, indexed, sequenceTimeMs}` to compare indexed and exhaustive
candidate scanning. `--out NAME` writes `results/NAME.json`. Run timing experiments
sequentially without competing test/build/campaign jobs; Z3 initialization is
recorded separately. `node experiments/verify-index.mjs` regenerates and admits
all nine intentions, compares every test pair with `results/suites.json`, and
writes `results/index-verification.json` without overwriting the frozen suite.


## Recursive depth and finite coverage audit

[DEPTH_RESULTS.md](DEPTH_RESULTS.md) varies WorkLog lengths 1–5 over an identical
12-person, five-slot marking, using the same HR equations and business rules.
It separates algebraic feasibility/unfolding, overlap checks, executable selection
and concrete admission. An independent finite enumerator checks membership,
coverage, overlap, results and representatives, including invalid boundary values.

Run the following sequentially, without other test or build jobs during timing:

```sh
node experiments/depth-benchmark.mjs --mode baseline
node experiments/depth-benchmark.mjs --mode final
node experiments/depth-report.mjs depth-baseline depth-final
node --test experiments/depth-audit.test.mjs
node experiments/verify-index.mjs --out depth-verification
node experiments/depth-summary.mjs
```

Compact reports are committed under `results/depth-*.json`. Full intermediate
`depth-domains-*.json` files are generated locally for the independent audit.
The audit interprets this WorkLog fixture's restricted term/guard language; an
unsupported expression makes its check incomplete. Finite coverage results do
not replace the engine's unresolved branches or establish thesis-level coverage.
