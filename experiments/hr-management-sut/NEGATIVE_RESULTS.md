# Automatic HR refusal companions

Research record, 31 October 2026. This follows the
[observable-history experiment](EFFECTIVENESS_RESULTS.md). All research Markdown
for this increment is stored in the repository, including the design and scope
log in [Increment 49](../../docs/satel/increment-49-hr-negative-tests.md).

## What is automatic and what is supplied

The experiment supplies two positive workflows and a bounded search policy.
The solver derives refused terminal arguments from the APN; it does not learn
refusals from the SUT or infer all possible negative intentions. The seeds are
explicitly authored, concretely admitted workflows, not new ADT partitions.

The unchanged generic HR model has four places, 21 transitions, 12 employees,
two record slots per employee and 87 initial tokens. One seed submits, approves
and corrects work (six stimulation/observation pairs); the other requests,
approves, takes and corrects vacation (eight pairs). The search targets different
methods after selected admitted prefixes, including after the final seed pair.

Five fixed actor scopes use valid logins: employee 1001, assigned manager 101,
other manager 102, own-company HR 11 and other-company HR 21. Employee and existing
record references are fixed. Other parameters range over explicitly recorded,
structurally valid finite values. This avoids conflating method refusal with
unknown-login errors or HTTP payload validation failures. Values outside these
scopes are not covered by a completed no-refusal result.

## Derivation, finite checking and admission

The search examines **160 targets**, derives **129 negative tests**, and finds
**31 targets with no refusal within their scope**. No target is unresolved or
unvisited; there are no duplicate targets or candidates in this matrix. Each
successful target contributes one witness, not every refused valuation.

A separate concrete checker enumerates all **565 valuations** across the declared
target domains. It uses concrete APN successor enumeration rather than the symbolic
refusal formula or Z3. It agrees with every selected/no-refusal classification.
This checks two execution paths through the implementation, not an independent
formal semantics or proof of the thesis correspondence.

All 129 negative candidates pass concrete reference replay. The final refusal
leaves the APN marking unchanged. The tests contain **2–9 pairs**, including the
accepted prefix. The two positive controls remain separate tests. A deliberately
restricted maxAttempts=1 run reports one attempt, 159 unvisited targets and
truncation; it does not fabricate results for the unvisited targets.

Symbolic negative search took **1.23 seconds**. Search, finite
cross-check and negative admission together took **4.04 seconds**
after admitting the two seeds. Final process RSS was **385.7 MiB**,
a snapshot rather than peak memory. These are individual trial measurements.

## External baseline and mutation campaigns

REST executes all 131 tests. Each negative test produces a separate positive-prefix
execution and a full refusal execution, giving **260 executions per variant**.
The browser selection was declared before any SUT results: eight targets covering
role restrictions and state changes, plus both positive controls. It produces
**18 executions per variant**. The same calls and observations are compared across
transports; the browser subset does not establish full frontend equivalence.

The five opt-in backend variants broaden manager scope, broaden HR company scope,
allow taking pending vacation, allow repeat decisions, or permit employee self-
correction. The latter two variants are new; the other three are retained from the
original HR experiment. Positive controls and positive-prefix runs must remain
compatible. A negative-test detection requires acceptance where every compatible
reference state refuses; errors and timeouts are not detections.

The unmutated SUT passes **260/260 REST executions and 18/18 browser executions**.
All five permissive mutants are detected through both transports. Positive controls
and all separate positive-prefix executions remain compatible for every variant.
Every mismatch occurs at the terminal refused operation and is classified as
unexpected acceptance. There are no adapter errors, timeouts or inconclusive
*trace verdicts* in these campaigns; every database integrity check passes.

| Variant | API negative mismatches / 129 | UI negative mismatches / 8 | API time | UI time |
| --- | ---: | ---: | ---: | ---: |
| none | 0 | 0 | 7.63 s | 12.97 s |
| manager-scope | 2 | 1 | 7.09 s | 12.78 s |
| cross-tenant-hr | 14 | 1 | 7.31 s | 12.44 s |
| take-pending | 1 | 1 | 6.86 s | 12.43 s |
| repeat-decision | 5 | 3 | 6.29 s | 12.76 s |
| employee-correction | 7 | 1 | 6.26 s | 12.45 s |

Across the baseline and five variants, there are **1,560 REST executions and
108 browser executions**. All 108 matched event sequences, trace verdicts and
HML evidence records agree exactly between transports. Full compact evidence and
first counterexamples are in [negative-summary.json](results/negative-summary.json).

The unmutated baseline nevertheless contains **258 inconclusive HML evidence
records and two witnessed records**. The two witnesses are the positive controls;
negative tests and their isolated prefixes do not prove universal absence of a
black-box transition. This differs from the trace verdict: all 260 observed
baseline executions are compatible. The same 258 HML records remain inconclusive for each mutant, including runs
with unexpected acceptance. The positive prefixes are existential modalities:
one bad continuation cannot refute the existence of another hidden continuation
satisfying the formula. The observed acceptance is a definite APN trace-conformance
counterexample, but the checker does not promote it to a counterexample of the
whole existential-prefix HML formula.

Every run resets the experiment's November records and sessions while retaining
the synthetic historical database. Live databases and event logs use temporary
directories; completed reports are published atomically. Each campaign checks
SQLite integrity. This follows the earlier corruption incident; it does not claim
to have established or fixed that incident's root cause.

## Observation and theoretical limits

A refusal response with no public output can be trace-compatible with the model.
It does not establish universal disabledness of a hidden, potentially
nondeterministic SUT. The campaign therefore retains its separate HML evidence
status rather than relabeling every compatible negative execution as a proof.
Unexpected acceptance provides a concrete trace-conformance counterexample here;
the whole existential-prefix HML formula can still remain inconclusive.

Likewise, the unchanged *reference* marking after a refused call is checked during
admission. A terminal refusal response alone does not prove that the SUT made no
hidden state changes. Detecting such changes would require additional observable
follow-up operations, which are outside these terminal-refusal companions.

These are bounded companions of fixed admitted prefixes, not negative
subuniformity classes or complete negative coverage. Actor and payload scopes,
method choices and checkpoint choices are part of the experimental policy. The
engine's default unscoped companion policy remains available and unchanged in
meaning. Invalid target declarations are rejected; solver unknowns remain
unresolved; resource exhaustion records unvisited targets explicitly.

## Validation and reproduction

- 1,046 regression tests in 99 suites pass, including four new scoped-target tests.
- 17 Python relational/HTTP tests pass, including the two new mutation checks.
- Production and isolated test builds pass; seven HR/graphical/adapter browser
  tests and two refusal-workspace browser tests pass.
- The original nine HR intentions regenerate the same 64 frozen test pairs.
- Frozen negative suites reconstruct byte for byte from the committed manifest.
- All 131 editor-exported intentions pass normal generation/admission with equivalent
  calls, refusal assertions and complete gate observations (`negative-export.mjs --verify`).

From this directory:

```sh
node experiments/negative-restore.mjs
node experiments/negative-campaign.mjs --transport api
node experiments/negative-campaign.mjs --transport ui
node experiments/negative-campaign.mjs --transport api --variants manager-scope,cross-tenant-hr,take-pending,repeat-decision,employee-correction
node experiments/negative-campaign.mjs --transport ui --variants manager-scope,cross-tenant-hr,take-pending,repeat-decision,employee-correction
node experiments/negative-summary.mjs
```

Install Playwright Chromium or set `SATEL_CHROMIUM`. Campaigns are serial by default;
use separate ports for separate processes. The manifest includes scoped targets,
search diagnostics, concrete audit results and fixed tests. Full event logs and
live databases stay local. The summary includes counts, counterexamples, transport
agreement, timings, memory snapshots and HML evidence categories.

`node experiments/negative-generate.mjs` performs a new selection and deliberately
replaces the local manifest; fresh baselines and campaigns are then required.
`node experiments/negative-export.mjs` creates an editor-importable
`specification/hr-negative.apn.json` containing all 131 frozen intentions. The
original HR example and earlier frozen suites remain unchanged.
