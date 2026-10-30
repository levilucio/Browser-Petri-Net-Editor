# Increment 47: scalar feasibility and larger explicit depth budgets

This follows the [depth audit](increment-46-hr-depth.md). The HR application,
seed data, APN business rules, source equations and original nine intentions are
unchanged. The experiment retains the same 12-person, five-slot marking and
length-specific generic protocol. It addresses the feasibility cost and the
2,048-branch ceiling identified by Increment 46.

## Exact check-only scalar fragment

`ScalarConjunction.js` decides conjunctions of Boolean literals, independent
variable-to-constant equalities, and integer bounds. Supported sorts are Int,
Nat, Bool and String; inequalities apply only to integers. Nat adds a zero lower
bound. Integer intervals use BigInt endpoints, so strict bounds at the edge of
JavaScript's safe literal range do not overflow. Int remains mathematically
unbounded; the shortcut does not impose the concrete interface's numeric limits.

The entire conjunction must belong to this fragment before it returns either
SAT or UNSAT. Variable correlations, arithmetic expressions, ADT constraints,
disjunctions, unsupported syntax and invalid literal types use the existing SMT
path. A false conjunct cannot conceal an unsupported conjunct. The adapter also
requires the existing whole-signature structural and datatype-inhabitance checks
to succeed: a scalar query cannot hide malformed or ill-founded declarations.

The shortcut runs only for `witness: false`. Z3 still constructs witnesses and
the existing independent checks validate them. Cancellation and query caching
remain in effect. Narrowing enables the shortcut by default; the direct solver
API retains its former default. Set `simpleScalarChecks: false` on narrowing to
restore the SMT-only feasibility path. Scalar counters are reported separately
from actual SMT queries.

## Retained variable metadata and budgets

Each completed region retains sorts for variables referenced by its patterns,
conditions, result and root substitutions. Previously every leaf copied all
fresh sorts allocated so far, including those belonging only to other branches.
This projection changes metadata, not the region formula or witness. The
`compactDomainVariables: false` ablation restores the previous representation.
Profiles record total retained entries and the largest region's variable map.

The explicit `maxBranches` ceiling is now 65,536; the default remains 256.
The new experiment chooses 8,192 alternatives for length four and 32,768 for
length five. Deadlines and sequence budgets are also explicit. Exhaustion still
leaves unresolved obligations, and admission cannot accept an incomplete suite.
The larger ceiling alone does not make exponential search cheap or complete.

## Evidence and limits

The experiment compares full versus compact metadata at length three, then
compares SMT-only versus scalar feasibility with compact metadata. Length four
has an SMT-only control. Timed cases run serially in fresh processes, with Z3
initialization measured separately. Retained-variable counts and RSS snapshots
complement timings; snapshots are not peak memory measurements.

The independent finite auditor checks the returned regions and witnesses using
its own matcher, guard interpreter and WorkLog evaluator. Original HR tests are
regenerated and compared with the unchanged frozen suite. Complete cases undergo
actual executable selection and APN admission, rather than treating algebraic
region counts as execution evidence.

The engine's `coverage: not-proved` status remains unchanged. Finite audits do
not prove coverage of all natural-number durations, arbitrary recursive lengths,
APN behaviors or thesis subuniformity classes. The number of regions still grows
as five work-type choices per entry, and pairwise overlap processing remains
quadratic. No regions are merged merely because their review counts agree.

See [measurements and reproduction](../../experiments/hr-management-sut/SCALE_RESULTS.md).
