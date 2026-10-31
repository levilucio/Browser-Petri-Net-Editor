# Increment 49: bounded automatic HR refusal companions

Research log started 31 October 2026. This document is maintained alongside the
implementation and measurements for later paper reconstruction.

## Question and planned scope

Can the existing refusal solver generate useful negative HR tests after admitted
positive prefixes, without relying mainly on nonexistent identities or malformed
requests? The experiment keeps the APN business rules and earlier frozen suites
unchanged. Sequence-length scaling is a separate future experiment.

The existing policy replaces a scheduled positive call with one refused valuation
at that position. It cannot directly ask about a different method after the final
positive pair, and unrestricted Nat parameters readily select nonexistent actors.
We will add optional declarative targets: admitted seed, prefix length, method,
and finite parameter domains. Omitted domains retain their declared-sort meaning.
Singleton domains can be substituted before binding enumeration, permitting the
existing guard-derived indexes to avoid scanning unrelated employees/records.

Every refusal must negate every enabling binding of every method transition at
the reached reference marking. Bounds, unknown results and invalid requests must
remain explicit. A completed UNSAT result means no refusal within that target's
parameter scope; it says nothing about values outside the scope. Every generated
candidate must then pass concrete APN replay before external execution.

## Experiment decisions made before SUT results

Use valid login identities from both companies, existing records and structurally
valid request values. Use a small admitted time-entry workflow and a vacation
workflow, querying methods after creation and subsequent state changes. Separate
actor scopes prevent one easy unauthorized actor from exhausting the whole budget.
The solver chooses the refused payload; targets do not prescribe expected denials.

Run unmutated REST and browser baselines first, freeze generated tests, then reuse
the same tests for permission/state-check mutants. Keep authentication failures,
HTTP validation errors, timeouts, and modeled refusals distinct. Errors do not
count as mutant detections. Record attempts, scoped no-refusal results, duplicate
counts, unvisited targets and unresolved searches.

Use temporary live SQLite databases, atomic result publication and integrity
checks, following the unresolved corruption incident documented in Increment 48.
Successful repeats must not be presented as a root-cause fix for that incident.

## Interpretation boundary

These are bounded companions of fixed admitted prefixes. They are not an inferred
negative subuniformity partition or exhaustive enumeration of forbidden behavior.
Observed refusals establish trace compatibility, not universal black-box absence
of enabled alternatives. Concrete reference admission and black-box HML evidence
must remain separate in the reports.

## Implementation and results

The implemented target policy generated 129 negative tests from 160 targets;
31 completed searches found no refusal within their declared domains. There were
no unresolved searches, unvisited targets or duplicates. A separate concrete APN
enumeration checked all 565 valuations of those target domains and agreed with
every selected/no-refusal classification. All 129 candidates passed concrete
reference replay and left the reference marking unchanged on refusal.

The two fixed positive seeds contain six time-entry pairs and eight vacation
pairs. Time checkpoints are after pairs 1, 3 and 6; vacation checkpoints after
pairs 1, 3, 5 and 8. Actor scopes are employee 1001, assigned manager 101, another
manager 102, company HR 11 and other-company HR 21. Each terminal record already
exists in the admitted prefix. Finite payload choices are recorded in the manifest.
The browser subset is eight declared targets plus both positive controls.

A separate maxAttempts=1 probe leaves 159 targets unvisited and reports truncation.
It does not manufacture refusals or promote the partial result to coverage.

The unmutated REST baseline passes all 260 executions; the browser baseline
passes all 18. Five permissive mutants are detected through both transports,
while both positive controls and every separately executed positive prefix remain
compatible. Across 1,560 API and 108 browser executions, every matched transport
event sequence, trace verdict and HML evidence record agrees. All final database
integrity checks pass; no adapter errors or inconclusive trace verdicts occur.
The unmutated baseline still has 258 inconclusive HML evidence records, because
trace-compatible refusals and isolated prefixes do not establish universal absence.

Validation passes 1,046 regression tests in 99 suites, 17 backend tests, both builds,
seven HR/graphical/adapter browser tests and two refusal-workspace browser tests.
The original 64 test pairs remain unchanged. Exact frozen-suite reconstruction
and the concrete finite audit are checked. The external SUT's hidden state after
a refusal is not inspected; unchanged marking is a reference-admission fact only.

See [measurements, limitations and reproduction](../../experiments/hr-management-sut/NEGATIVE_RESULTS.md).
The next sequence-length scaling experiment remains separate and unimplemented.

## Export verification note

The first export check caught a schema distinction: legacy `testType: negative`
means whole-test verdict inversion and is intentionally rejected. The exporter
now uses the normal expected-success intention type and retains the explicit
final `blocked` assertion. This changes export metadata only; it does not change
the frozen test pairs or campaign evidence. Every exported intention is checked
through normal generation and admission before publication.

The explicit-intention importer normalizes the final observation's `public` scope
to `listed`. Its list contains all six public gates, so the observation is
equivalent. Export verification compares every call, assertion and output bag,
and requires complete gate lists whenever scope metadata differs. Run
`node experiments/negative-export.mjs --verify` to reproduce all 131 admission checks.

## Final HML evidence check

A final assertion checking for whole-formula HML counterexamples failed. Inspecting
the formulas and saved evidence established why: positive prefixes are nested
existential diamonds. An observed forbidden acceptance refutes the refusal at the
reached state, but does not rule out a different hidden continuation satisfying
the existential-prefix formula. All 258 negative/prefix HML records per API variant
remain inconclusive, including the mutant trace mismatches. The two positive
controls are witnessed. No HML engine behavior was changed to make the evidence
look stronger. Reports now explicitly classify detections as trace-conformance
counterexamples, and retain the distinct whole-formula HML status.
