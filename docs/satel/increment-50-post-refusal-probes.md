# Increment 50 — observable state after refusal

Research log, 31 October 2026. Follows [Increment 49](increment-49-hr-negative-tests.md).

## Pre-experiment decisions

The previous 129 negative companions end at refusal. They cannot detect an
implementation that returns refusal while persisting a state change. This
increment will reuse their frozen inputs and append independently declared
observation calls whose expected outputs come exclusively from the APN.

The existing black-box trace runner already continues after refusal and retains
all compatible reference states. Canonical SATEL sequences, however, require a
final refusal; their HML encoding does not describe a continuation after refusal.
We will therefore create explicitly labelled **trace experiments**, not silently
extend or reinterpret SATEL/HML sequences. HML evidence will continue to concern
the original terminal-refusal property only.

Probe policy: for every frozen negative test, try an employee-authorized record
read, totals (time) or balance (vacation), and audit count. Each probe is a separate
reset-and-replay experiment. The APN must establish that a candidate is enabled
and preserves the marking in every reference state compatible with the seed
observations. All output alternatives are retained. Search exhaustion must stop
generation explicitly. This is bounded probe selection, not complete state
observability or negative subuniformity partitioning.

The browser subset remains the eight targets chosen in Increment 49 before
mutation outcomes. Both original positive workflows remain controls. Each
terminal-only negative execution is an ablation control for the corresponding
probe extensions. Both unmutated transports must pass before mutation campaigns.

Four planned faults persist a change and still return refusal: unauthorized time
correction, vacation decision, spurious vacation charge, and audit insertion.
The ordinary backend transaction rolls back exceptions, so these opt-in mutants
must deliberately commit their erroneous write before raising refusal. Historical
mock data must remain unchanged; experimental data and faults stay in November.

Reports will distinguish trace mismatches from inconclusive HML evidence. A
passing finite probe set cannot prove the absence of hidden side effects.

## Implementation and review

`PostRefusalProbes.js` enumerates all seed-observation-compatible reference states,
requires the terminal call to be refused in all of them, and admits only probes
that are enabled and marking-preserving everywhere. Candidate arguments are
supplied; expected public output bags are derived. No SUT outcome participates in
generation. Limits throw an explicit resource-limit diagnostic without returning
a partially admitted plan.

Review identified that private seed marking assertions could silently narrow the
states compatible with public observations. These seeds are now rejected, rather
than allowing inaccessible information to justify probe admission. A regression
test records this boundary. Canonical terminal-refusal syntax and HML semantics
are unchanged; the new artifact explicitly identifies itself as a trace plan.

The frozen 129 negative tests produce 387 admitted probe extensions, no rejected
candidate probes, and 518 REST / 34 preselected browser experiments per variant
including terminal-only ablations and positive controls. A one-binding generation
budget fails explicitly. The unmutated initial baseline passed both transports;
it is repeated after the public-observation validation addition to align source
hashes with the final manifest.

The first browser launch found no Playwright-managed Chromium executable. No
browser execution occurred. The existing local Chromium was selected through
`SATEL_CHROMIUM`; this is an environment setup issue, not a SUT result.

## Campaign results

Final generation took 1.10 seconds and 93.3 MiB final RSS. The final baseline
passes 518 REST and 34 browser executions. Four mutants all survive every
terminal-only refusal test but fail at an added probe. REST mismatches are
20 time-write, 24 vacation-write, one orphan-charge and 28 audit-write;
browser mismatches are respectively two, two, one and two.

All 2,590 REST and 170 browser executions complete without adapter errors,
timeouts or inconclusive trace verdicts. All positive controls remain compatible;
all 170 matched transport event sequences/verdicts/HML records agree. Every
database integrity check passes. Every mismatch is unexpected output at the
probe following a compatible refusal. Original prefixed-refusal HML evidence
remains inconclusive, including on these mismatching runs.

Probe choice matters: the orphan charge is seen by balance but not by reading
the target request, and the spurious audit entry is seen only by audit count.
The explicit terminal-only ablation establishes the incremental detection for
these seeded faults, without claiming general fault-detection completeness.

An additional abstraction check records a surviving internal change: a repeated
decline on an already declined vacation increments the persisted database version
but changes none of the current gate values. All three probes remain compatible.
A backend test independently verifies this case. The REST payload contains the
version but the gate mapping omits it; this is outside the present observable
contract, not a falsely claimed proof of full state preservation.

Full measurements, example calls, reproduction and limits are in
[POST_REFUSAL_RESULTS.md](../../experiments/hr-management-sut/POST_REFUSAL_RESULTS.md).

## Verification record

The original nine HR intentions regenerate exactly the same 64 frozen test pairs.
All 23 Python backend/HTTP tests pass, including six new cases for committed
refusal writes, historical-data isolation and the version-only abstraction limit.
The frozen probe suite reconstructs byte for byte, and summary checks verify run
membership, source hashes, derived probe expectations, refusal compatibility,
mismatch position, terminal ablations, HML scope and exact transport agreement.

The first full repository Jest run passed 1,467 tests and exposed one new test
fixture assertion: a public-scope observation containing an extra private channel
was rejected by canonical normalization before reaching the new private-channel
guard. Its scope was corrected to `listed` so the test exercises that guard.
All six new tests then passed. This was a test-fixture diagnostic expectation,
not a change to implementation semantics or campaign results. The final full
repository run passes **1,468 tests in 214 suites**, and the production build
passes. This is broader than the earlier SATEL-focused regression count.
