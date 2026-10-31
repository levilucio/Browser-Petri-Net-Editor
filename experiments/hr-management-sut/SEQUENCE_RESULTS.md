# Scaling interaction-history length

Research record, 31 October 2026. See [Increment 51](../../docs/satel/increment-51-sequence-length.md)
for decisions and review findings, and the [paper evidence matrix](../../docs/satel/paper/hr-claim-evidence-assumptions.md)
for the relation to earlier experiments and remaining proof obligations.

## Controlled configuration

This experiment varies **25, 50 and 100 stimulation/observation pairs**. All
configurations have the same two-entry WorkLog algebraic goal, 25 computed kind
regions, 12-person/two-slot APN marking, four places, 21 transitions and 87 tokens.
The actual application's relational database retains the earlier mock population
of 256 staff, 7,680 historical work records and 512 historical vacation records.

Each kind pair has a ten-pair setup: submit two records, read both, approve/decline
non-standard work (or have HR reconfirm standard work), read the results, inspect
approved totals and inspect the audit count. Each subsequent five-pair cycle:

1. HR corrects the first record to pending home-office work, alternating 60/120 minutes.
2. The assigned manager approves it, except every third cycle, which is declined.
3. The employee reads the record's kind, duration and status.
4. The employee reads approved totals, including the unchanged second record.
5. The employee reads the expected audit count.

Three, eight and eighteen cycles produce exactly 25, 50 and 100 pairs. The
shorter histories are exact prefixes of the longer ones for the same region.
These cycles contain state changes and checks, not repeated-read padding.

All three lengths use the same ADT source, goal, unfolding depth and initial
marking. The benchmark checks exact region signatures, selected arguments and
repeated frozen suites. An independent finite audit checks 576 boundary inputs
per generated configuration: 100 defined inputs each belong to exactly one region;
undefined inputs are excluded. This audit does not establish all-Nat coverage.
Engine coverage remains `not-proved`.

## Distinct implementation limits

Executable selection previously had a hard 32-pair limit. The new
`maxSequencePairs` API option retains **32 by default**, accepts explicit integer
budgets from 1 to 256, and is **128 in this experiment**. Exceeding it produces an
unresolved `sequence-length-limit` diagnostic; it is not an infeasible class or a
SUT failure. Other explicit options are 180 seconds and 500,000 selection visits,
2,048 algebraic branches and 60 seconds of algebraic scheduling budget.

The explicit HML formula validator still limits nesting to 64. Deterministic
sequence admission uses sequence replay, so it does not require raising that
formula limit. The black-box campaign derives an internal path/evidence formula
from its finite positive sequence. That is distinct from admitting an explicit
100-level HML formula, which remains rejected. Arbitrary deep branching and
nondeterministic replay fallback are not established by this experiment.

GUI defaults are unchanged; longer executable selection is enabled through the
explicit CLI/API option. This is a named experiment with a bounded configuration,
not removal of resource limits across the application.

## Timing protocol

There are three fresh worker processes per length, in serial order 25/50/100 for
each repetition. Builds, regression tests and external campaigns run afterwards.
Z3 initialization, protocol compilation, algebraic derivation, executable
selection, concrete encoding, reference admission and finite auditing are timed
separately. The workers record per-phase RSS snapshots and Linux process peak RSS;
the latter includes initialization, auditing and bound probes as well as selection.

Exploratory 25/100-pair runs preceded the controlled trials. Their observations
are retained in `sequence-preflight.json` but are not used in the final timing
table: environment setup and development checks could overlap them. Three trials
provide a descriptive median and range, not confidence intervals or a general
complexity model. Longer histories add constraints and stored audit operations;
those are consequences of the changed history length, not additional ADT regions.

## Measured generation results

All nine runs derive, select and admit **all 25 regions**, with no unresolved
algebraic branches, overlap obligations, blocked classes or unresolved executable
selection. Selected durations are 15 minutes for both entries in every region
and length. Goal, marking and region hashes agree across all runs; repeated
same-length suites reconstruct identically, and common-prefix pairs agree exactly.

Times are seconds, reported as **median [minimum–maximum]** over three trials:

| Pairs | Algebraic derivation | Executable selection | Reference admission | Peak worker RSS, MiB |
| ---: | ---: | ---: | ---: | ---: |
| 25 | 0.81 [0.64–0.89] | 13.33 [11.04–16.78] | 2.55 [2.20–2.65] | 397.8 [376.3–398.6] |
| 50 | 0.75 [0.73–0.80] | 32.37 [28.21–32.48] | 4.88 [4.08–5.15] | 447.8 [440.0–462.9] |
| 100 | 1.06 [0.75–1.22] | 100.27 [95.94–103.10] | 8.42 [7.99–8.47] | 497.3 [487.3–500.1] |

Four times the history length costs approximately **7.5 times the median
selection time**, while admission grows about 3.3 times. These observations do
not identify an asymptotic complexity class. The same 25 ADT regions are present
throughout; this is not an increase caused by deeper algebraic unfolding.

Search visits are 4,535 / 8,810 / 17,285. Median time inside prefix constraint
checking is 9.58 / 23.91 / 77.38 seconds, roughly 72–77% of selection time.
That timer includes the prefix-search/constraint-checking path, not exclusively
native Z3 CPU time. It identifies a concrete cost to investigate later, but this
increment does not change prefix-solving heuristics to improve its own benchmark.

Bound checks are explicit: with the default 32-pair limit, the 50/100-pair cases
report all 25 classes unresolved due to length, with none labelled infeasible.
A one-visit search budget similarly leaves all 25 unresolved at each length.
Explicit formula validation accepts the 25/50-level chain and rejects the
100-level chain, as expected from its unchanged 64-level cap.

## External baseline and delayed fault

REST executes all 25 selected tests per length. The browser executes the two
kind vectors `[0,0]` and `[1,3]` per length, declared before seeing outcomes. These
cover both standard and non-standard setup paths. Each test resets November
records/sessions while retaining historical data. Live databases and logs use
temporary directories; each campaign checks SQLite integrity and atomically
publishes its completed report.

The `late-correction-drift` mutant stores a wrong duration starting with the tenth
HR correction of the same record. It counts that record's persisted audit entries,
not protocol position. Correction still produces `ack(true)`; a later record read
must expose the wrong duration. The normal backend and other records retain their
behavior. An independent backend test checks the first nine corrections, the
tenth correction, and a separate record under both normal and mutated modes.

The intended contrast is fixed in advance: all 25/50-pair prefixes should survive,
while 100-pair histories should expose the late effect. Standard first records
receive one HR correction during setup, so the tenth occurs one cycle earlier
than for non-standard first records. The corresponding planned read positions
are 53 and 58. Campaign results are checked against these predictions rather
than changing the test policy after observing failures.

The unmutated baseline passes **75/75 REST tests and 6/6 browser tests**, including
complete 100-pair histories. The mutation contrast matches the prediction:

| Pairs | Baseline REST mismatches / 25 | Mutant REST mismatches / 25 | Baseline browser mismatches / 2 | Mutant browser mismatches / 2 |
| ---: | ---: | ---: | ---: | ---: |
| 25 | 0 | 0 | 0 | 0 |
| 50 | 0 | 0 | 0 | 0 |
| 100 | 0 | 25 | 0 | 2 |

Five REST histories detect the incorrect value at pair 53, and twenty at pair 58;
the browser subset includes one of each. At pair 53, for example, `readTime`
produces a declined 75-minute record where the APN requires 60 minutes. At pair
58 it produces 135 minutes instead of 120. All shorter observed prefixes match
exactly between corresponding short/long tests, including in the mutant runs.

There are **150 REST executions and 12 browser executions** across both variants,
with **7,675 REST pairs and 611 browser pairs actually executed**. Mutation runs
stop at their first mismatch, so nominal test length is not their executed length.
All 12 matched transport event sequences, trace verdicts and HML evidence records
agree exactly. There are no adapter errors, timeouts or inconclusive trace
verdicts; all SQLite integrity checks pass.

Baseline aggregate execution times per length (excluding campaign startup and
final integrity checks) are:

| Pairs per test | REST: 25 tests | Browser: 2 tests |
| ---: | ---: | ---: |
| 25 | 3.54 s | 10.69 s |
| 50 | 6.58 s | 18.42 s |
| 100 | 15.19 s | 36.33 s |

These are single external-campaign measurements, not the three-trial generation
statistics. The denominators differ between transports. Total baseline campaign
times are 25.91 seconds REST and 65.85 seconds browser; mutation campaign times
are 19.53 and 55.33 seconds respectively, with fewer calls due to early stopping.
Runtime provenance records Node 24.22.1, Python 3.12.14, SQLite 3.53.1 and
Chromium 153.0.8010.0 on Linux x64.

All baseline positive-sequence HML evidence records are witnessed. Mutant records
are witnessed for the 50 surviving REST prefixes and inconclusive for the 25
mismatching 100-pair histories (browser: four witnessed, two inconclusive). The
observed trace mismatches do not refute the existential whole-sequence property
in a general hidden nondeterministic SUT. No whole-formula HML counterexample is
claimed for this campaign.

## Validation

- **1,472 repository tests in 215 Jest suites pass**, including four new
  executable-length budget and long-history witness-selection tests.
- **24 Python backend/HTTP tests pass**, including the delayed-fault threshold
  and per-record isolation check under both normal and mutated modes.
- Production build passes; the real frontend is exercised by the twelve browser
  campaign executions. No frontend code was changed for this experiment.
- The original nine HR intentions regenerate exactly the same **64 frozen tests**.
- All three published sequence suites reconstruct byte for byte; the summary
  assertions check source hashes, run membership, bounds, finite audits, nested
  inputs/traces, predicted mismatch positions and exact transport agreement.

## Reproduction

From this SUT directory, install the editor dependencies and run serially:

```sh
node experiments/sequence-benchmark.mjs
node experiments/sequence-restore.mjs
node experiments/sequence-campaign.mjs --transport api
node experiments/sequence-campaign.mjs --transport ui
node experiments/sequence-campaign.mjs --transport api --variants late-correction-drift
node experiments/sequence-campaign.mjs --transport ui --variants late-correction-drift
node experiments/sequence-summary.mjs
```

To replay the committed witnesses without new generation, start at
`sequence-restore.mjs`. It reconstructs all three frozen suites byte for byte.
To repeat measurements, `sequence-benchmark.mjs` deliberately replaces the
manifest; all campaigns must then be repeated. The benchmark has a six-minute
wall guard per child in addition to the engine budgets. A killed or failed worker
is not a completed measurement; its partial phase report is retained.

Use Playwright Chromium or set `SATEL_CHROMIUM` to a compatible binary. The
recorded browser version is in the campaign summary. The manifest retains every
trial, concrete witness, suite hash, finite audit and source hash; full expanded
suites and event logs remain local. The summary verifies inputs, sources,
membership, outcomes, nested traces and matched browser/API evidence.

## Interpretation boundaries

The experiment concerns this fixed deterministic, synchronous model and this
family of histories. It does not establish scaling for arbitrary branching,
larger rosters, deeper ADTs, concurrent requests, indefinite histories or all
possible role/record combinations. All 25 regions being processed does not prove
the thesis's subuniformity correspondence or adequacy of one representative.

Longer tests can detect a deliberately delayed fault; that does not imply that
long tests are always preferable. They cost more and may repeat behavior already
covered by shorter tests. The mutation contrast is purposeful, not an unbiased
estimate of real defect detection. A trace mismatch remains distinct from
whole-formula HML falsity; finite successes do not establish universal conformance.

The earlier SQLite corruption incident remains unresolved. Passing integrity
checks in these campaigns provide evidence about these databases, not a claimed
root-cause fix for the earlier failure.
