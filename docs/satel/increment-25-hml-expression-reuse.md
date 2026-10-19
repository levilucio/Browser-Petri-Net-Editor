# Increment 25 — reuse HML guard and output translations

19 October 2026. Branch: `codex/satel-public-methods`. Baseline commit:
`c6990a5223f69923e5a5af38f8abd8b490dd71e2`.

## Result and scope

HML construction now reuses the symbolic translation of a guard or output when
its free variables have the same symbolic bindings. On the existing audit-history
models, median selection time decreased from **1.667 to 0.700 seconds** for two
workers/six rounds, and from **1.174 to 0.394 seconds** for four workers/three
rounds in this paired experiment.

This increment does **not** increase the set of resolved benchmark configurations.
The four-worker/four-round and four-worker/six-round audit models still exceed
the normal construction-work limit. The optimization reduces repeated expression
work while retaining every distinct full marking and the existing exploration.

## Implementation and preservation argument

`createHmlTerms` now has two additional local caches:

1. Preparation is keyed by the original expression, variable-sort declarations
   and expected result sort. It stores the elaborated term and its free variables.
2. Translation is keyed by the complete structural symbolic bindings of those
   free variables. It stores both the resulting term and its definedness condition.

The algebra, unfolding depth and runtime-checking mode are fixed for each
`createHmlTerms` instance. The caches belong to that construction, not to a global
store. Exceptions are not cached. Every request, including a cache hit, calls the
existing work/deadline/cancellation check. Cache entries remain bounded by the
construction's finite work budget.

For example, a guard reading `s` and `p` can reuse its translation when an unrelated
`xs` audit-list binding changes. Conversely, `append(xs, 3)` must use a different
entry when `xs` changes. Original symbolic variable names are retained: binding a
local parameter to `$left` is different from binding it to `$right`, even if both
have the same sort. No representative is selected independently for a branch.

For a fixed well-typed expression, its translation depends only on the values of
its free variables and the fixed algebra, depth and runtime semantics. Thus the
cache reuses the same `(term, safe)` result. It does not cache a property verdict,
drop definedness, decide enabledness with a new solver query, or identify different
APN states. This is a local implementation invariant, not a proof of the complete
tool or of equivalence to the thesis's semantic partition construction.

Reused result objects also preserve expression sharing for increment 24's term
graph. That reduces stored graph size without changing the expanded obligation
in the measured cases. Existing constructor/operation unfolding and final joint
SMT solving remain in place.

## Diagnostics and budgets

The HML selection statistics add:

- `preparedExpressions`: distinct preparation keys actually elaborated.
- `expressionRequests`: translation requests, including repeated ones.
- `expressionCacheHits`: requests served by the binding cache.

`expressionRequests - expressionCacheHits` gives the number of translation
misses. Existing `cacheHits` still counts formula/full-marking memoization; it
has not been repurposed. Equation and residual counters describe performed
expansion work, not the number of paths affected by a shared expression.

The normal HML construction allowance remains 10,000 work units and 2,000
formula/state visits. A cache hit consumes one work unit instead of traversing the
expression again; a miss includes that request check and the existing recursive
work. The numeric limits and their enforcement are retained, but work units are
implementation operations, not a fixed measure of semantic exploration.

The stored-graph size allowance remains 100,000, with the interpretation introduced
in increment 24. There are no new GUI options, budget increases or state projections.
Incomplete universal construction still produces an unresolved result and cannot
be admitted as a passing test or a negative witness.

## Paired measurements

The [case list](../../petri-net-app/tools/node/benchmarks/increment-25-cases.json)
uses existing worker and resource-allocation generators. Seven configurations ran
three times before and three times after the change: **42 completed trial records**,
with no child hard timeout or runtime-error result. Source hashes were checked
against the baseline commit and working files. Only `HmlTerms.js` changed among
the benchmarked sources; runners and model generators stayed identical.

Environment: Node 24.19.0, Linux x64, Intel Xeon Platinum 8573C, nine reported
logical CPUs. Each configuration has its own sequential child. Initialization
is timed separately; the first trial has cold model caches and subsequent trials
reuse them. Neither test suites nor builds ran concurrently with either phase.

Budgets: 1 second per SMT check, 4 seconds for derivation, 5 seconds for sequence
search, 4 seconds for HML construction, 256 narrowing branches, 100,000 sequence
work units and a 45-second child deadline. The HML defaults above were unchanged.

Times are three-trial selection medians, excluding initialization, model creation,
admission and concrete replay. An unresolved time measures reaching a resource
limit, not successful selection.

| Configuration | Before | After | Adapter calls before → after |
|---|---|---|---:|
| 2 workers, 4 rounds, audit | Selected, 0.282 s | Selected, 0.226 s | 9 → 9 |
| 2 workers, 6 rounds, audit | Selected, 1.667 s | Selected, 0.700 s | 9 → 9 |
| 4 workers, 3 rounds, audit | Selected, 1.174 s | Selected, 0.394 s | 9 → 9 |
| 4 workers, 4 rounds, audit | Work limit, 0.178 s | Work limit, 0.225 s | 3 → 3 |
| 4 workers, 6 rounds, audit | Work limit, 0.258 s | Work limit, 0.234 s | 3 → 3 |
| 8 workers, 8 rounds, no audit | Selected, 0.426 s | Selected, 0.316 s | 9 → 9 |
| 64-resource allocator | Selected, 0.867 s | Selected, 0.803 s | 4 → 4 |

All three trials agreed on each configuration's status. Both phases had **15
selected trials and six unresolved trials**. Every selected trial passed reference
admission and separate concrete replay. First-trial mutation checks detected both
worker faults in each of four resolved worker configurations and both allocator
faults: **10 failing mutant replays and no replay errors per phase**. These are
configuration-level checks, not ten distinct fault families.

The allocator has no HML property and does not use this cache. Its timing variation
is a control against attributing every change to the optimization. Three trials
are limited evidence, not a statistical scalability guarantee; the deterministic
work and structure counters below give stronger evidence of the mechanism.

### Construction counters

| Worker configuration | Work before → after | Formula/state visits (both) | Outcomes (both) | Expression hits / requests after | Stored size before → after |
|---|---:|---:|---:|---:|---:|
| 2 workers, 4 rounds, audit | 1,413 → 962 | 61 | 60 | 259 / 300 | 2,951 → 1,821 |
| 2 workers, 6 rounds, audit | 5,883 → 3,848 | 253 | 252 | 1,123 / 1,260 | 12,103 → 7,085 |
| 4 workers, 3 rounds, audit | 5,125 → 3,488 | 169 | 168 | 899 / 1,008 | 6,459 → 4,447 |
| 8 workers, 8 rounds, no audit | 5,067 → 3,289 | 73 | 128 | 883 / 960 | 5,372 → 4,401 |

The audit cases still have zero formula/full-marking cache hits. Their distinct
histories were retained. Expanded structural sizes were unchanged: respectively
3,049; 12,977; 6,738; and 1,655,851,416. These count syntax, not semantic states.
For two workers/six rounds, process peak RSS was 278.60 MiB before and 249.02 MiB
after, including initialization; this is not an isolated cache-memory measure.

Raw evidence: [before JSON](performance/increment-25-before.json),
[before JSONL](performance/increment-25-before.json.jsonl),
[after JSON](performance/increment-25-after.json),
[after JSONL](performance/increment-25-after.json.jsonl).

## Verification

New regressions exercise free-variable dependency keys, different original symbolic
variables, algebraic audit-list values, expected-sort and declaration separation,
partial-operation definedness, short-circuiting, unfolding-depth isolation and
work/cancellation checks on hits. A small APN also checks both modalities against
concrete replay when history determines future enabledness or is explicitly
observed. The existing worker regression matrix now includes the two-worker,
six-round and four-worker, three-round audit configurations with both mutants.

The complete SATEL suite passed **444 tests in 42 suites** (76.371 seconds).
`npm run build` passed in 12.31 seconds; existing chunk-size and Browserslist-data
warnings remain. No test timeouts or generation budgets were raised for these
verification runs.

## Laptop review and reproduction

Pull `codex/satel-public-methods` and run the GUI as before. No editor change is
needed. Existing audit examples continue to work; the exported
`workers-audit-stress-reference.pnml` remains unresolved at the normal limits.
The eight-worker/eight-round no-audit example remains supported.

To reproduce the new performance cases from `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js \
  --cases tools/node/benchmarks/increment-25-cases.json --runs 3 \
  --hard-timeout-ms 45000 \
  --out ../docs/satel/performance/local-increment-25.json
npm test -- --runInBand src/__tests__/satel
```

For the before comparison, use a separate worktree at the baseline commit and
copy the same case list. These are Node measurements, not browser-latency claims.

## Remaining boundary

The optimization reduces translation work but leaves history branching and input
binding enumeration intact. The next useful increment is to profile and reduce
repeated rule/binding work while preserving multiplicities, shared-variable
constraints and definedness. Any future merging that discards history would need
a separate, justified dependency analysis and adversarial replay tests.

General termination, complete ADT unfolding, nonlinear constraints and black-box
observability are not solved by this cache. Unresolved remains different from
false, refused and unsatisfiable.
