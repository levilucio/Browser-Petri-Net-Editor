# Larger WorkLog depths: feasibility and retained metadata

Recorded 30 October 2026, following [Increment 46](DEPTH_RESULTS.md). The HR SUT,
APN business rules, defining equations, original nine intentions and frozen tests
are unchanged. All configurations use the same 12-person, five-slot, 159-token
marking with four places and 21 transitions.

## Controlled derivation measurements

Each configuration runs serially in a fresh process, without competing build or
test jobs. Z3 initialization is recorded separately. These are individual trials,
not statistical performance guarantees. Every run below returned all expected
fixed-length kind regions, with no unresolved frontier or overlap obligations.

| Length | Feasibility | Region metadata | Regions | Branch budget | Expanded alternatives | Algebra |
| ---: | --- | --- | ---: | ---: | ---: | ---: |
| 3 | SMT only | Full | 125 | 2,048 | 1,246 | 7.09 s |
| 3 | SMT only | Compact | 125 | 2,048 | 1,246 | 6.68 s |
| 3 | Exact scalar checks + SMT fallback | Compact | 125 | 2,048 | 1,246 | 1.71 s |
| 4 | SMT only | Compact | 625 | 8,192 | 6,246 | 32.38 s |
| 4 | Exact scalar checks + SMT fallback | Compact | 625 | 8,192 | 6,246 | 7.63 s |
| 5 | Exact scalar checks + SMT fallback | Compact | 3,125 | 32,768 | 31,246 | 39.17 s |

With compact metadata held fixed, scalar feasibility reduces derivation by about
3.9 times at length three and 4.2 times at length four. The length-three ablations
and length-four control produce identical logical regions and witnesses, checked in
[scale-summary.json](results/scale-summary.json).

The check-only shortcut handles conjunctions of independent scalar equalities
and integer bounds. It makes no witness choices; actual witnesses still come
from Z3 and pass the existing validation. Unsupported expressions use SMT, and
malformed or ill-founded datatype signatures cannot be hidden by the shortcut.
See [implementation details](../../docs/satel/increment-47-hr-scalar-feasibility.md).

At length three, retained variable-sort entries drop from **150,750 to 750**;
the largest region map drops from 2,346 entries to six. Compact length four
retains 5,000 entries, eight per region; length five retains 31,250, ten per
region. This measures metadata reduction, not an equivalent reduction in total
process memory. Length-three post-derivation RSS snapshots are 242.5, 276.8 and
238.2 MiB respectively, illustrating allocation and garbage-collection variation.
No large full-metadata control was attempted.

## Selection and admission

The length-four and length-five optimized cases also perform executable
representative selection and actual concrete APN admission. Admission checks all
returned tests against the reference; it is distinct from algebraic derivation.

| Length | Selected / regions | Selection | Admission / replay | Admission | RSS after derivation / admission |
| ---: | ---: | ---: | ---: | --- | ---: |
| 4 | 625 / 625 | 10.84 s | 13.66 s | admitted | 239.0 / 533.3 MiB |
| 5 | 3,125 / 3,125 | 63.75 s | 79.96 s | admitted | 397.2 / 1805.5 MiB |

Both suites are admitted, with no blocked or unresolved representatives. Search
visits total 21,875 and 131,250. The length-five measured phases total about
183 seconds; its final RSS snapshot is about 1.76 GiB. These are snapshots, not
peak memory. Admission includes validation and copying as well as replay. Full
stage counters are in [scale-benchmark.json](results/scale-benchmark.json).

Algebra deadlines are 30 seconds at length three, 60 at length four and 120 at
length five. Selection budgets are 60 seconds/50,000 visits and 180 seconds/250,000
visits for lengths four and five respectively. Child heaps are capped at 2 GiB,
except length five at 3 GiB, with separate hard process deadlines. The engine's
default branch budget remains 256; only its accepted explicit ceiling increases
to 65,536. The larger experiment budgets do not silently change GUI defaults.

## Independent audit and regression evidence

The independent auditor enumerates 13,824 boundary-value inputs for each
length-three run, including 1,000 defined inputs. At lengths four and five it
enumerates all 625 and 3,125 valid kind vectors at 15 minutes per entry. Its
matcher, guard interpreter and WorkLog result calculation import no SATEL engine
or solver code. Audit scopes and witness checks are in
[scale-audit.json](results/scale-audit.json).

Every defined input in each finite audit is covered exactly once, every undefined
boundary input is excluded, and all returned results and witnesses are correct.
No missing inputs, overlaps or unsupported audit expressions were found.

- 1,042 regression tests in 98 suites pass, including seven new scalar/metadata
  tests and a 72-case comparison with Z3 and independent integer enumeration.
- Six independent-auditor self-tests pass.
- Production and isolated browser-test builds pass, along with seven built-editor
  Playwright tests.
- All nine original HR intentions regenerate exactly the same 64 admitted test
  pairs; see [scale-verification.json](results/scale-verification.json).
- The summary script verifies source hashes, fixed markings, region comparisons,
  audit-file hashes, finite coverage, selection, admission and frozen pairs.

These new depth cases validate generation and APN replay. They have not been
run as new REST/UI mutation campaigns. The prior external-SUT evidence remains
in [INDEX_RESULTS.md](INDEX_RESULTS.md); neither the SUT nor its frozen test pairs
changed in this increment.

## Remaining scaling and theoretical limits

Five choices per entry still produce exponential region growth. Overlap analysis
still visits every region pair, even when a cheap certificate proves each pair
disjoint: length five checks 4,881,250 pairs. Generic correlated arithmetic, ADT predicates and unsupported forms
still require SMT. Selection, replay, copying and retained execution evidence
remain substantial costs. Arbitrary-depth recursion and enlarged markings are
not covered by this fixed-marking, fixed-length matrix.

The finite auditor does not establish coverage for all Nat durations, all APN
behaviors, or thesis subuniformity classes. The engine's `coverage: not-proved`
status remains unchanged. No region merging or representative-adequacy theorem
is inferred from these measurements.

## Reproduction

From the SUT directory, run sequentially:

```sh
node experiments/depth-benchmark.mjs --mode scale
node experiments/depth-report.mjs scale-benchmark --out scale-audit
node --test experiments/depth-audit.test.mjs
node experiments/verify-index.mjs --out scale-verification
node experiments/scale-summary.mjs
```

Restore the original `results/suites.json` from the existing
`results/generic-evidence.zip` before frozen-suite verification. Compact numeric
reports are committed. Full `results/depth-domains-scale-*.json` files are generated
locally for the audit and logical-region comparison. `--configs` accepts custom
configurations; `--out` chooses report names. The baseline/final presets explicitly
disable the new scalar and metadata optimizations to retain their earlier modes.
