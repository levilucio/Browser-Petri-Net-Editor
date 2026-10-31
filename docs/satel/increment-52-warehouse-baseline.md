# Increment 52: warehouse/order baseline

Branch `codex/satel-warehouse`, based on HR increment 51 commit `f822e874`.

User requested a second SUT with roughly twice the APN size, the same REST/DB/UI
architecture, and preservation of any naturally encountered faulty SUT before
repair. [Contract](../../experiments/warehouse-sut/CONTRACT.md) records the scope
before implementation. No seeded mutations in this baseline increment.

The target is 42 generic transitions, with complexity arising from multi-record
inventory dependencies and partial lifecycle operations rather than duplicated
rules per entity. Keep synchronous pairs and the thesis boundary/method/gate syntax.

Research log and measured results will be appended as implementation and
baseline campaigns progress. Preserve failed evidence before corrective edits.

## Initial execution and review findings

The first 60 selected tests (20 positive, 40 terminal refusals) were admitted and
passed REST and browser campaigns. All 42 transitions were exercised. A separate
finite basket audit checked 3,136 inputs, of which 576 belong to the scoped domain
(233 acceptable, 343 rejected): no missing/overlapping regions or wrong results.
Engine coverage remains `not-proved` outside that finite audit.

Harness review found the post-refusal selector checked `refused`, whereas the
normalized pair assertion is `blocked`. The first canonical campaigns therefore
contained no extensions. The selector was corrected; 40 extensions were run
separately on each transport. This is a harness omission, not a SUT defect.

Additional review then exposed two actual model/SUT divergences: unused IDs were
already tenant/order-owned in the initial APN. Both use identifiers inside the
finite marking. The full pre-fix application/model/adapter sources and failing
reports were saved before changes in
[initial-slot-ownership](../../experiments/warehouse-sut/evidence/initial-slot-ownership/README.md).
Diagnosis: specification/abstraction defect, not SUT business-logic failure.
Ownership is now assigned on creation. The contract records the clarification,
and two new generated lifecycle tests exercise allocation and reuse. Source code
of the backend/frontend remained unchanged. Final measurements follow below.

## Final evidence and validation

The repaired model derives/admit **62 tests: 22 positive, 40 negative**, maximum
24 pairs. All 42 transitions and 28 methods occur in their replay. Final campaigns
execute 102 canonical paths and 40 post-refusal extensions per transport: **284
executions and 1,742 observed pairs** overall. Every trace is compatible, all 142
matched REST/browser traces/verdicts/HML records agree, and 204 DB integrity/ledger
checks pass. The 102 canonical paths per transport produce 22 witnessed and 80
inconclusive HML records; the separate extensions have no HML claim.

Final validation: 1,476 tests / 216 Jest suites, 12 Python backend tests, production
build and a built-editor browser test for graphical notation and 12-case worker
generation. The independent finite audit and both original allocation reproducers
pass. All archived source/failure-report hashes verify; backend/frontend hashes
are identical to their pre-fix snapshot. No SUT implementation defect was observed.

[Detailed outcomes and limits](../../experiments/warehouse-sut/BASELINE_RESULTS.md)
and [machine-readable summary](../../experiments/warehouse-sut/results/baseline-summary.json)
retain reconstruction inputs and source hashes. The 16.20-second generation result
is a single development measurement, not a scalability benchmark. No changes to
the SATEL engine or the earlier HR experiment were required. No seeded mutations,
scaling comparison or matched-budget random comparison were performed yet.
