# Increment 54: HML and a nondeterministic reservation web SUT

Design recorded before target execution. Parent: warehouse increment 53, commit
`2c5ee85`. Branch: `codex/satel-hml-web`.

## Experimental question

Which finite HML properties can public REST/browser traces decide, and which
require controlled exploration of alternative continuations from the same state?
Retain synchronous method/gate pairs. No concurrent users, background jobs,
timeouts-as-refusals, private marking predicates or state merging across resets.

Build an independent Python/SQLite/web reservation service. Opening retains the
choice of warehouse A or B. Automatic allocation chooses either; an explicit
reservation chooses the requested warehouse. Finishing returns its receipt.
The small model isolates branching rather than adding another size benchmark.

Five frozen HML properties: possible allocation A; possible allocation B; no
allocation 99; every ready state retains explicit A and B reservations; every
automatic B allocation produces only receipt B on finish. All hold in the APN.
Generate/admit these through SATEL, preserving methods/gates concrete syntax.

Four predeclared SUT faults: automatic allocation reports 99 on its B branch;
automatic allocation loses B; opening secretly commits to A/B; B completion
reports the wrong receipt. No fault changes the reference properties.

## Two access conditions

Ordinary access uses public forms/REST, initial reset and 16 repeatable seed values
per extracted modal path. Seed controls the test environment's entropy, not a
claimed IID operational distribution. No checkpoint or branch-selection access
is used in these runs. Each run gets independent existing SATEL trace/HML evidence;
no combination of resets establishes shared hidden state. Expect missing B to
remain HML-inconclusive under sampling, even if it is never witnessed.

Controlled access adds opaque full-database checkpoints and an explicit binary
entropy selector. The service has no other evolving business state or external
dependencies. Each request makes at most one binary choice; enumerating selector
0/1 therefore covers its declared environmental outcomes. This completeness is
an implementation/testability assumption, not inferred from observed frequency.
Snapshot/restore covers stored seed/counter as well as hidden commitment. Changing
the selector explores external entropy alternatives; it is not replaying one fixed
PRNG trajectory. This is instrumentation, not an ordinary black-box verdict.

Evaluate the same finite HML AST recursively over real calls restored from each
parent checkpoint. Refusals are not accepted HML edges. Branches are explored
separately; no database values form expected gate observations. Universal success
or existential failure requires complete enumeration. Limits/timeouts/errors must
never become evidence of absence. Test a forced budget cutoff separately.

Baseline must pass trace compatibility and controlled properties over both REST
and real browser interaction before mutants run. Freeze source/corpus hashes.
Preserve any unexpected baseline failure and the actual implementation before
fixing it. Retain all research notes, reports and reproducing commands in this repo.

## Interpretation boundaries

An early-commitment refusal can be a public trace mismatch without deciding the
branching HML property. A missing B branch can leave all sampled traces compatible
while failing controlled existential evaluation. Controlled HML truth is relative
to the declared choice interface and checkpoint fidelity, not a proof of a general
web service or equivalence to the thesis. Measure decisiveness separately from
mutation detection. The app is a local research SUT, not a production service.

## Implementation and validation notes

The APN has one internal state place, seven transitions, four methods and three
observation gates. SATEL generates/admit five explicit finite HML tests, yielding
six modal call paths. The procedural backend imports no APN or SATEL code.

Eleven backend tests cover branch effects, refusal rollback, relational seed data,
complete checkpoint restoration (including hidden commitment and seed/counter),
invalid requests and all four fault mechanisms. Eleven independent finite-relation
checks exercise the controlled evaluator, including failure to pool separate
hidden successors, destructive sibling continuations, absent edges, complements,
restoration errors, transport errors and resource exhaustion.

The first baseline passed. Before the mutation campaign, evaluator review added
an elapsed-time check after a response: a late nonmatching response must not
establish a vacuous universal property. An independent regression test checks
that boundary. Both baseline transports were rerun against the final source
hashes. This was a preventative harness correction, not an observed SUT failure.

The PNML export preserves all five intentions and all three gates on round trip;
all five properties still evaluate true on the re-imported APN. Desktop and mobile
SUT layouts were visually inspected; mobile has no horizontal overflow. No editor
engine/frontend source or earlier archived evidence was modified.

## Report finalization issue

The first full mutation run logged all property executions, but the summary
rejected four reports retaining earlier incomplete progress snapshots. Captured
original harness, completion log, rejection and file/hash inventory in
`experiments/reservation-sut/evidence/report-finalization` before correction.
No new SUT discrepancy was implicated. Exact persistence cause remains unresolved.
Use atomic report replacement and explicit final readback; rerun all baselines
and mutants against the corrected harness. Exclude the incomplete exports from
final results. This check prevented treating partial evidence as a complete run.

Atomic rename alone did not resolve the report reversion: final readback succeeded,
but the later baseline gate saw an incomplete file. Final runs use an isolated
`RESERVATION_REPORT_DIR` under `/tmp`; summary verification occurs there before
copying each completed artifact into the repo once. Source/corpus hashes and
complete-status checks remain mandatory. This separates live execution evidence
from synchronized workspace publication.

## Final verified outcomes

The isolated final campaign completes successfully. All copied report hashes and
cross-transport comparisons verify again inside the repository.

960 ordinary executions (2,064 pairs): 112 public trace mismatches, zero errors or
trace-level inconclusive results. Ordinary HML: 144 witnessed, 32 counterexamples,
784 inconclusive. Fifty controlled formula evaluations (364 public calls): 40 true,
10 false, zero unknown/error. All 192 unmutated traces and ten controlled baseline
properties pass. The 480 paired ordinary executions and 25 paired controlled
explorations agree exactly between REST and browser.

Trace checking detects 3/4 constructed mutants; decisive ordinary HML evidence
refutes properties for 2/4; controlled evaluation detects 4/4. Missing automatic B
survives every ordinary trace and remains existentially inconclusive there, but
controlled enumeration refutes its existence. Early commitment produces public
refusals while the branching HML property remains inconclusive in all 32 ordinary
branching experiments per transport; the controlled conjunction is false.

No unseeded SUT business-logic failure was observed. The reporting failure is
preserved separately, without relabelling it as a SUT defect. Full measured tables,
assumptions, caveats and artifact references are in
[RESULTS.md](../../experiments/reservation-sut/RESULTS.md).
