# Increment 53: warehouse scaling and explicit SUT mutations

Branch `codex/satel-warehouse`, starting at `dcdb277`. Extends the second-domain
baseline without modifying the archived failure or its original results.

## Design recorded before measurements

Separate three axes, retaining the 42-transition generic APN:

- Data: recursive baskets of 2, 3 and 4 items, fixed 3 unused order IDs and
  4 line IDs per fixture order (same 37-token marking for all three lengths).
- Population: 3, 30 and 120 unused order IDs with four line IDs each; fixed
  two-item goal and interaction protocol. Product/warehouse/principal population
  stays fixed. This is a record-binding population experiment, not company growth.
- History: exactly 25, 50 and 100 pairs, fixed two-item goal restricted to
  quantities 1..2, four product combinations, fixed 37-token marking. Repeated
  release/read/reserve/read/audit cycles expose delayed effects without interleaving.

The data/population goal computes the first insufficient reservation index (zero
means all succeed). Reservations happen sequentially, one synchronized call per
line; this does not claim an atomic arbitrary-length basket method. The existing
atomic two-line reservePair remains covered by the original frozen baseline.

Eight distinct configurations (the data/population base is shared), three fresh
serial workers each. Separate initialization, compilation, unfolding, executable
selection and admission timers; retain peak RSS and explicit budget diagnostics.
Budgets: 4,096 branches / 60 s unfolding, 500,000 nodes / 180 s selection, 128 pairs;
worker wall-time guard 360 s. A cutoff is incomplete, never infeasible or complete.
Development preflight runs are recorded separately from controlled measurements.

Independent finite membership checks enumerate products 101/102 and quantities
0/1/8/10/12/13 at each list length (history audit uses 0/1/2/3). Validity is restricted
to the intention domain. Report the finite corpus rather than universal coverage.

## Mutation campaign design

Do not modify the baseline app.py to inject faults. Add a separate opt-in server
entry point and mutation module. Default application startup remains unchanged.
Freeze generated concrete witnesses before target runs. Require both baseline
transports to pass before mutation runs. Keep trace mismatches, adapter failures,
DB invariant failures and HML evidence separate.

Seven explicit fault hypotheses: aggregate shared-stock reservation uses max
instead of sum; cross-tenant order read; cancellation leaves stock reserved;
return credits stock twice; transfer loses units; refusal persists an order audit
entry; tenth reservation release adds an extra audit entry. The last fault should
require a sufficiently long history. These are constructed faults, not naturally
encountered bugs or a representative population of real defects.

REST runs the 62 original cases plus all admitted history witnesses. Browser
subset fixed in advance: all 12 original basket cases; lifecycle s1/s3/s6; read-role
a11; negatives n5/n8; history kinds [101,101] and [101,102] at every measured length.
Every negative full trace also gets the three existing public post-refusal reads.
Matched transport traces are compared exactly. The original HML and extended
trace interpretations remain separate. Record survivors rather than selecting
extra cases after seeing results to make the score perfect.

Any new unseeded baseline discrepancy is preserved before correction. The existing
initial-slot-ownership evidence must remain immutable. All source, decisions,
measurements and compact evidence are stored in the repository.

## Preflight log

Two-item preflight: 12 regions selected/admitted; four-item preflight: 80 selected/
admitted and finite audit passes. Initial 100-pair fixture compilation failed
because constant-product protocol cases still referred to undeclared p0/p1 in a
reused setup prefix. Corrected the fixture substitution before target execution;
this is experiment construction, not a SUT defect. The failed preflight row is
retained and excluded from timed trials. Baseline app.py remains untouched.

Before starting any new external-target runs, also fix an external baseline replay
for the first-trial admitted data/population suites: all witnesses over REST; the
first positive and first negative witness at each data length over the browser.
The population variants repeat the same declared application projection with more
reference tokens; they do not enlarge the seeded DB. These trace-only baseline
checks are separate from the predeclared mutation corpus and its HML campaigns.

## Controlled scaling complete

All 24 workers complete and admit every computed region. Data lengths 2/3/4 yield
12/32/80 regions. Median selection: 4.14/14.63/48.58 s. At fixed two-item goal,
37/172/622 tokens yield 4.14/4.94/4.71 s selection, with admission increasing
0.95/1.48/3.25 s. Histories of 25/50/100 pairs yield 5.95/18.15/44.25 s selection
for the same four regions/witnesses. Repeated suites are identical, all population
and history controls match, and history prefixes match exactly. Independent
finite audits pass; the one-node probe is unresolved (12), not blocked (0).

The data-length protocol also grows (11/14/17 pairs for successful cases), so
selection growth is not attributed solely to data unfolding. The derivation
phase and separate fixed-data history axis make this limitation explicit.

External data/population replay: 148 REST and six predeclared browser executions,
1,472 and 69 pairs respectively. All compatible, all DB checks pass, all six
matched event traces agree. Then both mutation baselines pass: 154 REST and 46
browser executions, including the frozen long histories and refusal extensions.

## Observation finding during mutation campaign

The `pair-max-demand` fault leaves two positive canonical tests publicly
compatible while stock reservation diagnostics fail. Their observations read
lines/order aggregates but do not read the stock balance. Fixed history tests
expose the fault at pair 12 (first stock read following release). These private
DB diagnostics are kept separate from public trace mismatch counts. This is an
observation limitation on those protocols, not a failure of the reference oracle.

## Final mutation evidence

All seven seeded faults are detected over both transports. Original canonical
tests detect five; adding the fixed post-refusal reads detects six; adding the
100-pair histories detects seven. The delayed audit fault is first observed at
pair 60 (27 audit entries versus expected 26); the 25/50-pair prefixes pass.

Mutation baseline plus seven variants execute 1,600 paths and 17,064 pairs:
91 public trace mismatches, zero adapter errors. All 368 matched REST/browser
paths agree exactly. HML evidence remains separate: 353 witnessed, 839
inconclusive, zero counterexamples; post-refusal extensions carry no HML claim.
Including the data/population replay gives 1,754 executions / 18,605 pairs;
all 354 unmutated executions pass. No new unseeded SUT defect was observed.

The refusal audit fault is detected by 37/40 REST post-refusal extensions.
Two surviving paths have no order argument and do not activate this injection.
The third (n11) refuses a call on order 1002 but its fixed probes read order 1001.
This observation-selection limitation is retained in the evidence; no post-hoc
corpus repair was made to increase detection counts. Deriving probes for every
record touched by a rejected call is a useful follow-up.

All 19 Python tests and script syntax checks pass. The normal backend/frontend,
original APN and archived failure remain unchanged. Increment 52's full editor
regression/build/browser checks were not rerun because this increment changes
only experiment code, opt-in mutation support and documentation.

Full measured tables, limits and reproduction are in
[SCALING_MUTATION_RESULTS.md](../../experiments/warehouse-sut/SCALING_MUTATION_RESULTS.md).
Compact machine-readable results, concrete witnesses, finite audit evidence and
source hashes are stored alongside the SUT. The campaign supports bounded
scaling and constructed-fault detection claims; it does not prove unrestricted
coverage, test adequacy or a real-world detection rate.
