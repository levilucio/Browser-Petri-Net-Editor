# Increment 11 — ten typed APN case studies, twenty mutants and performance measurements

Date: 16 October 2026. Branch: `codex/satel-public-methods`.

This increment adds **ten reference APNs and twenty separately loadable mutant
APNs**. Their intentions generate **32 positive reference-validated tests**, with
**354 stimulation/observation pairs** in total. Sequence lengths are 2, 4, 6, 8,
10, 12, 14, 16, 18 and 20 pairs. All twenty mutants are killed by at least one
frozen reference test, with zero execution errors in the measured runs.

These are small, understandable case studies, not industrial-scale models or a
random benchmark corpus. The largest sequence has twenty synchronous method
calls, not twenty autonomous reachability-search transitions. Cases deliberately
vary data structure and state evolution as well as sequence length.

## Try them in the GUI

1. Update `codex/satel-public-methods`, then run `npm ci` and `npm run dev` from
   `petri-net-app`.
2. Open **Examples → SATEL exercises — 10 references and 20 mutants**. Alternatively,
   use **Find an example** to search for a scenario, type or fault.
3. Load a **Reference**. Its intention is present under **SATEL → Intentions**.
   Review its data variables, equations, conditions and explicit pair sequence.
4. Open **Generated tests → Generate tests**. Check the reference-pass count and
   the instantiated pair sequences. In **Executable selection**, each class
   should be executable, with zero blocked or unresolved classes.
5. Close SATEL, load a mutant of **the same scenario**, and open **SATEL → Replay
   results → Replay frozen suite on loaded APN**. Do not regenerate on the mutant:
   the expected observations must stay those validated against the reference.
6. Load the reference again and replay the same frozen suite; all tests pass.

Use **Save** to export any loaded reference or mutant as PNML. The CLI below can
also export all thirty PNML files at once. Each includes its own initial marking,
public methods, I/O declarations and intention; it can be loaded independently.
The live frozen suite remains a session object, as before. This increment does
not add persisted suite import/export.

For a short review, start with **Thermostat**, then **Resource quota** (values
selected from later feasibility constraints), **Assembly kits** (multiplicity),
and **Sensor journal** (twenty pairs with growing values).

## Reference models and selection domains

| Scenario | Pairs | Classes | Types and classification | State and sequence |
|---|---:|---:|---|---|
| Thermostat | 2 | 3 | `Int`: adjustment below / equal to / above zero; −5 ≤ d ≤ 5 | Temperature starts at 20; adjust, then read. |
| Door interlock | 4 | 4 | Two `Bool` constructors, all enabled × jammed combinations; settings stored in a `Pair` | Configure, attempt opening, reset, inspect. Opening requires enabled and not jammed. |
| Ticket booklet | 6 | 2 | `Nat`: exactly two tickets / more than two, with 2 ≤ n ≤ 4 | Issue, use, inspect, use, inspect, settle remaining tickets. |
| Label editor | 8 | 3 | `String`: empty / length 1–3 / length 4–6; Boolean acceptance | Register, read, prefix, read, suffix, read, clear, read. |
| Coordinate cursor | 10 | 4 | `Pair(Int, Int)` represented through typed `Any` fields; four negative/nonnegative sign regions | Load, read, translate x, read, translate y, read, mirror, read, reset, read. Both coordinates are bounded to −2…2 initially. |
| FIFO queue | 12 | 3 | `List`: empty / one integer / two integers, using constructor patterns | Load seed; enqueue 7 and 8; read; dequeue; read; enqueue 9; read; dequeue; read; clear; read. |
| Parcel lifecycle | 14 | 4 | `Pair(String, Bool)`: empty/named label × regular/fragile; `Nat` phase | Create, relabel, mark fragile, dispatch, deliver, return to sender, reset; read metadata and phase after every action. |
| Resource quota | 16 | 3 | `Nat`, `Bool`: 1–3 / exactly 7 / other values 4–8; shared n in logical and arithmetic terms | Start with 10 available and 0 held; eight reserve/release actions, each followed by an audit. |
| Assembly kits | 18 | 2 | `Bool` recycling flag; `Pair(String, Bool)` parts and products | Three take/inspect/assemble/inspect/disassemble/return cycles; two identical physical part tokens are required. |
| Sensor journal | 20 | 4 | Negative/positive `Int` delta × armed `Bool`; `List` of `Pair` records and a `String` source label | Start at value 0 with an empty journal; ten record/read rounds, appending cumulative readings. Delta is −2, −1, 1 or 2. |

The cases use explicitly written operation equations to derive classes. The APN
rules independently implement the scenario; the protocol specifies the expected
observations. Fixed-sequence symbolic execution then combines the domain with
available tokens, guards and all subsequent observations. Methods and paths
remain literal; no method-name, observation-place or path variables were added.

For readable generated strings, the label intention also requires
`isSubstringOf(s, "ABCDEF")`, and the parcel intention requires
`isSubstringOf(s, "BOX1")`. These are explicit selection restrictions, so these
experiments do not cover arbitrary Unicode strings. They also exercise the
string-containment operation in a compound intention condition.

The queue's `seedShape` operation is intentionally partial: it defines only
empty, one-integer and two-integer seed lists. This is an explicit bounded input
family, **not coverage of arbitrary lists**. Its queue can grow during execution.
The other domains also have explicit bounds and selection assumptions. A chosen
representative does not establish uniform fault behaviour throughout its class.

### What the longer cases demonstrate

**Resource quota:** the static small-class witness is 1, but the third call
releases 3 held resources. The complete sequence therefore needs n ≥ 3. The
generator selects n = 3 for the small class; it does not discard the class when
the original witness is blocked. Every intermediate marking conserves
`available + held = 10`. The two other classes remain independently represented.

**Assembly kits:** the initial stock contains two equal `("bolt", true)` tokens.
Two input arcs use the same variable, requiring equal values but distinct token
occurrences. The loan observation produces two equal tokens as a multiset;
duplicates must not collapse to one. Each product accounts for two physical
parts, and all parts are restored after every cycle. This also tests the existing
concrete deduplication of indistinguishable firing choices.

**Sensor journal:** after record k, the stored value is k × delta and the journal
contains the ordered pairs `(delta, armed)` through `(k × delta, armed)`. The
final observation contains ten records in one list token. Read calls preserve
state; emitted output tokens accumulate in their public places. The observation
at each pair concerns newly produced tokens, as in the established interface.

## Frozen-suite mutation results

A mutant is killed only by a `fail` verdict; execution errors are not counted.
A passing test on a mutant means that particular selected test did not expose the
fault. All counts below come from the reference-generated suite, without changing
its arguments, expected observations or initial-marking policy.

| Scenario / mutant | Failing tests | First failing pair | Reason |
|---|---:|---:|---|
| thermostat / `wrong-direction` | 1/3 | 2 | observation mismatch |
| thermostat / `wrong-initial` | 3/3 | 2 | observation mismatch |
| door / `ignore-jam` | 1/4 | 2 | observation mismatch |
| door / `stuck-open` | 1/4 | 4 | observation mismatch |
| tickets / `free-use` | 2/2 | 3 | observation mismatch |
| tickets / `extra-ticket` | 2/2 | 3 | observation mismatch |
| labels / `wrong-prefix` | 3/3 | 4 | observation mismatch |
| labels / `stale-clear` | 3/3 | 8 | observation mismatch |
| coordinates / `swapped-axes` | 4/4 | 4 | observation mismatch |
| coordinates / `bad-origin` | 4/4 | 10 | observation mismatch |
| queue / `prepend` | 3/3 | 4 | observation mismatch |
| queue / `no-removal` | 3/3 | 6 | observation mismatch |
| parcel / `not-fragile` | 4/4 | 6 | observation mismatch |
| parcel / `no-return-label` | 4/4 | 12 | observation mismatch |
| quota / `lost-release` | 3/3 | 4 | observation mismatch |
| quota / `missing-special` | 1/3 | 1 | observation mismatch |
| kits / `missing-part` | 2/2 | 1 | blocked request |
| kits / `wrong-material` | 1/2 | 4 | observation mismatch |
| journal / `reverse-log` | 4/4 | 4 | observation mismatch |
| journal / `no-accumulation` | 4/4 | 6 | observation mismatch |

Thus 53 of the 64 test/mutant executions fail, and the remaining 11 pass; every
mutant has at least one failing test. These deliberately authored faults exercise
state updates, boundaries, reset, sequence ordering and initial multiplicity.
This is not an independently sampled mutation score, a complete fault model, or
proof that each algebraic class is a semantic equivalence class. No negative-test
generator has been added.

## Two implementation issues exposed and corrected

1. **Operations in instantiated observations.** Protocol instantiation previously
   evaluated arithmetic and already-unfolded primitive terms, but left calls such
   as `concat`, `append`, `tail`, `fst` and `snd` unresolved. The label example
   produced `Term is not fully unfolded`. A bounded ground-term evaluator now
   applies the declared oriented equations after data substitution, both for
   method arguments and expected observations. It preserves typed `Any` tags,
   honours Boolean short-circuiting, and rejects undefined or ambiguous ground
   definitions. Each evaluation has a 10,000-step budget.
2. **Redundant unfolding of fixed calculations.** Complete-path constraints
   repeatedly embedded operation expressions from earlier markings. Coordinates,
   queue, parcel and journal examples exhausted the existing 32-step symbolic
   unfolding budget even with a fully fixed representative. Ground subexpressions
   are now reduced before the path is passed to the narrowing/SMT stage. Expressions
   still containing variables remain symbolic; a failed reduction remains for the
   existing diagnostic machinery. The symbolic bounds were not raised and the
   reference-admission replay remains mandatory.

This optimization works particularly well when the existing class representative
already satisfies the complete sequence. Cases needing new values still use the
joint solver; the quota example checks that fallback. It does **not** provide
incremental SMT pruning at every intermediate marking, sharing of all repeated
symbolic expressions, or elimination of all equivalent token permutations.

Ground evaluation uses the algebra's equations; concrete replay still uses the
method evaluator. Regression cases compare their results on representative
String, List and Pair operations, including undefined and short-circuit cases.
This is useful cross-checking, not a proof of semantic independence or correctness.

## Performance measurements

Raw measurements, source-file SHA-256 digests, selected first calls, mutation
verdicts and per-run memory samples are in
[`performance/exercises-2026-10-16.json`](performance/exercises-2026-10-16.json).
The recorded base commit is the pre-increment HEAD; the source digests identify
the measured new code in this increment.

Environment: Node 24.19.0, Linux x64, AMD EPYC 9V74, 9 logical CPUs exposed to the
container. Five serial in-process runs per scenario, with Z3 initialization timed
separately (**135.44 ms**). No forced garbage collection. Timing gates are not
used. These are environment-specific observations, not laptop or browser timing
guarantees. The first measured scenario can still include JIT/solver warm-up.

Generation includes algebraic class derivation and whole-sequence selection.
Admission executes the reference and checks the expected observations. Replay is
an additional execution of the frozen suite on the reference. Every number is for
the **entire scenario suite**, not one pair. Mutant replay timings are retained in
the JSON.

| Scenario | Pairs/test | Tests | Generation median ms | Admission median ms | Reference replay median ms |
|---|---:|---:|---:|---:|---:|
| thermostat | 2 | 3 | 166.88 | 6.99 | 2.30 |
| door | 4 | 4 | 83.60 | 10.50 | 4.04 |
| tickets | 6 | 2 | 120.78 | 5.60 | 2.23 |
| labels | 8 | 3 | 549.87 | 10.28 | 5.13 |
| coordinates | 10 | 4 | 331.59 | 17.90 | 7.43 |
| queue | 12 | 3 | 73.59 | 14.37 | 5.41 |
| parcel | 14 | 4 | 311.87 | 38.99 | 18.35 |
| quota | 16 | 3 | 451.23 | 19.46 | 9.20 |
| kits | 18 | 2 | 29.16 | 28.04 | 16.30 |
| journal | 20 | 4 | 333.17 | 53.23 | 24.15 |

Median generation ranges from about **29 to 550 ms**; the largest observed single
generation sample in this run was **657 ms**. Sequence length alone does not
predict cost: class derivation, string solving, choice of representative and
whether whole-sequence fallback is needed all matter.

### Same-model depth sweep

To isolate length more closely, the runner also generates prefixes of the sensor
journal intention at six depths. The APN, four classes and operation equations
stay the same. Each depth has five runs, after the preceding scenario benchmarks.

| Pairs/test | Generation median ms | Admission median ms | Replay median ms | Search visits |
|---:|---:|---:|---:|---:|
| 2 | 240.64 | 5.44 | 2.05 | 72 |
| 4 | 262.03 | 9.69 | 3.71 | 140 |
| 8 | 267.47 | 14.08 | 6.29 | 276 |
| 12 | 278.09 | 19.89 | 9.20 | 412 |
| 16 | 336.32 | 32.72 | 16.38 | 548 |
| 20 | 381.06 | 46.16 | 22.78 | 684 |

Search visits grow linearly in this successful deterministic family. The timing
trend is not a complexity proof: generation has a substantial class/solver cost,
while replay processes increasingly large list observations. The independently
measured twenty-pair suite above and the later sweep need not have identical
medians because process/JIT/GC state differs.

### Remaining performance concern: late infeasibility

The runner includes an explicitly bounded stress probe: change the final kit
acknowledgement to the impossible `false`, leaving the preceding 17 pairs intact.
With a **1,000 search-visit limit and 3,000 ms time limit**, the run takes about
**363 ms**, reaches 1,002 recorded visits (the shared counter can tick again when
the next class starts after exhaustion), and reports both classes **unresolved**.
No suite is admitted. This is a diagnostic probe, not an eleventh reference APN,
a mutant kill, or a negative test.

The current search builds complete paths before solving their constraints and
can revisit permutations of equal token occurrences. A late contradiction makes
that redundant exploration visible. Promising next improvements are prefix
feasibility checks and symmetry reduction that preserves multiplicity and shared
bindings. They need their own correctness tests; simply increasing limits would
not address the cause.

### Memory observations

Across the scenario runs and depth sweep, sampled process RSS rises from roughly
252 MiB to 431 MiB; sampled JavaScript heap use ranges from 37 to 118 MiB and ends
near 62 MiB. These are post-run samples, not peaks. WASM allocation, retained
capacity and garbage-collection timing prevent interpreting the RSS increase as
a demonstrated leak. Longer soak runs and explicit WASM/heap attribution remain
open work before making memory-scalability claims.

## Reproduce, export and verify

From `petri-net-app`:

```sh
npm ci
npm run satel:exercises -- --runs 5 --out ./exercise-results.json --export-dir ./exercise-pnml
```

This exports thirty PNML files, runs each reference through generation/admission,
replays its frozen suite on both mutants, runs the same-model depth sweep and the
bounded late-contradiction probe, and writes a machine-readable report. It exits
nonzero for an unexpected class/depth count, unresolved reference generation,
failed reference replay, surviving mutant or mutant execution error. The two
unresolved classes in the separately labelled stress probe are expected.

```sh
npm test -- --runInBand src/__tests__/satel/exercises.test.js src/__tests__/satel/ground-terms.test.js src/__tests__/satel/public-method-pnml.test.js
npx playwright test tests/e2e/satel/exercises.spec.js --project=chromium --project="Mobile Chrome" --workers=1
npm run build
```

Validation performed for this increment:

- 58 focused Jest tests passed: reference cases, mutation expectations, state
  invariants, ground evaluation and PNML persistence, including all thirty nets.
- Full `src/__tests__/satel` run: **244 passed, 2 failed**. The two failures are the
  previously documented legacy `manufacturing-v2.test.js` expectations (intention
  count and positive pair results); they were not changed by this increment.
- **20 browser scenarios passed**, one per reference on desktop and mobile Chrome.
  Each generates its suite, checks displayed pair count, loads both mutants and
  replays the retained suite. The two string scenarios were rerun on both layouts
  after adding the readable-alphabet restrictions. Twenty-pair displays were
  inspected visually.
- Production build passed; Vite retains its existing large-chunk warning.
- Five-run CLI benchmark passed, including 30-file PNML export.

The browser run used the available Chromium 153 executable and loopback Vite
hosting; the standard Playwright browser download was unavailable in this
execution environment. The committed scenarios use the repository's regular
Playwright configuration on a laptop with the normal browsers installed.

## Files and research implications

- [Case study factories and fault definitions](../../petri-net-app/src/satel/examples/exercises/editor.js)
- [Benchmark/export runner](../../petri-net-app/tools/node/run-satel-exercises.js)
- [Ground evaluation](../../petri-net-app/src/satel/core/GroundTerms.js)
- [Whole-sequence selection](../../petri-net-app/src/satel/core/ExecutableSequence.js)
- [Case study regression tests](../../petri-net-app/src/__tests__/satel/exercises.test.js)
- [Browser scenarios](../../petri-net-app/tests/e2e/satel/exercises.spec.js)

For the paper, the concrete evidence is broader typed execution, reproducible
fault detection, and an example where later reachability constraints change an
earlier representative. The performance evidence identifies both a removable
operational bottleneck (repeated ground unfolding) and a remaining structural
one (late-infeasible path enumeration). It does not establish full SATEL
completeness, semantic subuniformity, arbitrary-depth scalability, or general
nondeterministic conformance. The earlier
[development summary](development-summary-2026-10-16.md) remains the historical
record through the preceding increment; this document records the extension.
