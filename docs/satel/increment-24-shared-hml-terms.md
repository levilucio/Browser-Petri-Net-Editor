# Increment 24 — preserve shared HML expressions through solving

19 October 2026. Branch: `codex/satel-public-methods`. Baseline commit:
`735fb2b8f27931e2075525924b8f15f60cd7b5f5`.

## Result and scope

The existing eight-worker model now resolves through eight request/completion
rounds, with a median selection time of **0.389 seconds** in this experiment.
Previously its expanded-expression size exceeded the construction limit.
Reference admission/replay and both worker mutants pass their expected checks.

The four-worker/four-round model with audit history remains unresolved because
it exceeds the construction-work allowance. This increment addresses repeated
expression expansion; it does not merge distinct histories or eliminate the
cost of exploring them.

## Implementation

`buildHmlConstraints` already memoized a formula at the same full symbolic
marking. Reusing that result created shared expression objects. Later recursive
substitution and SMT serialization could copy those shared subexpressions into
repeated trees, losing the benefit of memoization.

The new internal `TermGraph.js` representation stores shared compound terms once,
with local backward references. Single-use terms and variable leaves remain
inline. The representation is JSON-safe, so ordinary traversal, substitution,
renaming and serialization cannot recursively expand referenced definitions.
Packing uses object identity; it does not perform logical rewriting, merge
equivalent states, or change the variable declarations in a test intention.

The integration has five parts:

1. HML construction packs its ordered preconditions, definedness obligation and
   required truth value into a graph after complete bounded construction.
2. Sort checking interprets references in their local scope. References cannot
   refer forwards, cycle, or escape the enclosing graph.
3. Ground folding leaves the scoped graph intact. Concrete evaluation follows
   references lazily and caches successful results for that evaluation only.
   Short-circuit Boolean conditions and conditional branches keep their existing
   evaluation order. An unvisited partial selector is never evaluated eagerly.
4. SMT translation emits typed auxiliary constants with defining equalities.
   Each definition depends only on original parameters and earlier graph nodes.
   Auxiliary names are fresh internal names and are not extracted as method
   parameters or added to test cases.
5. The existing independent witness check evaluates the original graph with the
   extracted parameter values. It does not validate every auxiliary definition
   as a separately required concrete operation. That distinction preserves the
   definedness of unreachable branches while SMT uses total datatype selectors.

A preliminary nested-`let` encoding was rejected during development: the stress
regression exposed costly solver processing and a List witness query timed out.
The committed encoding uses auxiliary definitions, and those regressions pass.

### Why this encoding preserves the obligation

For a Boolean root expression, write each definition as
`d_i = e_i(x, d_0, ..., d_(i-1))`, where `x` contains the original shared data
variables. In the supported total SMT interpretation, asserting all definitions
and the root is a definitional extension of the original expression:

```text
exists d. (and_i d_i = e_i(x, d_<i)) and d_root
```

holds exactly when the expanded Boolean expression holds for `x`. No branch
gets its own independent copy of a method parameter. The HML definedness
obligation remains part of that expression; independent concrete checking still
rejects invalid witnesses.

This explains the intended local encoding invariant. It is not a new proof of
the entire SATEL/APN implementation, bisimulation, or equivalence to the thesis's
semantic subuniformity construction.

## Resource accounting

The numeric expression-size limit remains 100,000, but **its measured object has
changed**: `constraintSize` now counts the stored graph representation, including
reference edges, rather than the fully expanded tree. This is not an unchanged
size metric and should not be reported as one. The report also records:

- `expandedConstraintSize`: the structural size of the uncompressed obligation,
  computed using memoization without materializing its expansion; it saturates
  at JavaScript's largest safe integer.
- `sharedTermNodes`: the number of packed definitions, including the root.
- The existing construction work, formula/state visits, cache hits, outcomes,
  equation expansions and residual-call counts.

Structural size counts objects, arrays and scalar entries; it is not a byte count
or a count of semantic states. The benchmark's declared-variable counter measures
original query variables and excludes the new internal SMT auxiliaries.

Construction-work, formula/state and time limits are retained. An incomplete
universal obligation is still discarded as unresolved. Packing is performed
only after construction succeeds; it cannot turn a truncated exploration into
a passing test.

## Paired measurements

The [case list](../../petri-net-app/tools/node/benchmarks/increment-24-cases.json)
contains six existing worker configurations and the 64-resource allocator as a
control. Both phases ran three trials per configuration: **42 completed trial
records**, with no child hard timeout or runtime-error outcome.

Environment: Node 24.19.0, Linux x64, Intel Xeon Platinum 8573C, nine reported
logical CPUs. Each configuration runs in an isolated child, with initialization
timed separately. The first trial has cold model caches; subsequent trials reuse
caches. No regression suite or build ran concurrently with either benchmark
phase. Source hashes were verified against the baseline commit and the changed
working sources; the benchmark runner and model generators were unchanged.

Both phases use 1 second per SMT check, 4 seconds for derivation, 5 seconds for
sequence search, 4 seconds for HML construction, 256 narrowing branches and
100,000 sequence-search work units. The child has a separate 45-second deadline
for initialization and all three complete trials. The unchanged numeric HML
size allowance has the representation-dependent meaning described above.

Times below are three-trial selection medians, excluding model construction,
initialization, admission and replay. An unresolved time is time until rejection
by the resource limit, not a successful execution time.

| Model | Before | After | Adapter calls before → after |
|---|---|---|---:|
| 2 workers, 4 rounds, no audit | Selected, 0.614 s | Selected, 0.324 s | 9 → 9 |
| 2 workers, 4 rounds, audit | Selected, 0.580 s | Selected, 0.461 s | 9 → 9 |
| 4 workers, 4 rounds, no audit | Selected, 1.284 s | Selected, 0.347 s | 9 → 9 |
| 8 workers, 4 rounds, no audit | Size limit, 0.151 s | Selected, 0.285 s | 3 → 9 |
| 8 workers, 8 rounds, no audit | Size limit, 0.130 s | Selected, 0.389 s | 3 → 9 |
| 4 workers, 4 rounds, audit | Work limit, 0.153 s | Work limit, 0.167 s | 3 → 3 |
| 64-resource allocator | Selected, 0.628 s | Selected, 0.674 s | 4 → 4 |

All three trials agreed on each row's status. The baseline's three calls in the
size-limited cases reflect stopping before joint solving; the increase to nine
is successful additional work. The allocator's small slowdown and unchanged
call count illustrate why these timings are not a universal speedup claim.

### Size and depth

| No-audit worker model | Expanded structural size | Stored structural size | Packed definitions | Formula/state visits |
|---|---:|---:|---:|---:|
| 2 workers, 4 rounds | 3,049 | 918 | 10 | 13 |
| 4 workers, 4 rounds | 27,962 | 1,480 | 13 | 21 |
| 8 workers, 4 rounds | 346,936 | 2,616 | 25 | 37 |
| 8 workers, 8 rounds | 1,655,851,416 | 5,372 | 57 | 73 |

The last expanded figure is computed, not allocated: the old builder stopped
when it exceeded 100,000. The new result avoids materializing that repeated
syntax. It does not mean that 1.66 billion distinct semantic states were explored.

Eight rounds mean HML modal depth 16, alternating submission and completion.
The explicit stimulation/observation sequence remains two pairs; its additional
branching property constrains the deeper behaviour. For this case, the median
combined construction/selection/admission/reference-replay time was 0.498 s,
and process peak RSS reached about 244 MiB, including initialization. Its cold
selection trial took 0.795 s.

### Reference and mutation results

Before: 12 selected trials and nine unresolved. After: **18 selected trials and
three unresolved**, all three belonging to the audit-history work-limit control.
Every selected after-trial passed both reference admission and separate concrete
reference replay.

First-trial mutation checks detect missing worker and wrong receipt for all five
resolved worker configurations, plus missing confirmation and wrong allocation
for the allocator: **12 failing mutant replays, no replay errors**. These are
configuration-level checks, not 12 distinct fault families. They exercise known
faults and do not establish mutation completeness.

Raw evidence: [before JSON](performance/increment-24-before.json),
[before JSONL](performance/increment-24-before.json.jsonl),
[after JSON](performance/increment-24-after.json),
[after JSONL](performance/increment-24-after.json.jsonl).

## Regression coverage

New tests cover compact JSON/substitution/sort checking, a deeply shared Boolean
expression, bounded SMT serialization, shared original variables across graph
scopes, lazy partial-selector evaluation, malformed references and cycles.
The worker regression matrix now includes eight workers at four and eight rounds;
both reference admission and mutant replay are checked. Existing expected-false
properties, algebraic List/Pair/String operations, runtime bounds, short-circuit
definedness and construction-limit tests remain active.

The final full SATEL run passed **436 tests in 41 suites** (78.275 s).
An earlier full run had one five-second GUI timeout; that unchanged test passed
in isolation and in the final complete run. No test timeout or generation budget
was increased to obtain the passing run.

The production build (`npm run build`) also passed. Its existing bundle/chunking
and outdated Browserslist-data warnings remain; this increment does not change
frontend dependencies or build configuration.

## Laptop review

```sh
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm ci
npm run dev
```

Use **Load** to open the existing
`docs/satel/performance/models/workers-merged-large-reference.pnml`.
Generate its intention in **SATEL → Generated tests**. This is the eight-worker,
eight-round model measured above. Then load its `missing-worker` or
`wrong-receipt` counterpart and replay the frozen suite; both should fail.
The `workers-audit-stress-reference.pnml` control still reports an unresolved
generation. No new editor controls or user-facing term syntax were introduced.

To reproduce the measurements from `petri-net-app`:

```sh
node tools/node/benchmarks/run-scale.js \
  --cases tools/node/benchmarks/increment-24-cases.json --runs 3 \
  --hard-timeout-ms 45000 \
  --out ../docs/satel/performance/local-increment-24.json
npm test -- --runInBand src/__tests__/satel
```

Use a separate worktree at the baseline commit and copy the same case list for a
before comparison. These are Node measurements, not browser-latency guarantees.

## Remaining boundary

[Increment 25](increment-25-hml-expression-reuse.md) implements local guard/output
translation reuse and records its measured effect. It preserves the distinct
audit markings and does not yet resolve the larger audit-history controls.

Audit history still creates genuinely distinct full markings during construction.
The next useful target is repeated work during that exploration, before any
attempt to increase limits. A future property-dependent state projection would
need a justified dependency analysis; this increment does not discard private
places or audit histories.

Multiset binding combinatorics, recursive ADT residuals, nonlinear arithmetic,
cooperative deadline overruns and black-box observability limits remain. The
graph representation improves finite constraint handling; it does not make
general symbolic execution or subuniformity calculation complete.
