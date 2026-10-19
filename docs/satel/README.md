# SATEL for Algebraic Petri Nets

SATEL is an experimental partial implementation of test selection from algebraic Petri nets. The editor supports **typed test intentions**: typed variables, stimulation/observation sequences and branching HML properties.

## Development record and paper preparation

See the [development and decision summary (16 October 2026)](development-summary-2026-10-16.md)
for the complete conversation-derived implementation history, current semantics,
validation evidence, historical deferrals, and research questions. See the later increments for implemented negative and nondeterministic testing.
It distinguishes established prototype behaviour from unproved mathematical claims.

The [publication and black-box testing planning note (18 October 2026)](paper-planning-publishability-and-black-box-testing.md)
records proposed contributions, correspondence proofs, observability limitations,
statistical execution experiments, and related-work leads for the future paper.
It separates research proposals from implemented functionality and proved results.

## Nondeterminism and branching properties

[Increment 25: HML expression reuse](increment-25-hml-expression-reuse.md) reduces
repeated guard/output translation while preserving full audit histories. Paired
measurements show lower construction work and selection times; the larger audit
cases remain unresolved at the unchanged limits.

[Increment 24: shared HML term graphs](increment-24-shared-hml-terms.md) preserves
expression sharing through substitution and SMT encoding. Eight-worker cases now
resolve through eight rounds in the measured models; audit-history construction
still exposes a separate limit.

[Increment 23: ordinary sequence witness search](increment-23-sequence-witness-search.md)
extends Boolean preservation to ordinary sequences and refusal companions. The
existing coupled allocators now resolve through 64 resources in the measured
cases, with reference/mutant replay and unchanged production search budgets.

[Increment 22: reliable witnesses and Boolean search](increment-22-solver-reliability.md)
retains validated witnesses across optional solver preferences, fixes typed prefix
pruning, and avoids expanding solver-ready HML conditions during ADT unfolding.
It records paired benchmarks with unchanged budgets and remaining scaling limits.

[Increment 21: black-box campaigns](increment-21-black-box-campaigns.md) adds
independent procedural SUTs, a **Black-box runs** GUI, compatible-reference-state
tracking, and conservative per-execution HML evidence. It includes the laptop
walkthrough and reproducible fault campaigns; statistical and universal
black-box conformance guarantees are not claimed.

For a practical walkthrough of the current GUI, see the [HML, nondeterminism and negative-test review guide](gui-review-2026-10-17.md).

[Increment 16: HML properties and nondeterminism](increment-16-hml-nondeterminism.md)
adds multiset/rule successor exploration, an approachable branching editor,
expected-true/false properties, bounded verdicts, and two references with five
mutants. It includes the laptop walkthrough, performance results and the limit
on symbolic representative selection for additional branching requirements.

[Increment 17: HML failure explanations](increment-17-hml-failure-explanations.md)
adds linked plain-language explanations beside formal results, retains rejected
outcomes and their output/marking mismatches, and includes actual examples from
the mutants plus a selectable stock-marking property.

[Increment 18: joint sequence and HML selection](increment-18-joint-hml-selection.md)
selects shared Nat/Int/Bool parameters satisfying the sequence and additional
branching requirement together. A new reference and two mutants demonstrate
replacing a sequence-valid value of 1 with a branching-valid value of 3, including
an expected-false requirement.

[Increment 19: algebraic HML selection](increment-19-algebraic-hml-selection.md)
extends joint selection to String, List and Pair with guarded operation unfolding.
[Increment 20: scalability experiments](increment-20-scalability.md) measures
solver constraints, custom ADT analysis and larger executable APN abstractions.

## Negative tests and generation explanations

[Increment 13: explicit final refusals](increment-13-explicit-refusals.md) adds
reachable positive prefixes ending in a call that must be blocked, with quota and
thermostat reference/mutant examples. [Increment 14: bounded refusal companions](increment-14-bounded-negative-selection.md)
adds opt-in automatic selection from validated positive prefixes. [Increment 15:
generation explanations and verification](increment-15-generation-explanations.md)
provides the laptop walkthrough, baseline results and performance observations.

A refused call has no enabled method rule or token binding and preserves the
marking. An accepted call returning an error response, such as Account's `ack(0)`,
is a different observation. Exhausted searches never become refusal tests.

## Unified testing pipeline

[Increment 12: unified selection, admission and replay](increment-12-unified-pipeline.md)
documents the common test representation, stepwise verdicts, compiled models,
search improvements, compatibility changes and measured performance.

## Typed exercise collection

[Increment 11: ten reference APNs, twenty mutants and performance results](increment-11-typed-exercise-collection.md)
adds examples spanning Int, Nat, Bool, String, Pair and List, with sequences from
2 to 20 pairs. Open **Examples → SATEL exercises**, generate on a reference,
then replay its frozen suite on the matching mutants. The guide includes the
mutation matrix, timing measurements, CLI export command and remaining limits.

## Start with the oracle-validated example

1. Load **Examples → SATEL Account — Reference**.
2. Open **SATEL → Generated tests** and generate the refined suite. Four tests must pass the reference oracle before admission.
3. Close the panel and load an account mutant from Examples.
4. Reopen SATEL and replay the frozen suite. Inspect the first mismatching observation.

See [typed public methods](increment-07-typed-methods.md) for execution with Bool/String/Pair/List, readable argument entry, two-pair reference/mutant examples and current runtime limits.

See [built-in ADTs and compound guards](increment-06-builtins-compound-guards.md) for current type coverage, shared-variable conditions, guard import, reference/mutant examples and laptop review steps. [Increment 5](increment-05-generic-symbolic-z3.md) introduces editable equations and recursive custom ADTs.

See [parameterized public methods](increment-04-public-methods.md) for the original public-method execution contract, GUI review steps, and scope. [Increment 3](increment-03-initial-marking.md) describes the earlier direct-transition contract.

See [the GUI review guide](increment-02-gui-v2.md) for the exact steps, expected outcomes, V1 removal, and current limitations. [Increment 1](increment-01-symbolic-oracle.md) explains constructor/conditional-equation unfolding and its supported fragment. The CLI remains available with `cd petri-net-app && npm run satel:oracle-example`.

The classes are derived from ADT constructor patterns and conditional operation equations, not from enumerated executions. Symbolic intentions now save editable typed equations, goals and declarative pair protocols. The GUI uses generic bounded unfolding with Z3 constructor/arithmetic solving. Custom editor ADT XML can be imported for the supported oriented-equation fragment. Unresolved branches and overlap checks are visible; exhaustive coverage is not claimed. See increments 6 and 7 for current assumptions and remaining limits.

See [whole-sequence executable selection](increment-09-executable-sequences.md) for
marking-aware parameter selection and a reference/mutant example where the final
observation determines an earlier withdrawal. The [intention workspace](increment-08-intention-workspace.md)
describes the current GUI.

For a larger example, see [fulfilment and six mutants](increment-10-fulfilment-example.md):
34 places, 17 rules, and four tests of ten stimulation/observation pairs each.

## General intentions

Use **SATEL → Intentions** to create or edit a typed-variable intention. **Generated tests → Generate tests** instantiates it, then checks every candidate on the reference APN. Failures/errors prevent admission and are shown in Generated tests. An admitted suite can be replayed against the loaded APN with unchanged expectations.

The general generator/checker remains experimental and less restrictive than the account adapter. In particular, the manufacturing examples still have known semantic/test failures. Their presence in Examples does not imply all their intentions are correct.

V1 intention editing, generation, execution, and fixtures have been removed. Old V1 intentions are rejected, not automatically migrated. Historical design documents and videos describe earlier implementations and are not current behavior guarantees.
