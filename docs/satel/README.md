# SATEL for Algebraic Petri Nets

SATEL is an experimental partial implementation of test selection from algebraic Petri nets. The editor supports **typed test intentions**: typed variables and stimulation/observation pairs.

## Development record and paper preparation

See the [development and decision summary (16 October 2026)](development-summary-2026-10-16.md)
for the complete conversation-derived implementation history, current semantics,
validation evidence, deferred negative/nondeterministic testing, and research questions.
It distinguishes established prototype behaviour from unproved mathematical claims.

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
