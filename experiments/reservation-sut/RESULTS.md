# Reservation web SUT: measured HML results

31 October 2026, increment 54. [Pre-run design and research log](../../docs/satel/increment-54-web-hml.md).
[Application, properties and reproduction](README.md). All figures below describe
the final verified campaign, excluding earlier incomplete report exports.

## Main finding

Ordinary trace compatibility detects three of four constructed faults; existing
per-execution HML evidence gives decisive counterexamples for two; controlled
HML exploration detects all four, conditional on the declared control contract.
This is not a general advantage or real-world detection-rate estimate: the faults
were deliberately chosen to expose these semantic distinctions.

The missing automatic-B branch is the strongest contrast. Every observed trace
is allowed by the APN, but the controlled existential property is false. The early
commitment fault gives another distinction: a sampled refusal is a trace mismatch,
while the original branching HML property remains inconclusive without controls.

## Experiment size and baseline

The reference has seven transitions, one internal place, four methods and three
gates. Five explicit finite SATEL intentions generate/admit five tests and six
modal paths. Every path runs with seeds 1..16 for each variant/transport.
The campaigns use real REST requests or Playwright button clicks and public DOM
response details, against a Python server and SQLite database.

- **960 ordinary executions / 2,064 observed pairs** across baseline plus four
  variants and two transports. There are 112 trace mismatches, no adapter errors
  and no trace-level inconclusive runs.
- **50 controlled formula evaluations / 364 public calls**, in addition to reset,
  checkpoint and restore operations. Forty evaluate true and ten false under the
  controls; none is incomplete or erroneous.
- **All 192 ordinary baseline executions are compatible.** All ten controlled
  baseline evaluations are true. No unseeded SUT defect was observed.
- **480 matched ordinary executions and 25 matched controlled evaluations** agree
  between REST and browser: exact public events, ordinary HML evidence, controlled
  values and controlled exploration logs.

Separate validation probes deliberately exercise cutoffs and transport errors;
they are not included in the campaign figures above. Screenshot setup calls and
unit tests are also excluded. Checkpoint/restore HTTP traffic is not counted as
public stimulation/observation pairs.

## Results per transport

Each row below represents 96 ordinary executions and five controlled properties.
REST and browser counts are identical.

| Variant | Trace mismatches | HML witnessed | HML counterexamples | HML inconclusive | Controlled properties false |
| --- | ---: | ---: | ---: | ---: | --- |
| Baseline | 0 | 16 | 0 | 80 | None |
| Illegal output | 32 | 8 | 8 | 80 | Possible B; no 99 |
| Missing automatic B | 0 | 16 | 0 | 80 | Possible B |
| Early commitment | 16 | 16 | 0 | 80 | Both choices |
| Bad B receipt | 8 | 16 | 8 | 72 | Correct receipt after B |

The aggregate ordinary HML evidence is **144 witnessed, 32 counterexamples and
784 inconclusive**. These are per-execution evidence counts, not 960 distinct
formulas. Controlled results are whole-formula evaluations for this finite,
instrumented experiment; they are not pooled ordinary trace evidence.

## Three illustrative findings

**Missing automatic B.** All 16 automatic-B experiments per transport remain HML
inconclusive: each returns A, which is trace-compatible. Controlled enumeration
tries both possible environmental bits from the same ready checkpoint and finds
no B-labelled allocation edge. The existential formula is therefore false under
the complete binary-choice assumption. Explicit manual reservation B still works;
this fault does not remove every way of reaching warehouse B.

**Early commitment.** Opening secretly stores A or B but emits the same `ready`.
Each concrete state loses one manual continuation. The 32 ordinary branching
experiments per transport produce 16 trace mismatches, yet all 32 HML results are
inconclusive. Controlled exploration restores each hidden post-opening state and
tries both continuations from it: the conjunction is false. In the independent
relation tests, both separate successful traces still exist, while even an
existential shared-state conjunction fails. No hidden successors are pooled.

**Bad B receipt.** A trace containing `open/ready; allocate/B; finish/receipt(99)`
is a direct counterexample to the nested universal safety property. Eight of the
16 fixed seeds expose it per transport. The missing-B variant satisfies this same
safety property vacuously; the separate existential property is needed to require
B to be available. This corpus does not assert completion liveness.

## What controlled truth assumes

Every service call consumes at most one binary environmental choice. Enumerating
selector 0 and 1 is exhaustive for that declared relation, including when both
values yield the same outcome. The controlled evaluator traverses actual service
calls; it does not query the APN for SUT successors or expected observations.

All evolving backend state is stored in SQLite. Checkpoints include commitment,
reservation state, warehouse, seeded entropy state and counter. Fixed variant
configuration remains constant. The browser is a stateless command sender for
business purposes: its activity text does not affect request arguments. No other
users, external services or background jobs can change state between calls.

The selector supplies alternative future entropy values. This quantifies over
possible environmental outcomes, not the deterministic future of one fixed seed.
A restoration digest is a consistency check, not a proof that arbitrary hidden
state was captured. These assumptions must be revisited for another SUT.

Only this public finite HML fragment is supported by the experimental evaluator.
Private marking predicates are rejected. Resource exhaustion is inconclusive;
restoration or transport errors yield no truth value. The evaluator is separate
from the editor engine and is not a general certified HML checker.

## Evidence and validation

[summary.json](results/summary.json) contains source/corpus/report hashes, property
counts, first concrete mismatches and transport comparisons. Each
`results/{variant}-{api,ui}.json` retains every ordinary trace and controlled
exploration event, including parent/successor digests and forced environmental
choice. [corpus.json](results/corpus.json) stores the exact admitted formulas/APN.

Eleven Python backend tests and eleven independent finite-relation evaluator tests
pass. The latter include destructive sibling continuations, early commitment,
refusals, observation complements, bad restoration, transport failure, node cutoff
and a late nonmatching response. Both real transports also pass explicit cutoff,
error and unkeyed-control rejection probes. PNML round-trip validation retains all
five intentions and their true reference verdicts. Desktop/mobile layouts were
visually inspected; mobile has no horizontal overflow.

No shared editor engine or frontend code changed. The prior full editor regression
and build are not claimed as rerun in this increment. The application UI adapter
observes response details; these experiments do not verify every presentation
string or all possible interactions in the browser.

## Preserved reporting issue

The initial execution log completed, but several workspace report files retained
incomplete progress snapshots. The summary correctly rejected them. Atomic rename
and final readback alone did not resolve the environment's later file reversion.
The exact persistence cause was not established; this is not classified as a SUT
business defect. Original harness/log/status evidence is preserved under
[evidence/report-finalization](evidence/report-finalization/README.md).

The final campaign wrote to an isolated temporary report directory. All ten reports
and cross-transport comparisons were verified there, then copied into the repo
once. The summary was rerun on the copied files and all raw report hashes matched.
Earlier incomplete exports are excluded from the reported results. No earlier HR
or warehouse failure snapshot was changed.
