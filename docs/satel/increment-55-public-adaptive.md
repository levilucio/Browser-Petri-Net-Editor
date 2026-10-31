# Increment 55. Adaptive HML experiments using the public interface

The campaign ran 480 independent reservation workflows through REST and Playwright.
The public trace oracle detected three of four seeded faults on both transports.
Two faults yielded HML counterexamples. The missing automatic B branch remained
inconclusive after 64 observed automatic allocations to A.

The [pre-run protocol](../../experiments/reservation-sut/public-campaign/PROTOCOL.md)
fixes trial counts, policy and observation rules. The original SUT, APN, five
admitted formulas and mutants come from increment 54 at commit `0303fed`.
The tester makes business calls and reads public gates. SATEL evaluates each new
event against all still-compatible reference markings before the next call.
The adaptive continuation receives a detached copy of the public history.

## Policies and experimental access

On an automatic allocation to A, the policy attempts a second reservation for B.
After the expected refusal it completes the reservation and checks the A receipt.
On allocation to B it completes immediately, preserving the path of the original
B-receipt formula. SATEL stops the trial on the first trace mismatch. Separate
manual policies request A or B directly after opening. These three policies were
authored for this experiment. SATEL supplies the reference oracle and HML evidence
for the frozen intentions.

Each variant/transport received 32 automatic and 16 manual opportunities (eight
per warehouse), fixed in advance. A gateway allowed only reservation business
methods and static frontend resources. It rejected privileged routes and headers.
The gateway recorded precisely the business calls in the saved traces, with zero
denied requests. Browser trials clicked buttons and read response details in the
DOM. Each transport drew its own OS entropy.

The service has one active reservation per installation. The lab started a fresh
process/database per trial, outside the tester. This replicates an initial public
workflow. It does not replicate a previously reached hidden state. Repeated
sampling against a third-party deployment would require a public way to start
comparable business workflows, or explicit accounting for opportunities along
one history. The baseline ran in normal mode. The lab enabled existing mutants
at startup using their required flags. The public gateway excluded all testing
operations throughout. The standalone client also runs against an existing URL.

## Observed opportunities and outcomes

Each cell containing two numbers gives REST / browser counts. The allocation
columns sum to 32 per transport. The final column counts trace mismatches across
all 48 trials per transport.

| Variant | A observed | B observed | 99 observed | Finished after automatic B | Trace mismatches |
| --- | ---: | ---: | ---: | ---: | ---: |
| Baseline | 12 / 18 | 20 / 14 | 0 / 0 | 20 / 14 | 0 / 0 |
| Illegal output | 14 / 13 | 0 / 0 | 18 / 19 | 0 / 0 | 18 / 19 |
| Missing B | 32 / 32 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| Early commitment | 17 / 17 | 15 / 15 | 0 / 0 | 15 / 15 | 7 / 12 |
| Bad B receipt | 15 / 19 | 17 / 13 | 0 / 0 | 17 / 13 | 17 / 13 |

There were 1,432 public stimulation/observation pairs. All 96 baseline trials
were compatible. For the 30 baseline A outcomes the second reservation was
refused and completion still produced receipt A. All 34 baseline B outcomes
continued to receipt B. No unseeded baseline discrepancy was observed.

The 480 trials yielded 86 public trace mismatches and zero execution errors or
trace-level inconclusive verdicts. Four HML formulas were evaluated per automatic
trace and the shared-state formula per manual trace, giving 1,440 individual
formula/trace evaluations. Of these 283 supplied positive witnesses, 67 supplied
counterexamples and 1,090 were inconclusive.

- Illegal output returned 99 on 37 occasions. Each refuted the public safety
  formula forbidding that observation.
- Bad B receipt reached the relevant completion 30 times and returned the wrong
  receipt every time. Each trace refuted the conditional receipt property.
- Early commitment accepted 9/16 REST and 4/16 browser manual requests. The other
  19 were trace mismatches because every compatible APN marking accepted the
  request. All 32 individual evaluations of the branching formula remained
  inconclusive. The successful continuations occurred in separate reservations.
- Missing B had 64 opportunities for automatic allocation, zero B witnesses,
  and zero opportunities to check a receipt after automatic B. All 32 manual
  requests across the two transports succeeded. None of these observations
  establishes that automatic B is impossible. No frequency requirement was assumed.

The aggregate 3/4 trace and 2/4 HML detection results also occurred in increment
54's ordinary campaign. The new evidence shows what the public-only adaptive
workflow exercised, including the state after a refused reallocation. The
experiment does not estimate a detection-rate improvement over fixed paths.

## Reproduction and evidence

From `experiments/reservation-sut`, with the editor's dependencies installed,
run the following commands. Set `SATEL_CHROMIUM` if needed. Use a new staging
directory. The harness refuses to overwrite an earlier run. Different runs can
produce different branch frequencies.

```sh
node public-campaign/run.mjs /tmp/public-reservation-new
node public-campaign/summary.mjs /tmp/public-reservation-new
```

For one live trial against an already available, unopened reservation, run
`node public-campaign/live.mjs http://127.0.0.1:8891 automatic api`. Replace
`api` with `ui` to click through the app. This command advances the supplied
reservation. It performs no provisioning or remote reset.

The [summary](../../experiments/reservation-sut/public-campaign/evidence/summary.json)
gives counts per formula, policy opportunity and transport. The
[trace archive](../../experiments/reservation-sut/public-campaign/evidence/public-traces.zip)
contains all ten compressed raw reports, source hashes and the measured summary.
To verify this realization without executing the SUT again:

```sh
python -m zipfile -e public-campaign/evidence/public-traces.zip /tmp/public-replay
node public-campaign/summary.mjs /tmp/public-replay
```

All 480 traces from the archived files were replayed through SATEL's fixed-path
oracle. Public events, HML evidence, policy decisions, gateway method sequences
and trace verdicts verified. The reconstructed summary matched the published file
byte for byte. The 32 focused black-box and workspace Jest tests passed, including
four new checks for adaptive operation. A separate live-URL smoke test completed
through the public API.
