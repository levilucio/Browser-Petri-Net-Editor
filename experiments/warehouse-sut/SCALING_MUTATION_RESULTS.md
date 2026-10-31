# Warehouse scaling and explicit mutation experiments

Increment 53, 31 October 2026. Extends the [unmutated baseline](BASELINE_RESULTS.md)
on the same 42-transition APN. [Design and research log](../../docs/satel/increment-53-warehouse-scaling-mutations.md)
records the choices before measurements and distinguishes development preflight
from controlled trials. The original app.py, frontend, baseline results and
preserved ownership-abstraction failure remain unchanged.

## Separate scaling axes

| Axis | Configurations | Held fixed |
| --- | --- | --- |
| Recursive data | 2 / 3 / 4 basket items | 3 unused order IDs, 12 unused line IDs, catalog, role tokens and rules |
| Reference population | 3 / 30 / 120 unused order IDs, 4 line IDs per fixture order | Two-item algebraic goal and protocol, product/warehouse/role population |
| Interaction history | 25 / 50 / 100 pairs | Two-item goal with quantities 1..2, four product combinations and 37-token marking |

The shared data/population base gives eight configurations. Three fresh serial
processes per configuration measure initialization, compilation, derivation,
executable representative selection, encoding, admission and finite audit.
These workers run before the external campaigns and without concurrent test/build
jobs. Record peak process RSS as well as stage times. No asymptotic inference is
made from three points.

The recursive `firstFailure` ADT operation returns the first item that exceeds
remaining stock, or zero when all items fit. Demand for repeated products
accumulates. The test protocol reserves each line sequentially until that point;
it does not model an atomic arbitrary-length batch. The original two-line
`reservePair` tests separately exercise atomicity.

The population experiment increases unused order/line tokens in the reference;
it is not a benchmark of a growing SQL database or a growing product catalog.
The full application seed remains the original 800 historical orders/1,600 lines.

The history prefix has ten pairs followed by cycles of release, stock read,
reservation, order read and audit count. Three/eight/eighteen cycles yield exactly
25/50/100 pairs. Each request completes before the next; no interleaving or
asynchronous delivery was introduced.

## Budgets and scope

Unfolding: 4,096 branches and 60 seconds. Executable selection: 500,000 nodes,
180 seconds and 128 pairs. Each worker also has a 360-second wall-time guard.
Any cutoff remains incomplete, not infeasible. The node-budget probe must return
unresolved selections rather than admitting a partial suite. Default engine
limits and the explicit HML import depth limit remain unchanged.

Independent finite membership checks use a separate arithmetic/term interpreter,
not SATEL evaluation or Z3. For data/population they enumerate products 101/102
and quantities 0/1/8/10/12/13; history checks use 0/1/2/3. Report exactly these
finite sets. The unrestricted engine coverage status remains `not-proved`.

The first-trial selected witnesses are frozen in the manifest; reconstruction
re-encodes them without new SMT choices and checks their pair/suite hashes.
Repeated suite identity, matching population goals/regions/witnesses and nested
history prefixes are explicitly checked and reported.

## External baseline and fault design

Before any mutation campaign, replay admitted data/population suites against the
real baseline: all witnesses through REST and the first positive/negative case
at each data length through the browser. These are trace-only checks, separate
from the mutation corpus and its canonical HML path plans.

The mutation corpus contains the original 62 cases plus all 12 history witnesses.
REST uses all 74 tests. The browser subset was fixed before target outcomes:
12 basket tests; lifecycle s1/s3/s6; read-role a11; negatives n5/n8; and history
product combinations [101,101] and [101,102] at every length (24 tests total).
Each terminal negative also receives the existing three public post-refusal reads.
Fresh reset per path; the browser uses forms/buttons and rendered responses.

Faults live in `backend/mutations.py` and require the separate
`backend/mutation_server.py` entry point, explicit mutation selection, test mode
and a new database. Normal application startup does not load this module.

| Mutation | Deliberately changed behavior |
| --- | --- |
| pair-max-demand | Combines shared-product reservations with max rather than sum |
| tenant-read-leak | Reads an order across the tenant boundary |
| cancel-reservation-leak | Releases line demand but leaves its stock reserved |
| return-double-credit | Adds returned stock twice |
| transfer-loss | Removes source stock without retaining the full destination credit |
| refusal-audit-write | Commits an order audit row despite reporting refusal |
| late-release-audit | Adds an extra audit row from the tenth release onward |

These hypotheses were constructed deliberately. Detection rates are not estimates
for real-world faults, and examples tailored to a hypothesis are not a blinded
comparison. Surviving tests/mutants remain in the results. Only observable trace
mismatches count as detections; SQL diagnostics and adapter failures are separate.
Post-refusal extensions are separate trace tests, not changes to the original
negative HML property. Inconclusive HML evidence is not counted as satisfaction
or a counterexample.

## Reproduction

Run from `experiments/warehouse-sut`, with editor dependencies installed and a
Playwright Chromium executable available (or `SATEL_CHROMIUM` set).

```sh
python -m unittest discover -s tests -p '*_test.py'
node experiments/stress-benchmark.mjs
node experiments/stress-summary.mjs
node experiments/stress-restore.mjs
node experiments/stress-replay.mjs
node experiments/stress-replay-summary.mjs
node experiments/mutation-corpus.mjs
node experiments/mutation-campaign.mjs --variants none
node experiments/mutation-campaign.mjs --variants pair-max-demand,tenant-read-leak,cancel-reservation-leak,return-double-credit,transfer-loss,refusal-audit-write,late-release-audit
node experiments/mutation-summary.mjs
```

To replay published concrete witnesses without new solver choices, omit
`stress-benchmark.mjs` and use the committed manifest with `stress-restore.mjs`.
A new benchmark run produces a new manifest and requires new corpus/baseline and
mutation runs. The corpus and raw reports are regenerable and ignored; compact
summaries, witnesses, source hashes and preflight records are committed.

If a new unseeded baseline failure appears, stop before editing and use
`experiments/preserve.py`, adding `--artifact results/mutation-corpus.json` (or
the relevant reconstructed suite) so the exact stimuli are included. For the
full stress replay, also include `results/stress-manifest.json` and every suite
that command reads, using repeated `--artifact` arguments; alternatively preserve
a minimal reproducer for the single failing suite. Existing archived evidence
is never overwritten.

## Remaining limits

This increment does not compare SATEL selection with a matched-budget random
strategy or prove representative adequacy, universal coverage, unrestricted
scalability, thesis correspondence or arbitrary branching-HML properties. A
successful bounded campaign does not discharge those separate obligations.

## Recorded scaling results

Times are seconds, median [minimum–maximum] across three fresh serial workers.
Peak RSS is median MiB, including all worker phases.

| Configuration | Regions | Tokens | Derivation | Selection | Admission | Peak RSS |
| --- | ---: | ---: | --- | --- | --- | ---: |
| data-2 | 12 | 37 | 1.78 [1.71–1.84] | 4.14 [3.92–4.48] | 0.95 [0.93–1.05] | 419.2 |
| data-3 | 32 | 37 | 4.95 [4.55–5.37] | 14.63 [14.35–15.59] | 2.58 [2.56–2.74] | 444.5 |
| data-4 | 80 | 37 | 12.22 [11.68–14.24] | 48.58 [47.00–50.76] | 7.46 [7.36–9.07] | 542.4 |
| population-30 | 12 | 172 | 2.63 [1.71–3.36] | 4.94 [4.34–5.01] | 1.48 [1.46–1.50] | 406.3 |
| population-120 | 12 | 622 | 1.97 [1.75–2.29] | 4.71 [4.54–4.90] | 3.25 [3.20–3.56] | 420.1 |
| history-25 | 4 | 37 | 1.44 [1.35–1.60] | 5.95 [5.89–6.80] | 0.94 [0.76–1.21] | 398.3 |
| history-50 | 4 | 37 | 1.60 [1.21–1.66] | 18.15 [13.71–18.18] | 1.82 [1.40–1.86] | 389.7 |
| history-100 | 4 | 37 | 1.41 [1.41–1.60] | 44.25 [43.01–56.66] | 2.56 [2.39–3.11] | 413.8 |

All 24 workers complete; every computed region is selected/admitted. Repeated
suites and witnesses are identical. Population controls retain the same goal,
regions and witnesses. History controls retain the same goal, marking, regions
and witnesses; the shorter histories are exact prefixes of the longer ones.

Data size increases regions 12 → 32 → 80. Its successful reserve/read protocol
also grows from 11 → 14 → 17 pairs; selection time therefore includes both larger
data and its longer associated workflow. Derivation timing isolates the algebraic
phase. The dedicated history axis keeps data fixed to measure interaction length
separately. No claim that total selection growth is caused only by ADT unfolding.

At this fixed two-item goal, selection stays around 4–5 seconds across 37/172/622
tokens, while admission increases from 0.95 to 3.25 seconds. Nonmonotonic timings
within that range should not be interpreted as a speedup from adding tokens.

The 100-pair histories take about 7.4 times the selection time of 25-pair histories
on this fixture. No asymptotic complexity result follows. These warehouse timings
are not directly comparable to the HR experiment, which used different regions
and protocols.

The independent data audits enumerate 144/1,728/20,736 inputs for lengths 2/3/4,
with 64/512/4,096 in-scope inputs. The four-region history audits enumerate 64
inputs, 16 in scope. Every defined input has exactly one correct region; all
checked witnesses are valid and no unsupported terms occur. Quantities omitted
from these finite audit sets are not claimed independently covered. The one-node
budget probe yields zero selected, zero blocked and 12 unresolved (`resource-limit`).

See [stress-summary.json](results/stress-summary.json) and
[stress-manifest.json](results/stress-manifest.json) for source hashes, profiles,
repetition checks, concrete witnesses and reconstruction hashes.

## External baseline replay

The larger data/population fixtures pass **148 REST and six browser executions**
(1,472 and 69 pairs). All 154 database checks pass and all six matched traces agree.
Population cases repeat the same concrete stimuli under larger reference markings;
they are executions, not 148 distinct SUT input sequences. Results and hashes:
[stress-replay-summary.json](results/stress-replay-summary.json).

## Interpreting delayed observations

For `pair-max-demand`, two positive canonical traces remain compatible even though
private stock/line reconciliation fails. Their calls observe line reservations
and order aggregates, which both reflect the requested quantities, but omit the
stock balance. The fixed histories expose the discrepancy at pair 12. Stock is
already available through a gate; the blind spot is in those test protocols,
not an intrinsically unobservable database field.

Conversely, `return-double-credit` changes physical stock and its movement ledger
consistently, so those private reconciliation checks pass while public stock reads
contradict the APN. A database invariant check is therefore neither a substitute
for the public oracle nor a valid additional public-gate detection count.

A mismatch first observed after a refused call does not by itself establish that
the refusal caused the corruption. The return fault can affect an earlier
successful operation and be exposed by a later post-refusal stock read. The
`refusal-audit-write` injection specifically changes state while refusing; its
causal mechanism is known from the separate seeded implementation.

## Completed mutation campaign

Both unmutated transports pass before the seven fault variants run. Each variant
executes 154 REST paths and 46 browser paths, including separate post-refusal
extensions. These are executions of 74 REST / 24 browser tests, not 200 distinct
generated tests. Across baseline plus seven variants: **1,600 executions, 17,064
observed pairs, 91 trace mismatches and zero adapter errors**. All 368 matched
REST/browser paths agree on events, trace verdicts, HML records and DB diagnostics.

| Variant | REST mismatches / 154 | Browser mismatches / 46 | Earliest detecting protocol class |
| --- | ---: | ---: | --- |
| Unmutated baseline | 0 | 0 | None |
| pair-max-demand | 10 | 7 | Original canonical tests |
| tenant-read-leak | 8 | 2 | Original canonical tests |
| cancel-reservation-leak | 1 | 1 | Original canonical tests |
| return-double-credit | 3 | 3 | Original canonical tests |
| transfer-loss | 1 | 1 | Original canonical tests |
| refusal-audit-write | 37 | 11 | Post-refusal reads |
| late-release-audit | 4 | 2 | 100-pair histories |

Thus the original canonical tests detect five of seven seeded faults, adding the
fixed post-refusal reads detects six, and adding the fixed long histories detects
all seven, on both transports. This is a cumulative comparison within the frozen
corpus, not a claim that every individual test detects its associated fault.

For `late-release-audit`, all 25- and 50-pair histories remain compatible. Every
100-pair history detects the fault at pair 60: audit count 27, expected 26. The
same nested histories and witnesses are used at each length. This gives a concrete
case where extending the interaction history adds detection power.

Three REST post-refusal traces survive `refusal-audit-write`: n6/n7 refuse
inventory methods without an order argument, so that injection is inactive;
n11 refuses a reservation on order 1002 but the frozen probes read order 1001.
The latter is a real observation-selection limitation. The corpus is retained
unchanged, rather than adding a probe after inspecting this outcome. A future
experiment should derive probes from all records touched by the rejected call.

The 91 mismatches are public trace divergences, not whole-formula HML
counterexamples. Canonical paths yield 353 witnessed and 839 inconclusive HML
records, with zero HML counterexamples; separate post-refusal extensions have no
HML claim. There are 23 stock reconciliation failures, concentrated in
`pair-max-demand` and `cancel-reservation-leak`, and no SQLite/foreign-key failures.
Some private failures occur on publicly compatible traces, as discussed above.

Together with the separate data/population replay, this increment executes
**1,754 paths and 18,605 pairs**. All **354 unmutated baseline executions** are
compatible. No new unseeded SUT defect was observed. The previously preserved
ownership-abstraction defect and its source snapshot remain unchanged.

The committed [mutation-summary.json](results/mutation-summary.json) retains
source/corpus/report hashes, every compact trace result, DB diagnostics and the
first concrete mismatch for each variant/transport. Reproduction regenerates the
full reports from the frozen concrete witnesses; runtime measurements may vary.

## Validation for this increment

All 19 Python tests pass (12 existing and seven mutation-specific). All new
experiment scripts pass Node syntax checks. The 24 controlled workers, finite
audits, exact witness restoration, baseline replay and mutation summary checks
complete successfully. Source-hash checks confirm the normal backend/frontend,
original APN and archived evidence were not changed. The earlier 1,476 Jest tests,
production build and editor browser test belong to increment 52; they were not
rerun for this experiment-only increment. No engine or frontend code changed.
