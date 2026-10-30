# Recursive WorkLog depth: measured limits and finite coverage

Historical Increment 46 measurements. [SCALE_RESULTS.md](SCALE_RESULTS.md)
records the follow-up with larger explicit branch budgets and faster feasibility.

Recorded 30 October 2026. This follows [token indexing](INDEX_RESULTS.md).
The HR backend, frontend, database seed, existing intentions and APN business
rules are unchanged. The experiment holds the marking fixed at 12 employees and
five reserved records of each kind per person, with four places and 21 transitions.
Every final run records the same initial-marking hash.

The benchmark constructs WorkLog inputs of lengths 1–5 using the unchanged
`reviews` equations. One generic protocol submits each entry, observes `ack`,
and finally observes the audit count. This is a dedicated depth benchmark, not
a replacement for the richer original two-entry HR intention. Five work types
produce 5^n syntactic kind combinations; this count alone is not a theorem about
the thesis's subuniformity classes.

## Final ten-second algebra runs

| Length | Kind combinations | Regions returned | Unresolved frontier branches | Unknown intersections | Algebra | Selection | Replay | Admission |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 5 | 5 | 0 | 0 | 0.69 s | 0.09 s | 0.16 s | admitted |
| 2 | 25 | 25 | 0 | 0 | 1.94 s | 0.52 s | 0.66 s | admitted |
| 3 | 125 | 125 | 0 | 0 | 8.87 s | 2.27 s | 2.95 s | admitted |
| 4 | 625 | 181 | 12 | 16,290 | 10.01 s | 3.96 s | 4.53 s | rejected |
| 5 | 3,125 | 164 | 13 | 13,366 | 10.02 s | 4.68 s | 5.44 s | rejected |

All returned regions have executable representatives, and every returned candidate
passes concrete APN replay. At lengths four and five this is **partial candidate
replay, not an admitted suite**. Actual admission rejects those runs because
symbolic branches remain unresolved; unknown intersections are an additional
outstanding obligation. A frontier branch can stand for many missing regions,
so its count must not be interpreted as the number of missing tests.

The ten-second budget applies to algebraic derivation, including overlap analysis.
Selection has a separate 30-second/10,000-visit budget. Replay is measured separately.
The successful admission phase includes copying/validation overhead. RSS snapshots
after derivation range from 213 to 286 MiB in this matrix; these are not peak memory.
Full counters and timings are in [depth-final.json](results/depth-final.json).

## What the longer runs establish

With a 30-second algebra budget, length four returns **203/625** kind regions and
length five **202/3,125**. Both exhaust exactly **2,048 expanded branch alternatives**,
the engine's current maximum, rather than the time budget. Ten and fifteen
frontier branches respectively remain unresolved. Expansion counts include rule
attempts and Boolean guard decomposition, not just resulting classes.

These runs take 12.82 and 13.59 seconds for algebraic derivation. All 20,503 and
20,301 intersections among the returned regions are proved disjoint. All 203 and
202 representatives are selected and replay successfully, but admission still
rejects both partial suites. More elapsed time alone cannot complete these cases
under the current branch ceiling.

## Optimization and controlled comparison

The initial pre-change runs are retained in
[depth-baseline.json](results/depth-baseline.json). Length three generated all 125
regions but ended with seven unknown overlap obligations at the ten-second budget.
Lengths four and five spent another 12.82 and 11.44 seconds building overlap queries
after their shared deadline, even though those queries could not run.

The implementation now proves disjointness when two regions require different
scalar constants at the same free-constructor field of an input. The proof is
conservative: unsupported forms and unbound existential values fall back to the
existing solver checks. It does not compare output values or merge regions.
After deadline expiry, each remaining intersection is recorded as unknown without
building its solver query. The unknown obligations are retained individually.

A paired length-three comparison with a 30-second budget gives:

| Mode | Algebraic derivation | Overlap phase | Returned regions | Unknown obligations |
| --- | ---: | ---: | ---: | ---: |
| Previous paths enabled by ablation flags | 9.83 s | 2.529 s | 125 | 0 |
| Literal certificates and deadline deferral | 6.69 s | 0.007 s | 125 | 0 |

All 7,750 intersections use literal certificates in the optimized run. The two
runs produce **identical region patterns, conditions, results and witnesses**.
The final ten-second optimized run took 8.87 seconds instead of 6.69; this observed
variation is why these measurements are reported as individual trials, not a
performance guarantee. Each timed configuration ran in a fresh child, sequentially,
without our other build/test jobs. Z3 initialization is recorded separately.

Feasibility adapter work now dominates: about 6.54 seconds of the 6.69-second
repeat, and 12.45/13.21 seconds in the longer length-four/five runs. This includes
encoding, solver interaction, extraction and validation, not just Z3's internal
solve time. Equation-expansion and overlap timings are also retained. The change
does not remove exponential class growth or the quadratic number of region pairs.

## Independent finite coverage audit

The checker uses its own matcher, restricted guard interpreter and recursive
WorkLog evaluator. It imports no SATEL solver, evaluator or unfolding code.
For lengths 1–3 it enumerates every combination of kinds 0–5 and durations
14, 15, 720 and 721. At length three this means **13,824 inputs**, including
**1,000 defined inputs** and 12,824 inputs outside the operation's defining guards.
All defined inputs are covered exactly once; none of the undefined inputs is
covered. Results and all representatives are correct.

For lengths four and five the finite audit enumerates all valid kind vectors at
15 minutes per entry. The longer runs leave **422/625** and **2,923/3,125** such
inputs uncovered. The checker thereby exposes the missing coverage independently
of the engine's resource diagnostics. No returned-region overlaps, wrong results,
invalid representatives or unsupported audit expressions were found.

These are exhaustive checks only over the explicitly listed finite inputs.
They are not coverage proofs over all Nat durations, arbitrary recursive lengths,
APN behaviors or thesis subuniformity classes. The engine's `coverage: not-proved`
status remains unchanged, and a finite audit never overrides admission rejection.
See [depth-audit.json](results/depth-audit.json) for every configuration and missing
input examples, and [depth-summary.json](results/depth-summary.json) for assertions.

## Validation and reproduction

- 1,035 regression tests in 97 suites pass, including five new certificate/deadline
  tests and checks of certificate conclusions against the independent SMT solver.
- Six finite-auditor self-tests detect deleted/duplicated regions, broadened
  boundaries, incorrect outputs/representatives and unsupported expressions.
- Both builds and seven built-editor Playwright tests pass.
- All nine existing HR intentions regenerate the same 64 admitted tests.
  [depth-verification.json](results/depth-verification.json) records exact pair
  comparisons and the frozen-suite hash.

This increment validates generation and APN replay. HR REST/UI mutation results
remain those recorded in [INDEX_RESULTS.md](INDEX_RESULTS.md); the app and frozen
stimulation/observation pairs are unchanged.

From this SUT directory, run the following sequentially:

```sh
node experiments/depth-benchmark.mjs --mode baseline
node experiments/depth-benchmark.mjs --mode final
node experiments/depth-report.mjs depth-baseline depth-final
node --test experiments/depth-audit.test.mjs
node experiments/verify-index.mjs --out depth-verification
node experiments/depth-summary.mjs
```

Extract the existing `results/generic-evidence.zip` at this directory first to
restore the original frozen suite for the final comparison. Full intermediate
region files are generated locally as `results/depth-domains-*.json`; compact
measurements and audit results are committed. `--configs` accepts an explicit
configuration array, and `--out` selects the report name. The baseline mode disables
both new overlap paths on the current engine; the retained initial baseline was
measured before those changes. The deadline is soft: an in-flight solver call and
bookkeeping can extend elapsed time beyond it. A separate child-process limit
also records hard timeouts rather than interpreting them as infeasibility.

The next scaling target is feasibility/branch expansion under explicitly chosen
larger bounds. Increasing the ceiling or merging regions should be evaluated as
separate changes; neither follows from the success of the finite audit.
