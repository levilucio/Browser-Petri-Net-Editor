# HR management SUT

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
Reference** in Examples. The bounded APN has 72 places, 432 transitions, 12 public
methods and six gates. It models 12 staff members with two work and two vacation
slots each in November 2026. The seeded database is intentionally much larger.
The APN is an abstraction of the tested scope, not a model of every historical row.

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

`results/generation.json`, `baseline.json`, `mutations.json` and `stress.json`
contain measured evidence. See `RESULTS.md` for outcomes and limitations. Reference
baseline checks are performed before mutation campaigns. `preflight-findings.json`
records authoring/harness issues found and fixed during the unmutated stage.
The download includes the full frozen suites and traces. The repository copy
keeps compact reports; run `npm run generate` before campaigns in a fresh checkout.
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
