# Generic HR APN: results and limits

Recorded 30 October 2026. This replaces the employee/slot-expanded default model.
The standalone SUT's implementation, database seed, public API and adapters are
unchanged. The earlier experiment remains in `EXPANDED_RESULTS.md`, with compact
historical evidence in `results/expanded/`.

## What changed

| Property | Expanded benchmark | Generic default |
| --- | ---: | ---: |
| Places | 72 | 4 |
| Transitions | 432 | 21 |
| Arcs | 1,872 | 120 |
| Methods / gates | 12 / 6 | 12 / 6 |
| Default modeled staff | 12 | 12 |
| Default slots of each record kind per person | 2 | 2 |

The four places are `employees`, `principals`, `timeEntries` and `vacations`.
Identities, company and manager relationships, authorization roles, balances,
record IDs and states are token data. Rules bind a generic employee, actor and
record, then check their relationships. Increasing the roster or reserved slots
changes only the initial marking. A structural test verifies identical rules and
arcs between one employee/one slot and 256 employees/eight slots. A further test
uses entirely different employee, manager, HR and company IDs.

Remaining transition alternatives represent business cases: standard/special
work, approval/decline, and the four old/new contribution combinations for HR
corrections. There is no transition per employee or per record slot.

Tokens use right-nested built-in Pair values, described in `README.md`. This
change does not introduce arbitrary custom domain sorts into the executable APN
runtime. WorkLog remains a custom recursive ADT used for symbolic test derivation.

The default initial marking still abstracts 12 selected staff and reserved
November records; it does not include all historical database rows. The SUT
retains its 256 staff, 7,680 historical time entries and 512 vacation requests.

## Behavioral checks and SUT campaigns

- All nine intentions produce **64 admitted tests**, with exactly the same
  stimulation/observation pairs as the frozen expanded-model suites.
- **82/82 REST and 82/82 Playwright baseline executions are compatible**, with
  no mismatches, errors or inconclusive results. Negative formulas account for
  the additional positive-prefix executions beyond the 64 generated tests.
- **All seven mutants are detected through both transports** across 1,148 mutant
  executions. Every API/UI verdict and recorded interaction event agrees. Verdict
  counts are identical to those obtained with the expanded reference.
- A differential test compares both APNs across 282 successive calls, interleaving
  four employees including a manager and another company. It exercises cross-owner
  refusals, self-approval refusal, every old/new approved-total contribution case,
  vacation charge/refund corrections and insufficient-balance refusal.
- Generic approved-minute totals are maintained incrementally in employee tokens.
  The differential comparison uses the expanded model's independent sum across
  work records, including observations of other employees after each correction.

| Mutant | REST mismatches | UI mismatches | REST / UI type errors |
| --- | ---: | ---: | ---: |
| `auto-approve-special` | 25 | 25 | 0 / 0 |
| `manager-scope` | 2 | 2 | 0 / 0 |
| `take-pending` | 3 | 3 | 0 / 0 |
| `double-charge` | 2 | 2 | 1 / 1 |
| `correction-no-audit` | 40 | 40 | 0 / 0 |
| `cross-tenant-hr` | 1 | 1 | 0 / 0 |
| `wrong-total` | 24 | 24 | 0 / 0 |

Double charging retains one error per transport: taking 21 days returns -12
remaining days, outside the declared Nat gate type. The checker currently calls
this an adapter error; it is not silently counted as an ordinary mismatch.
There are no inconclusive mutation verdicts. Mutation counts describe this
bounded fixture, not an estimated probability of detecting real defects.

## Generic binding and selection improvements

The first generic attempt exposed genuine search costs that employee-specific
expansion had avoided. The implementation now:

1. Rejects input-binding prefixes only when a bound guard establishes that they
   cannot enable the rule. Concrete execution preserves left-to-right guard/error
   behavior. Symbolic refusal checks also exclude provably disabled prefixes;
   every remaining binding is still covered and limits remain explicit.
2. Normalizes typed Pair values and evaluates unconditional constructor projections
   even when a neighboring field is symbolic. Any tags are preserved, wrong casts
   stay undefined, and partial computations in unselected fields are not erased.
3. Propagates scalar equalities already required by an algebraic class before
   enumerating paths. For example, a class requiring employee = 1001 constrains
   token binding immediately. This is not fixing arbitrary variables to a preferred
   witness; unconstrained values remain symbolic and whole-sequence constraints
   still determine executable representatives.

The default two-entry WorkLog selection visits 2,832 search nodes, within the
10,000 default sequence bound. Both enabled outcomes and refusal obligations are
checked with pruning disabled on smaller fixtures. Counters separate visited
nodes from pruned alternatives; they are not a count of all token-scan work.

Validation: **1,019 targeted regression tests in 95 suites**, plus **seven built
editor Playwright tests**, including generic generation and loading the expanded
benchmark. Both production and isolated browser-test builds pass. A refusal UI
unit suite was rerun after updating the explanation of pruned binding prefixes.
The unchanged backend's nine Python tests passed in the preceding experiment.
These checks are empirical evidence, not a proof of general semantic equivalence.

## Isolated marking-size benchmark

Each configuration runs in a new process, sequentially, with no competing
experiment jobs. Z3 initialization is timed separately and excluded below.
There is one measured trial per configuration: these timings are exploratory.
The same two-entry WorkLog intention derives 25 algebraic classes. Limits are
60 seconds for algebraic derivation, 60 seconds for executable selection,
10,000 sequence search nodes and a 150-second hard process limit.

This benchmark measures **derivation and executable selection only**. It does
not perform admission or SUT campaigns for the enlarged markings. The default
12-person model has the separate full admission and SUT evidence above.

| Model | Staff | Slots per kind/person | Initial tokens | Transitions | Selected | Unresolved | Seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Expanded | 12 | 2 | 72 | 432 | 25 | 0 | 3.59 |
| Generic | 12 | 2 | 87 | 21 | 25 | 0 | 9.31 |
| Generic | 48 | 2 | 301 | 21 | 25 | 0 | 18.42 |
| Generic | 120 | 2 | 730 | 21 | 25 | 0 | 34.89 |
| Generic | 256 | 2 | 1536 | 21 | 23 | 2 | 62.02 |
| Generic | 256 | 8 | 4608 | 21 | 8 | 17 | 62.23 |

The first three generic configurations select all 25 tests and reproduce the
frozen pairs. At 256 staff, the 60-second selection budget leaves unresolved
classes: two with two slots, and seventeen with eight slots. Every configuration
still completes the algebraic decomposition into 25 classes with no unresolved
algebraic branches or overlap obligations. No hard process timeout occurred.

The expanded comparison uses the **current engine** and the same selection-only
measurement, rather than its earlier end-to-end timing. Its faster result at the
12-person bound shows why fewer transitions alone do not imply faster execution.
Generic rules require scans and projections over larger shared token multisets.
That cost increases despite a nearly constant count of viable search nodes.
Candidate indexing by stable token fields is a sensible next optimization to
measure, with exhaustive fallback and equivalence tests.

The earlier recursive-depth experiment is preserved in
`results/expanded/stress.json`; it has not been rerun or relabeled as a new result.
Its depth-related unresolved branches and quadratic disjointness obligations
remain separate from this marking-size benchmark. The new experiment combines
the same recursive WorkLog derivation with generic APN selection; it does not
establish unbounded ADT support or coverage of all modeled employees.

## Inspect and reproduce

On branch `codex/satel-hr-stress`:

- **Examples → HR management — Reference** loads the generic model.
- **Examples → HR management — Expanded benchmark** loads the retained model.
- **SATEL → APN source** shows the textual class. Source snapshots are
  `specification/hr.copn` and `specification/hr-expanded.copn`.
- `npm run generate`, `npm run test:baseline` and `npm run test:mutants` regenerate
  and replay the default suites. The mutant command exits nonzero for the retained
  Nat-contract errors; inspect the recorded verdicts.
- `node experiments/generic-stress.mjs` reproduces the marking-size experiment.
- `node experiments/verify-generation.mjs` checks exact frozen-pair reproduction.

`results/generic-evidence.zip` contains the generic APN JSON, frozen suites,
generation data, full baseline/mutant traces and compact summaries. Extract it at
this standalone project's root to reproduce against the exact tested suite.
All seven mutants are separate SUT variants; expected results remain fixed.
