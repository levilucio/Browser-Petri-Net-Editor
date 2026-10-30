# Increment 48: observable HR histories and representative sensitivity

The preceding depth experiment establishes bounded generation and APN admission
through WorkLog length five. Its protocol only records work, checks acknowledgments
and reads the audit count. This increment adds a separate effectiveness fixture;
that earlier benchmark, the original nine intentions, and their frozen 64 tests
remain unchanged.

## Specification and observations

The new fixture uses the existing `reviews` equations and the same generic HR
APN with 12 employees and five reserved slots. Lengths one, two and three produce
5, 25 and 125 kind regions. Declarative protocol cases distinguish the five work
kinds. Each sequence:

1. Creates a standard 45-minute record for a second employee as an isolation check.
2. Creates the primary employee's work entries, then reads every record back.
3. Checks approved minutes before manager decisions, approves non-standard work
   except training (declined), reads decision results, and checks totals again.
4. Corrects the last entry to approved standard work twice, at 60 and 120 minutes,
   checking the record and total after each correction.
5. Reads the other employee's record and total, then the primary audit count.

The expected audit count is the number of submissions, plus one decision per
non-standard entry, plus two corrections. Expected record states and totals are
specified in the protocol and validated by APN replay. No SUT response is used to
construct expected observations. Each method/gate pair completes before the next.

## Region members and freezing

The normal generator selects and admits one executable member of every derived
region. Two additional policies instantiate durations at 60 and 720 minutes.
The independent WorkLog auditor checks each added witness against its original
region and expected result. Concrete APN replay validates each resulting protocol.
These are extra members of existing regions, not new algebraic partitions or a
new claim of admission completeness.

The committed manifest records concrete kinds/durations, region identities,
policy, browser subset and hashes of the full frozen suites. The restore script
reconstructs those exact suite bytes without repeating solver choices. The
campaign verifies hashes before execution. Both unmutated transports must pass
before any mutant campaign can run. All variants use the same seeded relational
DB, initial-state reset and frozen tests.

REST executes every test. The browser subset is fixed before results: kind vectors
[1], [1,3] and [1,3,0] at lengths one through three, each with the selected and
720-minute representatives. Playwright uses the actual frontend; only fixture
reset uses the testing API. Browser event sequences and verdicts are compared
with the exact same REST tests.

## Deliberate faults

Five new opt-in backend variants supplement the existing `wrong-total` fault:

- `overwrite-earlier`: a third same-day entry corrupts the earliest entry's duration.
- `approval-double-count`: totals count approved decision contributions twice.
- `correction-adds-old`: totals retain an old approved contribution after correction.
- `cross-employee-correction`: a correction also changes another employee's same-day records.
- `cap-long-duration`: the accepted maximum of 720 minutes is stored as 719.
- `wrong-total`: pending work is incorrectly included in approved totals.

These faults are deliberately selected to exercise observable histories, isolation
and duration boundaries. Mutation scores are descriptive for this seeded set, not
an unbiased estimate of fault detection in arbitrary HR software. Error and
inconclusive verdicts never count as detections. Each backend variant is isolated
and tested with direct relational checks as well as the external campaigns.

## Interpretation

A compatible representative and a mismatching second member of the same region
provide a concrete failure of the uniformity assumption for that implementation
and observation protocol. They do not refute the specification's algebraic
partition, establish a flaw in the thesis theorem, or prove that testing finitely
many members establishes uniformity. Equal-size policy comparisons are reported
separately from the larger union, which has three times the test budget.

The finite audits cover kinds 0–5 and durations 14, 15, 720 and 721 at each fixed
length. They do not establish arbitrary-depth or all-duration coverage. The
engine's `coverage: not-proved` status remains unchanged. The six-test browser
subset does not establish frontend equivalence for the full REST matrix.

See [results and reproduction](../../experiments/hr-management-sut/EFFECTIVENESS_RESULTS.md).
