# Increment 26 — reuse rule effects and input-binding prefixes

19 October 2026. Branch: `codex/satel-public-methods`. Baseline commit:
`777d7e7ce00e133340fcb996b8eb5fc8a5e7d6b4`.

## Result

The existing **four-worker, four-round audit-history model now resolves under the
normal 10,000-unit construction allowance**. All three benchmark trials selected a
reference-admitted test, passed independent concrete reference replay, and the
first-trial mutation checks detected both worker faults. Median selection time was
0.955 seconds, excluding initialization, admission and replay.

A completed construction now takes 9,398 work units rather than 13,744. Both
constructions visit 681 formula/full-marking pairs and produce 680 symbolic
outcomes. No audit histories were merged or discarded. The larger four-worker,
six-round audit case remains unresolved.

This is a bounded-construction improvement, **not a general wall-clock speedup**.
Several already-resolved cases were slower in these measurements. Cache lookup,
retention and timing variation must be considered alongside reduced repeated work.

## Profiling and implementation

The baseline was instrumented with counters only. For the complete four-worker,
four-round audit construction, its 13,744 work units broke down as follows:

| Phase | Baseline work units |
|---|---:|
| Input binding traversal | 6,460 |
| Expression translation, including cached requests | 5,901 |
| Formula visitation | 681 |
| Observation matching | 680 |
| Yield/final budget checks | 22 |

It also made 1,700 rule requests and guard evaluations, and built 680 successor
markings. These are operation counters, not CPU-time measurements. Obtaining the
complete baseline required a **separate diagnostic case** with 50,000 work units;
the normal baseline correctly stops at 10,000.

`HmlRuleEffects.js` separates rule calculation from property evaluation:

1. Each compiled rule has a construction-local cache, keyed first by all symbolic
   method arguments. A prefix tree then follows input arcs in their original order,
   using each input place's ordered symbolic token array as the next key.
2. A completed prefix stores its environments, token-index selections and matching
   constraints. The longest matching prefix can be reused; changed later inputs
   are still enumerated. Shared variables and previously selected token indices
   remain in the stored prefix.
3. A fully completed rule calculation stores ordered events containing guard
   definedness, enabledness, consumed indices, produced tokens and output
   definedness/range checks. Disabled-rule events retain guard definedness too.
4. The HML builder applies each event to the **current full marking**, removing its
   selected tokens and appending its outputs. It then applies the current property's
   observation filter and recursively evaluates the continuation as before.

A complete cached rule calculation has no successor marking or HML verdict in it.
Output places' existing tokens and unrelated audit places come from the current
marking. Different observation filters do not enter the rule cache.

Input arrays are deliberately not sorted in cache keys: selections contain token
indices. Reordering an array therefore causes a different lookup rather than
reusing indices from another order. Duplicate-token suppression and unit-arc
multiplicity follow the existing binding algorithm.

Binding prefixes are installed only after that prefix level has been completely
enumerated. Rule effects are published only when their iterator is exhausted;
stopping or throwing cannot publish a partial rule result. A valid completed
prefix may survive a later interrupted calculation, but cannot stand in for a
completed universal obligation. All caches disappear with their construction.

### Local correctness argument

For one fixed typed rule, a binding prefix is determined by its method arguments
and the ordered markings of the input arcs already processed. Equal keys therefore
give the same candidate environments, picks and equality constraints. Extending a
cached prefix applies the original matching procedure to all remaining inputs.

For a complete binding, guard/output translation depends on that environment and
the fixed rule and algebra. Reusing its term and definedness expressions preserves
those obligations. Applying the cached picks and outputs to the current full
marking preserves untouched and accumulated tokens. HML filtering, modality,
continuation and expected truth remain outside the cache.

These are the implementation's local invariants, supported by differential concrete
replay tests. They do not constitute a formal proof of the entire implementation,
bisimulation, or equivalence to the thesis's semantic subuniformity construction.

## Resource accounting

Every rule lookup and each replayed cached event calls the work/deadline/cancellation
check. Newly enumerated binding candidates also consume work; expression translation
retains increment 25's checks. Prefix caching materializes candidate lists, so it
can retain more memory than depth-first traversal. Retention is bounded by the
construction's finite limits, not by a separate memory budget.

The numeric work, formula/state and stored-expression limits remain unchanged.
Work measures implementation operations: reusing a prefix avoids traversing its
old binding nodes, while lookup and replay introduce their own work categories.
It must not be interpreted as a fixed semantic-state count or a CPU-time bound.

New counters include `bindingVisits`, `guardEvaluations`, `successorBuilds`,
`ruleRequests`, `ruleCacheHits`, `bindingCacheHits`, `bindingPrefixArcsReused`,
`effectReplays`, and `workByPhase`. `bindingVisits` includes uncached roots and
candidate extensions; a reused-prefix request is counted separately.
`bindingCacheHits` counts partial-prefix reuse when a complete rule result was not
available. Existing `cacheHits` still means formula/full-marking memoization.

No complete formula or negative witness is returned from an incomplete construction.
The finite unfolding, runtime range checks and final independent validation remain.

## Paired benchmark evidence

The [case list](../../petri-net-app/tools/node/benchmarks/increment-26-cases.json)
contains seven normal-budget configurations plus the explicitly labelled diagnostic
case. Each ran three trials before and after: **48 completed trial records**, no
child hard timeout and no runtime-error outcome.

The baseline is the commit above plus the saved
[instrumentation-only patch](performance/increment-26-baseline-instrumentation.patch).
It adds counters without adding budget checks or changing construction control flow.
Source hashes were verified against that exact combination. After-source hashes
were also checked. Only `HmlConstraints.js` and the new `HmlRuleEffects.js` differ
among the benchmarked sources; model generators and benchmark runners are unchanged.

Environment: Node 24.19.0, Linux x64, Intel Xeon Platinum 8573C, nine reported
logical CPUs. Each configuration runs in a separate sequential child. Initialization
is timed separately; first trials have cold model caches and later trials reuse
them. Neither regression suites nor builds ran concurrently with either phase.

Limits are 1 second per SMT check, 4 seconds for derivation, 5 seconds for sequence
search, 4 seconds for HML construction, 256 narrowing branches, 100,000 sequence
work units and a 45-second child deadline. HML defaults remain 10,000 work units,
2,000 formula/state visits and 100,000 stored-expression entries. Only the diagnostic
row overrides HML work to 50,000, equally in both phases.

Times are three-trial **selection medians**, excluding initialization, model creation,
admission and concrete replay. Unresolved times measure reaching a limit, not
successful selection.

| Configuration | Before | After |
|---|---|---|
| 2 workers, 4 rounds, audit | Selected, 0.246 s | Selected, 0.465 s |
| 2 workers, 6 rounds, audit | Selected, 0.530 s | Selected, 0.493 s |
| 4 workers, 3 rounds, audit | Selected, 0.712 s | Selected, 0.654 s |
| 4 workers, 4 rounds, audit | Work limit, 0.203 s | **Selected, 0.955 s** |
| 4 workers, 6 rounds, audit | Work limit, 0.202 s | Work limit, 0.433 s |
| 8 workers, 8 rounds, no audit | Selected, 0.324 s | Selected, 0.535 s |
| 64-resource allocator | Selected, 0.732 s | Selected, 0.807 s |
| Diagnostic: 4 workers, 4 rounds, audit, 50,000 work | Selected, 1.051 s | Selected, 1.897 s |

Each configuration's three trials agreed on status. The normal-budget target now
makes nine SMT adapter calls rather than stopping after three. Resolved worker
controls retain nine calls; the allocator retains four.

The diagnostic and normal after-target run the same completed construction, yet
have substantially different measured times. The allocator does not use HML rule
caching and also varied. These observations limit causal timing claims; they do
not justify dismissing the measured slowdowns. No universal speedup is claimed.

### Complete-construction counters for the target

The before column uses the diagnostic run so it describes a complete construction.
After counters agree in the normal and diagnostic runs.

| Counter | Before | After |
|---|---:|---:|
| Total work | 13,744 | 9,398 |
| Binding visits | 6,460 | 1,424 |
| Guard evaluations | 1,700 | 1,370 |
| Expression requests | 4,080 | 2,760 |
| Full rule cache hits | — | 330 |
| Partial binding-prefix hits | — | 1,350 |
| Formula/full-marking pairs | 681 | 681 |
| Formula/full-marking cache hits | 0 | 0 |
| Successor markings / outcomes | 680 | 680 |
| Expanded structural size | 27,962 | 27,962 |
| Stored graph size | 17,459 | 14,169 |

The normal after-target process peaked at 356.02 MiB RSS. The diagnostic processes
peaked at 369.41 MiB before and 360.95 MiB after. These high-water marks include
initialization, admission, replay and mutation checks; they do not isolate cache
memory or establish a general memory improvement.

Across **normal-budget rows**, selected trials increased from 15 to 18 and unresolved
trials decreased from six to three. Every selected trial passed reference admission
and separate concrete replay. First-trial normal-budget mutation checks increased
from ten to twelve failing replays, with no replay errors. The new two checks are
missing-worker and wrong-receipt on the newly resolved target. They are existing
fault families, not newly discovered defects. The diagnostic row contributes three
additional selected trials and two failing mutant replays in each phase.

Raw evidence: [before JSON](performance/increment-26-before.json),
[before JSONL](performance/increment-26-before.json.jsonl),
[after JSON](performance/increment-26-after.json),
[after JSONL](performance/increment-26-after.json.jsonl).

## Regression verification

New tests cover token reordering and multiplicity, method-argument keys, shared
variables across changed later inputs, interrupted searches and stopped iterators,
current-marking application and output accumulation, competing transitions,
symbolic parameters, observation complements, unsafe guards/outputs, negative
expected truth and missing-input enabledness. They include concrete HML replay
comparisons. The target audit model joins the existing reference/mutant regression
matrix using the normal construction allowance.

The full SATEL suite passed **451 tests in 43 suites** (96.642 seconds). A subsequent
saved-PNML regression verified that the three exported audit target files match the
benchmark generators after GUI import normalization; all 34 tests in that file
passed. This verifies 452 distinct tests across the two runs. No production code
changed after the full-suite run. The production build passed in 15.05 seconds,
with the existing chunk-size and Browserslist-data warnings.

## Laptop GUI review

```sh
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm ci
npm run dev
```

1. Use **Load** to open
   `docs/satel/performance/models/workers-audit-stress-reference.pnml` from the
   repository root. This existing file is the four-worker/four-round audit target.
2. Open **SATEL → Intentions** and inspect its pair sequence and additional branching
   requirement. Four rounds mean modal depth eight; the explicit sequence is still
   two pairs. All branches share the same selected job parameter.
3. In **Generated tests**, select the intention and click **Generate tests**. Expect
   one reference-admitted test. Inspect the instantiated pairs, HML requirement and
   reference evidence. Browser timing can differ from the Node measurements.
4. Load `workers-audit-stress-missing-worker.pnml`, preserving the saved suite. In
   **Replay results**, click **Replay frozen suite on loaded APN**. It should fail.
   Repeat with `workers-audit-stress-wrong-receipt.pnml` and inspect the explanations.
   Do not regenerate expectations on the mutants.
5. For a separate negative-test review, use an existing supported account or typed
   exercise example and enable **Also select bounded refusal tests from validated
   positive prefixes**. Inspect the finite refusal coverage and distinguish
   unresolved searches from admitted negative cases. This increment changes HML
   construction, not the refusal-selection algorithm.

The six-round audit stress case is generated by the benchmark case list; it is not
one of the existing exported PNML files. No GUI options were added in this increment.
The next planned step is a usability review, before further solver optimization.

To reproduce the after measurements from `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js \
  --cases tools/node/benchmarks/increment-26-cases.json --runs 3 \
  --hard-timeout-ms 45000 \
  --out ../docs/satel/performance/local-increment-26.json
npm test -- --runInBand src/__tests__/satel
```

For the before run, use a separate worktree at the baseline commit, apply the saved
instrumentation patch from that worktree's root, and copy the same case list.
The raw files identify the diagnostic override explicitly.

## Remaining limits

Rule reuse does not eliminate history branching, multiset combinatorics, bounded
ADT residuals or difficult arithmetic. Cached binding prefixes retain additional
objects, and lookup overhead can outweigh savings on small models. Timing and
memory should continue to be measured before extending this technique further.
Any future state merging that discards places or histories needs a separate
correctness argument. The present increment retains full-marking semantics.
