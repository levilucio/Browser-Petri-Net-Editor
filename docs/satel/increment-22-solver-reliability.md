# Increment 22 — reliable SAT witnesses and controlled Boolean search

19 October 2026. Branch: `codex/satel-public-methods`. Builds on commit
`7ec722467734580187a89b9ddd9a8c1963c5ee3d` and the bottlenecks identified in
[increment 20](increment-20-scalability.md).

## Changes

1. **Keep a validated witness across optional preferences.** The Z3 adapter now
   decodes the first SAT model and independently checks its sorts and constraints
   before attempting the existing joint preference for numeric values of one.
   A successful preferred model is checked in the same way. An unsatisfiable,
   unknown, failed, or invalid preferred result leaves the original valid
   assignment available. There is no third query to reconstruct the original
   model. Cancellation still propagates. Model handles are explicitly owned
   during decoding and released before the next asynchronous check.
2. **Type prefix constraints before sending them to Z3.** The prefix checker now
   uses the same elaboration as final witness search. In particular, nested
   values in built-in Pair/List constructors receive their required `Any` tags.
   Residual operation calls and undefined expressions are still withheld. An
   UNSAT solver-ready subset can prune a prefix; SAT for that subset does not
   establish a complete executable test.
3. **Preserve each solver-ready Boolean condition during witness search.** With
   Boolean preservation enabled, a residual ADT operation in one condition no
   longer forces an unrelated, already unfolded HML condition to be split into
   alternatives. Conditions containing residual calls or undefined terms still
   undergo short-circuit splitting. Class enumeration retains its existing
   splitting and overlap checks. This increment does not change the partition
   definitions or claim completeness of bounded unfolding.

The changes are in `SymbolicZ3.js` and `GenericSubuniformity.js`. They apply to the
existing GUI generation pipeline without adding controls or changing the test
language. Reference admission and concrete replay remain mandatory.

This is a production implementation of the three diagnostic ideas, **not** the
old diagnostic patch: that patch disabled numeric preferences entirely and did
not explicitly protect undefined alternatives in the new per-condition test.

## Paired measurements

The retained [case list](../../petri-net-app/tools/node/benchmarks/increment-22-cases.json)
contains 16 configurations from the existing scale models and solver workloads.
Both phases requested three trials per configuration, sequentially, on the same
host: Node 24.19.0, Linux x64, Intel Xeon Platinum 8573C, nine reported logical CPUs.
Baseline core sources match the commit above; the source hashes in the reports
show that only the two named solver files changed between phases. No regression
suite or build ran concurrently with either benchmark phase.

Budgets are unchanged: 1 second per SMT check, 4 seconds for derivation, 5 seconds
for sequence search, 4 seconds for HML construction, 256 narrowing branches and
100,000 sequence-search work units. These are cooperative limits and individual
operations can overrun them. The isolated child has a separate 30-second hard
deadline covering initialization and all three trials, including admission and
replay. Initialization is reported separately; the first trial has cold model
caches and subsequent trials reuse caches.

Times below are medians of three **selection** trials, excluding model building,
initialization, admission and replay. Unknown/unresolved times are time spent
without a solution, not successful completion times.

| Workload | Before | After | Median adapter calls, before → after |
|---|---|---|---:|
| Direct linear allocation: 64 quantities plus 64 cumulative variables | Unknown, 1.920 s | SAT, 0.496 s | 1 → 1 |
| Four workers, two rounds, merged states | Unresolved, 5.074 s | Selected, 0.260 s | 194 → 9 |
| Two workers, four rounds, merged states | Unresolved, 5.102 s | Selected, 0.277 s | 129 → 9 |
| Two workers, four rounds, audit history | Unresolved, 5.087 s | Selected, 0.246 s | 157 → 9 |
| Fulfilment: four sites, eight policies, 20 pairs | Selected, 3.064 s | Selected, 3.552 s | 136 → 136 |
| Coupled resource APN: 16 parameters | Selected, 4.227 s | Selected, 3.554 s | 67 → 67 |
| Coupled resource APN: 32 parameters | Unresolved, 5.171 s | Unresolved, 5.223 s | 55 → 35 |
| Coupled resource APN: 64 parameters | Unresolved, 5.278 s | Unresolved, 5.508 s | 23 → 16 |
| Custom invoice: 16 fixed-price lines | SAT, 0.535 s | SAT, 0.455 s | 18 → 18 |
| Custom invoice: four variable-price lines | Unknown, 1.293 s | Unknown, 1.216 s | 6 → 6 |
| Recursive tree, unfolding depth six | Partial, 0.358 s | Partial, 0.319 s | 53 → 53 |

The direct allocation baseline explicitly reported failure to restore a witness
after preference checking. All three new trials retain a validated assignment.
The adapter-call count of one hides the internal initial/preference solver
checks; it does not mean a single underlying `check()`.

For the worker cases, all nine new selection trials completed, passed reference
admission, and passed a separate concrete reference replay. Both worker mutants
failed in each of the three configurations where mutation checks were requested.
This is evidence for these bounded properties, not a general speedup or
bisimulation result. The combined experiment does not isolate each fix's causal
contribution. Fulfilment is slower in this small sample despite eliminating its
prefix encoding errors; both the original and preferred witnesses now incur
validation work when the preference succeeds.

The tree workload still returns four classes and 20 unresolved branches, with
coverage explicitly unproved. The eight-slot pigeonhole control remains unknown
under its one-second SMT allowance in both phases. It is never reported as SAT.

### Incomplete large fulfilment measurement

The 128-site model has 1,923 places, 640 rules, 6,912 arcs and a 20-pair intention.
The baseline's three trials were unresolved. After the change, the first trial
was unresolved after 6.657 seconds; the second selected in 4.269 seconds, followed
by 3.593 seconds of admission and 3.217 seconds of successful reference replay.
The child then reached its 30-second overall deadline before a third sample was
recorded. **There is no three-trial after median for this model.** The incomplete
record is retained, not replaced with a successful rerun.

Across the full comparison, 95 of 96 requested trial records were completed:

| Recorded outcome | Before (48) | After (47) |
|---|---:|---:|
| Selected APN tests | 6 | 16 |
| SAT direct/equation witnesses | 3 | 6 |
| Partial class derivations | 3 | 3 |
| Unknown solver/equation queries | 9 | 6 |
| Unresolved APN selections | 27 | 16 |

All 16 selected after-trials passed reference admission and replay. Mutation
checks run on the first trial of configurations marked `mutations`: the after
phase has ten failing mutation replays and the one expected stock-leak survivor.
These are configuration-level checks, not eleven distinct mutation families.
No runtime-error outcome was recorded. The incomplete child and unresolved
searches prevent any claim that the larger workloads now reliably complete.

Raw evidence: [before JSON](performance/increment-22-before.json),
[before JSONL](performance/increment-22-before.json.jsonl),
[after JSON](performance/increment-22-after.json),
[after JSONL](performance/increment-22-after.json.jsonl).

## Verification

The complete SATEL regression suite passes: **40 suites / 425 tests**, including
19 additional cases in this increment. These include existing negative/refusal,
algebraic HML, nondeterministic, GUI and black-box regressions.
The production build also passes; Vite reports chunking/sourcemap warnings.

The new solver regressions force optional-check UNSAT, unknown and exceptions
deterministically, avoiding timing-dependent tests. They also check successful
preferences, initial unknown, cancellation, typed List/Pair prefix pruning,
residual prefix constraints, independent Boolean formulas alongside custom
equations, short-circuit undefinedness, and unchanged Boolean class enumeration.

The worker regression matrix now includes four workers/two rounds and two
workers/four rounds, with and without audit history. A 32-branch allowance catches
accidental re-expansion without asserting machine-dependent timing. The existing
reference and both mutants are replayed for every configuration.

## Laptop review

```sh
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm ci
npm run dev
```

Load `docs/satel/performance/models/workers-audit-small-reference.pnml` using the
app's **Load** action, then generate in **SATEL → Generated tests**. Load its
`missing-worker` or `wrong-receipt` counterpart and replay the frozen suite. The
existing `allocation-8-resources-reference.pnml` is another useful control.
The large/stress examples intentionally retain unresolved outcomes. GUI defaults
can differ from the explicit benchmark budgets; these are Node measurements,
not browser latency measurements.

To reproduce the new-phase comparison from `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js \
  --cases tools/node/benchmarks/increment-22-cases.json --runs 3 \
  --out ../docs/satel/performance/local-increment-22.json
npm test -- --runInBand src/__tests__/satel
```

For the baseline, use a separate worktree at the commit at the top of this file
and copy the unchanged case list into it. Do not apply the historical diagnostic
patch. Preserve the raw records if a child reaches its deadline.

## Remaining work

These were the remaining tasks at the end of increment 22. The first is addressed
by [increment 23](increment-23-sequence-witness-search.md), with fresh measurements.

1. **Avoid repeated scalar checks on ordinary sequence paths.** The coupled
   16-parameter allocator still makes 67 adapter calls; the 32/64-parameter cases
   remain unresolved. Its current sequence search does not request the Boolean
   preservation used for joint HML search. Extending witness-only preservation
   and removing redundant checks needs its own semantic and benchmark comparison.
2. **Keep shared HML expressions shared through the solver translation.** Four
   workers/four rounds with audit still exceed the construction-work limit;
   eight workers/four rounds without audit exceed the expanded constraint-size
   limit. Existing formula/state memoization does not prevent downstream tree
   duplication. A DAG or auxiliary-definition representation must preserve shared
   variables, branch eligibility, and guarded definedness all the way to SMT.
   Increasing budgets or removing audit history would not solve that problem.
3. **Bound expensive individual operations and improve scheduling.** The largest
   fulfilment case shows cooperative deadline overruns and sensitivity to cold
   caches. A bounded process stopping is distinct from the search resolving.
4. **Retain explicit residual results.** Nonlinear arithmetic, recursive ADT
   unfolding and combinatorial unsatisfiability still exhaust their budgets.
   Neither this increment nor larger limits establishes general termination,
   exhaustive coverage, or equivalence to the thesis's mathematical partitions.
