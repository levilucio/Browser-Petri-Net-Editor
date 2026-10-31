# Increment 51 — interaction-history scaling

Research log, 31 October 2026. Follows [post-refusal observations](increment-50-post-refusal-probes.md).

## Pre-experiment design

Hold a two-entry WorkLog algebraic goal (25 kind regions), the generic HR APN,
12-person roster and two slots per employee fixed. Vary only the observation
protocol length: 25, 50 and 100 stimulation/observation pairs. The protocols
share prefixes: ten setup pairs followed by three, eight or eighteen five-pair
cycles of HR correction, manager decision, record read, totals and audit count.
Each cycle changes state and checks it; this is not padding with repeated reads.

Run three fresh worker processes per length, serially without competing builds
or tests. Record Z3 initialization, protocol compilation, algebraic derivation,
executable selection, admission and memory separately. Compare region identities,
selected witnesses and the common-prefix pairs across lengths and repetitions.
Preserve finite-audit and explicit unresolved/budget results. Measurements are
fixture-specific trials, not complexity bounds or operational confidence claims.

Execute one frozen suite per length through REST. Use two predeclared browser
kind vectors, `[0,0]` and `[1,3]`, covering standard and non-standard setup paths.
Require unmutated baselines before a mutant that corrupts the tenth correction
of the same record. It should survive the short prefixes and be exposed later
in the 100-pair sequence. Do not tailor representatives after seeing results.

## Limit inspection and corrected expectation

Repository inspection found an executable-selection hard limit of **32 pairs**.
The earlier proposal identified the explicit HML formula validator's 64-level
limit, but that limit is not on the normal deterministic sequence admission
path. Both facts must remain distinct. Add an explicit bounded
`maxSequencePairs` option while retaining default 32; leave explicit HML formula
validation unchanged. Long sequence success will not establish support for
arbitrary equally deep branching properties or nondeterministic HML fallback.

The ordinary black-box campaign derives an experimental path and evidence from
the positive sequence. Its generated sequence formula is not an imported HML
formula checked by `validateFormula`. Record that boundary rather than claiming
the explicit HML depth limit has been raised.

All research Markdown is saved in this repository during the work. After the
experiment, consolidate a claim–evidence–assumption matrix for paper preparation;
do not silently turn finite validation into a thesis correspondence proof.

## Implementation, results and review

The selection option is implemented with unchanged default 32, hard configuration
ceiling 256 and explicit experiment budget 128. Length exhaustion reports
`sequence-length-limit`; search-node exhaustion remains `resource-limit`. Four
focused regressions cover long-history witness selection, retained bounds,
invalid budgets and the unchanged explicit HML validator. Their first fixture
omitted the required intention name and was corrected before use; no runtime
semantics depended on that setup failure.

Exploratory 25/100-pair runs both admitted all 25 regions. Their timings are kept
in `sequence-preflight.json` and excluded from the controlled matrix, since
environment restoration and checks could overlap them. Early profiling points
to accumulated prefix-solver work as the dominant cost; this experiment measures
that behavior without changing the solver strategy.

Workspace maintenance removed the earlier local checkout; the published branch
was cloned again. The browser was restored from an npm-packaged Chromium build.
Its convenience extractor failed on archive ownership in this environment;
extracting the same bytes without applying archived ownership produced a working
Chromium 153.0.8010.0. This is setup provenance, not a SUT failure.

The paper matrix is stored in
[paper/hr-claim-evidence-assumptions.md](paper/hr-claim-evidence-assumptions.md).
It retains the earlier B0 identity, separates new evidence from historical
reports, and keeps P1/P2/thesis correspondence and reduction interpretation open.

## Final generation measurements

All nine controlled runs admit all 25 computed regions. The ADT goal, initial
marking, region signatures, selected 15-minute witnesses and repeated suites are
identical; the 25/50-pair tests are exact prefixes of the longer tests.

Median derivation times are 0.81 / 0.75 / 1.06 seconds; selection is
13.33 / 32.37 / 100.27 seconds; reference admission is 2.55 / 4.88 / 8.42 seconds.
Peak worker RSS medians are 397.8 / 447.8 / 497.3 MiB. Each measurement has three
trials; ranges and raw stage data are retained. Fourfold history growth costs
about 7.5 times the median selection time on this fixture. Prefix constraint
checking accounts for roughly three quarters of selection time, while the
algebraic region count stays fixed. No general complexity claim follows.

The independent finite audit checks 576 inputs per run, with 100 defined inputs
covered exactly once and no unsupported cases or failed witnesses. Engine
coverage remains `not-proved`. Explicit length/node bound probes retain all
25 unresolved classes and label none infeasible; imported HML depth remains 64.

## External campaigns

The baseline passes all 75 REST and six browser tests, including full 100-pair
histories. The late-correction mutant passes every 25/50-pair history and fails
all 25 REST / two browser 100-pair tests. First mismatches occur at pair 53 for
the five standard-first-record regions and at pair 58 for the other twenty.
The browser subset contains one of each. These positions match the predeclared
mutation trigger and protocol, rather than a selection adjusted to results.

All 150 REST and 12 browser executions complete with compatible/mismatch trace
verdicts only. The actually executed lengths total 7,675 and 611 pairs. All
12 paired transport event sequences/verdicts/evidence records match exactly;
all shorter prefixes agree with the corresponding longer runs and every database
passes integrity checks. Baseline HML evidence witnesses the positive sequences;
the mismatching mutant histories remain inconclusive for their existential
whole-sequence formula. The detections are trace-conformance counterexamples.

This closes the planned interaction-length experiment. The evidence supports
bounded feasibility through 100 pairs and a concrete detection benefit of longer
histories, while showing substantial selection cost and no general scaling,
uniformity or thesis-correspondence theorem. The paper matrix now records these
findings alongside prior experiments.

## Final verification

All 1,472 repository tests in 215 Jest suites pass, including four new length
budget/history tests. All 24 Python backend/HTTP tests and the production build
pass. The original nine HR intentions reproduce all 64 frozen tests unchanged.
The 25/50/100-pair suites restore byte for byte. Summary checks pass for manifests,
source hashes, finite audits, complete run membership, budget probes, predicted
late detections, nested traces and matched API/browser evidence. The complete
design, exploratory record, final measurements and paper synthesis are committed
alongside the code for reconstruction.
