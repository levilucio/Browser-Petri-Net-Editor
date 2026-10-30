# Historical expanded HR experiment results

Preserved from commit `200007acc7df11efe935d3e191929c1b3778d57a`. The default
example is now generic; see `RESULTS.md` for current results.

Recorded 30 October 2026. This is a bounded research experiment, not a proof of
HR-system correctness or an estimate of real-world defect-detection rates.

## Deliverables and scale

- Independent vanilla browser UI, Python HTTP/JSON backend and persistent SQLite
  database. The backend has no SATEL dependency.
- Seeded data: **2 companies, 12 departments, 256 staff, 7,680 time records,
  512 historical vacation requests and 256 audit records**. SQLite integrity
  and foreign-key checks pass. The distributed database has no login sessions.
- APN: **72 places, 432 transitions, 1,872 arcs, 12 methods and 6 gates**.
  The synchronous method/gate convention and thesis graphical notation remain.
- Nine intentions generate **64 tests**, admitted by reference replay. Refusal
  formulas also exercise positive prefixes, resulting in **82 runs per transport**.
  Frozen tests are identical across baseline and mutants; a later independent
  re-derivation reproduced all nine suites' stimulation/observation pairs exactly.
- Model scope: 12 staff, two time-entry slots and two vacation slots per person,
  November 2026, initially empty slots and 30 vacation-day units each. The much
  larger historical database is outside that marking abstraction.

## Unmutated stage

**82/82 REST executions and 82/82 Playwright executions were compatible.**
There were zero mismatches, errors or inconclusive baseline verdicts after fixes.
This means no remaining business-behavior discrepancy was found by these tests;
it does not establish correctness beyond the specified scope.

Issues found and corrected before accepting the baseline:

1. A specification-authoring collision reused balance place IDs for transitions.
   Query transition IDs now have distinct names. Concrete syntax round-trips the
   compiled semantics, initial marking, methods and gates.
2. A broad browser selector matched the response element as well as action
   buttons. It now targets buttons explicitly.
3. Concurrent campaigns initially shared a resettable database, invalidating a
   different run's session. Each process/variant now owns a separate database;
   campaign setup also verifies its own server has started. Clean baseline
   reruns passed. This was a harness fault, not an established HR business fault.
4. HTTP review found unsupported route suffixes/excess segments could be
   dispatched as reads. Explicit route-shape validation and regression checks
   now reject them. Non-object JSON bodies return a 400 response.
5. SATEL whole-sequence selection exhausted its default 10,000 branch budget on
   the 432-transition model. The fix prunes only ground-false method guards and
   skips matching two empty gate-output bags. Unknown conditions are retained.
   The completed work-log selection now visits **5,723 branches**, prunes
   **24,210 irrelevant alternatives**, performs 235 prefix
   checks, and selects all 25 classes with zero unresolved/blocked classes.
   With guard pruning but before the empty-bag optimization, it needed 10,243
   visits under an enlarged budget. The initial failed run reached 10,025 visits
   and left 25 classes unresolved. Those stages should not be conflated.
6. Drawing 432 gate edges exposed redundant corridor calculations. The renderer
   now deduplicates corridors, checks shortest routes first and preindexes gate
   endpoints. The notation and chosen shortest clear routes are preserved.

Independent checks: **9 Python backend/HTTP tests**, including role restrictions,
actor spoofing, atomic corrections, persistence and simultaneous approvals that
cannot overdraw the allowance; **1,015 editor/SATEL regression tests in 95 suites**;
**6 built-editor Playwright tests** covering HR worker generation, graphical
notation and the previous quota browser SUT. Both production and browser-test
builds pass. The five graphical-layout unit tests passed again after its
optimization. The regression count refers to the targeted suites, not every
unrelated test in the repository.

## Mutation stage

Each mutation is a separately launched backend. The frozen specification, test
expectations, mock-data seed and adapters stay fixed. Both transports exercise
all 82 runs for each of seven mutants: **1,148 mutant executions** in total.

| Mutation | REST mismatches | UI mismatches | REST / UI interface errors |
| --- | ---: | ---: | ---: |
| `auto-approve-special` | 25 | 25 | 0 / 0 |
| `manager-scope` | 2 | 2 | 0 / 0 |
| `take-pending` | 3 | 3 | 0 / 0 |
| `double-charge` | 2 | 2 | 1 / 1 |
| `correction-no-audit` | 40 | 40 | 0 / 0 |
| `cross-tenant-hr` | 1 | 1 | 0 / 0 |
| `wrong-total` | 24 | 24 | 0 / 0 |

**All seven mutants are detected by ordinary mismatches in both transports.**
All per-test verdicts and recorded interaction events agree between REST and UI.
There are no inconclusive mutation verdicts. Counts indicate affected executions,
not independent defects or mutation-score confidence intervals.

The double-charge mutant also returns **-12** remaining days after taking a
21-day vacation from an allowance of 30. The public `remaining` gate is `Nat`.
The current checker therefore reports the long-vacation case as an
`adapter-error` at step 5 rather than an ordinary observation mismatch. A separate
probe retains the same invalid output from both API and UI in
`results/type-error-probe.json`. We preserve this diagnostic instead of counting
it as a pass or silently converting it into a mismatch. Future work should
separate malformed SUT outputs from implementation errors in the adapter.
Consequently `npm run test:mutants` exits nonzero for this retained contract error;
inspect the recorded verdicts rather than treating the exit code as a clean run.

## Recursive ADT unfolding and subuniformity stress

`WorkLog = End | Entry(kind, minutes, rest)` has five conditional recursive
`reviews` equations, plus the empty-list equation. `reviews` counts non-standard
entries requiring review. The executable two-entry suite derives 25 classes
through the symbolic engine; its protocol then drives work submission, manager
approval/decline, HR correction, totals and audit observations.

The separate stress experiment varies known list lengths and unknown-shape depth
bounds. Each configuration runs in a new process with two sequential trials,
after separately timed Z3 initialization. Both trials share that process, so
warming can affect the second trial. No other experiment jobs ran alongside the
matrix. Limits are 2,048 branch alternatives, a **5-second soft derivation
budget**, and a 35-second hard child-process limit. Environment: Node
v24.22.1, AMD EPYC 9V74 80-Core Processor (9 reported logical CPUs).
Raw solver/branch profiles, memory and source hashes are in `stress.json`.

Numbers below are first / second trial. Unproved overlap checks are unresolved
proof obligations, **not evidence that classes actually overlap**.

| Input | Depth | Emitted classes | Unfinished branches | Unproved overlap checks | Seconds |
| --- | ---: | ---: | ---: | ---: | ---: |
| Known length 1 | 2 | 5 / 5 | 0 / 0 | 0 / 0 | 0.81 / 0.38 |
| Known length 2 | 3 | 25 / 25 | 0 / 0 | 0 / 0 | 2.29 / 1.63 |
| Known length 3 | 4 | 90 / 100 | 3 / 1 | 4005 / 4950 | 7.00 / 7.97 |
| Known length 4 | 5 | 82 / 91 | 11 / 10 | 3321 / 4095 | 6.78 / 7.25 |
| Known length 5 | 6 | 77 / 91 | 16 / 14 | 2926 / 4095 | 6.53 / 7.36 |
| Unknown shape | 2 | 6 / 6 | 25 / 25 | 0 / 0 | 1.58 / 1.08 |
| Unknown shape | 3 | 25 / 25 | 111 / 116 | 300 / 300 | 5.04 / 5.04 |
| Unknown shape | 4 | 18 / 21 | 93 / 105 | 153 / 210 | 5.02 / 5.04 |
| Unknown shape | 6 | 19 / 20 | 107 / 111 | 171 / 190 | 5.03 / 5.02 |
| Unknown shape | 8 | 18 / 20 | 113 / 121 | 153 / 190 | 5.03 / 5.05 |

All **769 emitted witnesses** pass an independent procedural evaluation of their
constructor shape, type/minute constraints and review count. No hard timeout or
witness failure occurred. This checks representative values, not universal
coverage of their classes.

Known lengths one and two resolve fully within the chosen unfolding frontier.
At length three (125 potential work-type combinations) and beyond, the budget
expires before derivation/disjointness certification finishes. Returned classes
from these partial runs must not be treated as fully certified test partitions.
Unknown-shape inputs retain recursive residual branches even at shallow bounds;
increasing depth alone does not ensure more completed classes within a fixed
wall-clock budget. Time-limited results can vary across machines and trials.

The soft budget is not a strict wall-clock cap: bookkeeping and overlap-obligation
construction continue after the search deadline, causing observed overruns of
roughly two to three seconds in the larger known-shape cases. Once the deadline
is exhausted, the quadratic class-pair phase can produce thousands of unknown
checks. These are the main remaining scaling findings. A useful next experiment
would budget class generation and disjointness separately, retain unresolved
pairs compactly, and measure constructor/guard indexing before increasing depth.

The custom WorkLog ADT is used by symbolic test derivation. Executable APN tokens
remain supported Pair/Nat/Bool values. Database volume, APN breadth, sequence
length and recursive ADT depth are separate stress dimensions.

## Reproduce and inspect

See `README.md` for Windows startup, demo accounts, endpoint contracts and commands.
Use the editor branch **codex/satel-hr-stress**. Open **Examples → HR management —
Reference**, then **SATEL → APN source** or **Generated tests**. The first intention
should generate and admit 25/25 work-log tests in the worker.

Evidence includes the concrete APN source and JSON, frozen suites, generation
profiles, baseline/mutation traces, preflight findings, the type-error probe and
the stress matrix. `experiments/verify-generation.mjs` rechecks exact frozen pair
reproduction without replacing the original suites. The downloadable standalone
package includes full raw evidence; the repository keeps source and compact
reports so the SUT can be copied into its own experiment directory.
