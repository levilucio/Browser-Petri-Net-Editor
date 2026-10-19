# Increment 23 — shared witness search for ordinary sequences and refusals

19 October 2026. Branch: `codex/satel-public-methods`. Baseline commit:
`9c20ba745ff0a0ae39c27df67c1fb33d87431156`.

## What changed

Ordinary executable sequences previously disabled the Boolean preservation that
joint sequence/HML search used. A complete scalar conjunction could consequently
be checked again after each Boolean split, even when it contained no residual
ADT operation and Z3 could solve the whole formula directly. The coupled
allocator exposed this cost: the previous completed 16-resource runs made 67
solver-adapter calls.

Existential witness search now preserves solver-ready Boolean conditions by
default. `ExecutableSequence.js` no longer chooses that behaviour according to
whether an HML property exists. The same default in `GenericSubuniformity.js`
also serves ordinary refusal companions. The internal `preserveBooleanStructure:
false` option remains available for diagnostic comparisons; it is not a new GUI
setting.

This is a small implementation change with a deliberately narrow scope:

- Subuniformity class enumeration still splits Boolean alternatives and checks
  overlap. Its behaviour is not controlled by the new witness-search default.
- Conditions containing residual ADT calls or undefined terms still need
  narrowing and short-circuit handling. Z3 only receives solver-ready conditions.
- A sequence witness is still selected against the complete path constraints,
  with shared variables and the model's initial marking. No extra intermediate
  assignments are introduced.
- Refusal still negates every possible rule/input binding at the reached marking.
  Unknown or exhausted searches produce no refusal test. The eligible-seed and
  bounded-companion policies are unchanged.
- All candidates still pass reference admission before entering the suite.
  The existing independent model decoding/constraint checks also remain in place.

There is no new cache, incremental Z3 context, formula-DAG representation, or
increase in production search budgets in this increment. The improvement comes
from avoiding repeated Boolean decomposition and its associated checks.

## Paired benchmark

The [case list](../../petri-net-app/tools/node/benchmarks/increment-23-cases.json)
uses the existing coupled resource allocator at sizes 4, 8, 16, 32 and 64,
four-site fulfilment, two-worker/four-round audit history, and recursive tree
class derivation at unfolding depth six. Three trials per configuration were
measured before and after: **48 completed trial records**, with no child deadline
or runtime-error outcome.

Both phases used the same host and runner: Node 24.19.0, Linux x64, Intel Xeon
Platinum 8573C, nine reported logical CPUs. The baseline source hashes were
verified against the commit above. The after hashes differ only in
`ExecutableSequence.js` and `GenericSubuniformity.js`. Neither the regression
suite nor the build ran concurrently with the benchmarks.

Production limits stayed at 1 second per SMT check, 4 seconds for derivation,
5 seconds for sequence search, 4 seconds for HML construction, 256 narrowing
branches, and 100,000 sequence-search work units. The isolated child had a
**45-second outer deadline in both phases**, covering initialization and all
three trials, including admission/replay. This is a benchmark process safeguard,
not a change to application search limits. The earlier increment-22 experiment
used a 30-second outer deadline and is not the baseline for the table below.

The first trial has cold model caches; later trials reuse process caches. Z3
initialization is timed separately. These are three-trial medians of selection
time, excluding model construction, initialization, admission and replay.

| Workload | Before: selected trials / time | After: selected trials / time | Median adapter calls, before → after |
|---|---|---|---:|
| Allocator, 4 resources | 3/3, 2.234 s | 3/3, 0.104 s | 19 → 4 |
| Allocator, 8 resources | 3/3, 2.050 s | 3/3, 0.115 s | 35 → 4 |
| Allocator, 16 resources | 1/3, 5.033 s | 3/3, 0.135 s | 54 → 4 |
| Allocator, 32 resources | 0/3, 5.119 s | 3/3, 0.340 s | 25 → 4 |
| Allocator, 64 resources | 0/3, 5.334 s | 3/3, 0.568 s | 17 → 4 |
| Fulfilment: 4 sites, 8 policies, 20 pairs | 2/3, 5.059 s | 3/3, 1.782 s | 136 → 64 |
| Workers: 2 workers, 4 rounds, audit history | 3/3, 0.371 s | 3/3, 0.288 s | 9 → 9 |

Before medians include unresolved trials where indicated, so they are not
successful completion times. The lower call counts in the larger baseline
allocators reflect search interruption, not less work needed to solve them.
All after allocator trials made exactly four adapter calls: three SAT results
and one UNSAT result. Each adapter call can itself perform the existing optional
numeric preference check; four adapter calls does not mean four underlying
`check()` invocations.

For the 64-resource allocator, the after median for model construction, selection,
reference admission and a separate reference replay combined was **0.639 s**;
the cold selection trial alone took 1.044 s. Peak process RSS across its three
trials was about 250 MiB, including runtime initialization. This is not an
incremental workload-memory figure.

Wall-clock variability is substantial in this shared execution environment.
The unchanged worker query count is a useful control: its lower observed time
should not be attributed to this change. The large reduction in allocator query
count and consistent resolution of the 32/64-resource cases are the stronger
results. There is no general speedup claim or estimate of asymptotic complexity.

The tree control still returns four classes and 20 residual branches, with 53
adapter calls in every trial and unproved coverage. Median time was 0.424 s before
and 0.446 s after. Bounded class enumeration has not become complete.

### Reference and mutation checks

All **21 after-phase APN selections** passed both reference admission and a
separate reference replay, compared with 12 selected APN trials before. The three
tree trials in each phase are partial class derivations, not selected tests.

Mutation checks run on the first trial of each configured APN:

- Both allocator faults, missing confirmation and wrong allocation, fail at
  every tested size: ten failing replays across five configurations.
- Fulfilment detects missing dispatch and wrong receipt. The stock-leak mutant
  remains the expected survivor because the intention does not inspect that
  internal state.
- The worker suite detects missing worker and wrong receipt.

Thus the after benchmark records **14 failing mutant replays and one expected
survivor**, with no replay errors. These are configuration-level experiments,
not 15 distinct mutation families. The newly completed large-allocator checks
exercise known mutants; they do not establish discovery of new specification
bugs or mutation completeness.

Raw records: [before JSON](performance/increment-23-before.json),
[before JSONL](performance/increment-23-before.json.jsonl),
[after JSON](performance/increment-23-after.json),
[after JSONL](performance/increment-23-after.json.jsonl).

## Regression coverage

The complete SATEL suite passes: **40 suites / 430 tests**, including five new
cases in this increment and the existing GUI, HML, negative and black-box checks.
The production build also passes, with Vite bundle/chunking warnings. Browser
performance was not measured in this increment.

The allocator regression now covers 4, 16, 32 and 64 resources under an
eight-branch allowance. It checks the coupled quantity inequalities, total budget,
the reached inventory marking, confirmation, and both existing mutants. A branch
allowance detects accidental Boolean expansion without machine-dependent timing
assertions.

A solver regression checks that a completed scalar conjunction produces its
joint witness with one adapter call and a one-branch allowance. Existing custom
ADT/Boolean and short-circuit undefinedness regressions now exercise the default
behaviour without explicitly enabling preservation.

A new negative regression starts from an admitted deterministic request, then
finds a refusal against two available input tokens and a separate alternative
rule under a four-branch allowance. The generated refusal preserves the marking,
passes reference replay, and fails a mutant that accepts it. This does not extend
negative companion generation to nondeterministic seed executions.

## Try it on a laptop

```sh
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm ci
npm run dev
```

Use **Load** to open the existing
`docs/satel/performance/models/allocation-32-resources-reference.pnml`.
In **SATEL → Generated tests**, generate its intention. The selected allocation
and confirmation should now resolve without an HML additional requirement.
Then load `allocation-32-resources-missing-confirmation.pnml` or
`allocation-32-resources-wrong-allocation.pnml` and replay the frozen suite.
Both should fail. These are existing loadable files, not new Examples menu items.

For the measured configurations, from `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js \
  --cases tools/node/benchmarks/increment-23-cases.json --runs 3 \
  --hard-timeout-ms 45000 \
  --out ../docs/satel/performance/local-increment-23.json
npm test -- --runInBand src/__tests__/satel
```

For a baseline comparison, use a separate worktree at the commit at the top of
this document and copy in the same case list. CLI timings are not browser
responsiveness measurements, and GUI defaults may differ from these explicit
benchmark budgets.

## Next boundary

The next increment should preserve shared HML constraints through substitution
and SMT translation, using the paired audit/non-audit worker models. Their
construction-work and expanded-expression limits were not changed or retested at
larger sizes here. A shared representation must retain variable identity,
branch eligibility and guarded definedness; dropping history or increasing
budgets is not a substitute.

Recursive ADT residuals, nonlinear arithmetic, cooperative deadline overruns and
black-box observability limits also remain. The present results support practical
bounded test generation for these models; they do not prove completeness,
bisimulation, or equivalence to the thesis's semantic partitions.
