# Observing state after refusal

Research record, 31 October 2026. Design decisions and review findings are in
[Increment 50](../../docs/satel/increment-50-post-refusal-probes.md). This experiment
extends the [129 frozen negative companions](NEGATIVE_RESULTS.md).

## Research question and semantics

Can public observations detect a persistent state change after an operation that
the SUT correctly reports as refused? Terminal-only negative tests cannot observe
such a change. The experiment compares those same terminal tests with extensions
that make one subsequent observation call, from a fresh reset for each extension.

The black-box trace runner interprets a compatible refusal as preserving the
reference state. It can continue with later calls. The canonical SATEL sequence
and its HML encoding instead require refusal to be terminal. Consequently these
extensions are labelled **trace experiments**, not new SATEL intentions or an
implicit change to the thesis/HML semantics. There is no new editor intention
syntax or editor import for an intermediate refusal.

Every probe run still records HML evidence for its original terminal-refusal
property. That record does not describe the additional observation. A mismatch
after refusal is a trace-conformance counterexample; it is not promoted to a
whole-formula HML counterexample.

## Generation and bounded scope

The source tests and their solver-chosen arguments are unchanged from Increment
49. For each of 129 refusals, a finite policy supplies three candidate calls:

| Source record | Probe calls, each performed by employee 1001 |
| --- | --- |
| Work time | `readTime` on the existing record; `totals`; `auditCount` |
| Vacation | `readVacation` on the existing record; `balance`; `auditCount` |

`PostRefusalProbes.js` enumerates every reference state compatible with the seed's
public observations. It requires refusal in every such state. It then admits a
candidate probe only if all these states enable it and every successor has the
same marking as its predecessor. All resulting public output alternatives are
retained. Private marking assertions and private observation channels are
rejected: inaccessible state must not narrow the black-box alternatives.

Candidate call names, actors and record identities are supplied by this policy.
The APN derives enabledness, marking preservation and expected outputs. This is
not synthesis of all useful observation sequences, not new ADT unfolding, and
not a negative subuniformity partition.

The 387 candidate probes are all admitted, with no rejected candidate or
unresolved search. Probe extensions have **3–10 stimulation/response pairs**,
including the refused pair and the final observation. Each HR plan has one
compatible reference state. Regression examples additionally exercise multiple
states with different possible probe outputs and refusal enabled on only one
branch. A deliberately restricted one-binding generation budget reports
`resource-limit`; no partial plan is published.

Generation and frozen-bundle construction took **1.10 seconds**, with final RSS
**93.3 MiB**. This is one trial on this fixture; it does not measure ADT unfolding
or establish general scalability. Memory measurements are process RSS snapshots,
not peak memory. Timing jobs ran serially without test/build competition.

## SUT faults and experiment design

Four opt-in backend mutants deliberately commit an erroneous write before
re-raising the original refusal. The normal backend rolls back exceptions. Only
November experiment records are affected; historical mock data is retained.

| Mutant | Persisted fault despite refusal | Intended observation |
| --- | --- | --- |
| `refusal-time-write` | Applies the requested unauthorized time correction | Record read; totals if the approved contribution changes |
| `refusal-vacation-write` | Applies a forbidden vacation decision | Record read; balance if the charged status changes |
| `refusal-balance-charge` | Creates an orphan approved one-day reservation while refusing to take a pending request | Balance; the requested record remains unchanged |
| `refusal-audit-write` | Inserts an audit entry for a refused correction | Audit count; the target record remains unchanged |

Each variant executes 518 REST experiments: 129 terminal-only ablations, 387 probe
extensions and two positive workflow controls. The browser runs the same eight
negative targets preselected in Increment 49: eight terminal ablations, 24 probe
extensions and both positive controls, totalling 34 executions. Probe order and
browser membership are fixed before inspecting mutant results.

The unmutated REST and browser campaigns must both pass before mutants run.
Each run resets November data and sessions. Live SQLite databases and logs use
temporary directories, completed reports are published atomically, and SQLite
integrity is checked for each campaign. This retains the containment introduced
after the earlier corruption incident without claiming its root cause was fixed.

## Results

The unmutated SUT passes **518/518 REST and 34/34 browser executions**. All four
mutants are detected through both transports. Every terminal-only ablation and
every positive workflow control remains compatible for every variant. Thus the
new detections depend on the additional observation, not the original refusal.

| Variant | REST probe mismatches / 387 | Browser probe mismatches / 24 | REST time | Browser time |
| --- | ---: | ---: | ---: | ---: |
| none | 0 | 0 | 14.35 s | 28.52 s |
| refusal-time-write | 20 | 2 | 14.65 s | 29.04 s |
| refusal-vacation-write | 24 | 2 | 13.98 s | 28.84 s |
| refusal-balance-charge | 1 | 1 | 15.77 s | 28.59 s |
| refusal-audit-write | 28 | 2 | 14.31 s | 28.34 s |

REST probe-specific detections explain the difference in observability:

| Mutant | Record read | Totals or balance | Audit count |
| --- | ---: | ---: | ---: |
| refusal-time-write | 12 | 8 | 0 |
| refusal-vacation-write | 14 | 10 | 0 |
| refusal-balance-charge | 0 | 1 | 0 |
| refusal-audit-write | 0 | 0 | 28 |

Across five variants there are **2,590 REST and 170 browser executions**. All 170
matched event sequences, trace verdicts and original-property HML evidence records
agree exactly. All databases pass integrity checks. There are no adapter errors,
timeouts, inconclusive trace verdicts or unmutated mismatches. The 73 REST and
seven browser mismatches are `unexpected-output` at the probe immediately after
a compatible refusal, never at the refusal itself.

For every variant, HML evidence is witnessed for the two positive controls and
inconclusive for the other 516 REST records (32 browser records). This concerns
the original terminal-refusal formula; it does not express the probe extension.

A concrete three-pair example exposes the orphan charge:

1. `requestVacation(actor=1001, employee=1001, record=19010011, days=5)` produces
   `ack(true)` and creates a pending request.
2. `takeVacation(actor=1001, employee=1001, record=19010011)` is refused with no
   gate outputs. Both the unmutated SUT and mutant report that same refusal.
3. `balance(actor=1001, employee=1001)` must produce `remaining(30)`. The mutant
   produces `remaining(29)` because it persisted an unrelated one-day charge.

Reading that pending request instead remains compatible. Similarly, the audit
fault leaves record contents and aggregates unchanged but produces two audit
entries where the APN expects one. These are concrete reasons to use more than
a target-record read.

## Validation

- Full repository Jest suite: **1,468 tests in 214 suites pass**, including six
  new probe-generation and trace-oracle tests. This is broader than the previous
  SATEL-focused regression count.
- **23 Python backend/HTTP tests pass**, including persistent writes across fresh
  connections, historical-record isolation and the version-only abstraction case.
- Production build passes. The real frontend is exercised by the 170 browser
  campaign executions; no frontend/editor code was changed in this increment.
- All nine original HR intentions regenerate the same **64 frozen tests**.
- Frozen suite reconstruction and all compact-summary assertions pass.

## Reproduction and evidence

From this directory, with dependencies installed as described in the README:

```sh
node experiments/negative-restore.mjs
node experiments/post-refusal-restore.mjs
node experiments/post-refusal-campaign.mjs --transport api
node experiments/post-refusal-campaign.mjs --transport ui
node experiments/post-refusal-campaign.mjs --transport api --variants refusal-time-write,refusal-vacation-write,refusal-balance-charge,refusal-audit-write
node experiments/post-refusal-campaign.mjs --transport ui --variants refusal-time-write,refusal-vacation-write,refusal-balance-charge,refusal-audit-write
node experiments/post-refusal-summary.mjs
```

Install Playwright Chromium, or set `SATEL_CHROMIUM` to a compatible executable.
`node experiments/post-refusal-generate.mjs` performs a fresh APN derivation and
replaces the manifest; both baselines and mutation campaigns must then be rerun.
Restoration reconstructs the frozen suite byte for byte without new selection.

The committed `results/post-refusal-manifest.json` records every source test ID,
prefix call list, probe call, possible output, admission statistic, generation
bound and source hash. The original negative manifest retains the source pairs.
`results/post-refusal-summary.json` contains checked campaign totals, ablation
comparisons, probe-specific detections, transport agreement and first concrete
counterexamples. Full event logs and expanded suites are generated locally.

## Limits

A passing probe set establishes compatibility of those observations only. It does
not prove unchanged hidden state, cover delayed effects, check arbitrary other
employees or records, or establish universal disabledness of the black-box SUT.
Our fixed subset checks frontend/API agreement for matched executions, not full
frontend equivalence. Separate resets never justify merging hidden SUT states.

The APN and SUT share neither business implementation nor imports. Probe admission
and the trace oracle do share the APN successor engine, so their agreement is not
an independent proof of its formal semantics or correspondence with the thesis.
The mutants are deliberately seeded faults, not evidence that these defects
occurred in the unmutated application. Some writes can be invisible under a chosen
valuation or these observation channels; finite witnesses are not universal
fault-detection guarantees.

There is a concrete abstraction limit in this campaign. At the final vacation
checkpoint, the request has been corrected to declined. The repeated decision
`approve=false` under `refusal-vacation-write` increments its database `version`
while retaining the same public days/status. The terminal test and all three
probe extensions remain compatible. An independent backend test verifies that
the version persists and the mapped public values are unchanged. The raw REST
record includes `version`, but the declared `vacationRecord` gate does not. This
change falls outside the present observation contract; it is not evidence of a
missed violation of that contract.
