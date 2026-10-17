# Increment 13 — Explicit final refusal expectations

## Behavior and scope

An intention may contain an executable positive prefix followed by one method
call that must be refused. Refusal means **no enabled public-method rule with any
available input-token binding**, no produced tokens, and an unchanged marking.
A single refused call with an empty prefix is also supported. Refusal must be the
last pair. Whole-test verdict inversion remains unsupported.

Symbolic sequence notation:

```text
{ reserve(n=3) with eligible(true) } .
{ audit() with free(7) // reserved(3) } .
{ release(n=0) with refused }
```

The underlying protocol uses `pair release(n=0) => refused`. The finite intention
editor offers an **Expected response** selector on each method pair; refusal is
available for the final pair. `none` continues to mean an accepted call producing
no public output tokens, which is distinct from refusal.

## Construction and validation

`RefusalConstraints.js` enumerates the finite input occurrences at the reached
symbolic marking, respecting multiplicity and shared variables. For each rule
and each possible binding it constructs the conjunction of binding equalities
and its guard. Refusal conjoins the negations of **all** these enabling cases.
A rule with insufficient input occurrences contributes no enabled case. Bounds
and cancellation interrupt construction without returning a partial formula.
Parameter sorts and runtime integer bounds remain required.

The existing whole-sequence solver combines this formula with the intention's
class conditions and positive-prefix constraints. It may choose a new
representative in the same class. Concrete admission then checks the entire test
from the reference initial marking. A blocked-call check can establish that a
call is enabled even if multiple choices exist: it does not need to fire or pick
one. Accepted execution still rejects unsupported nondeterminism. Guard/output
evaluation errors and binding-search exhaustion remain errors, never refusals.
Replay also verifies unchanged markings and any supplied marking assertions.

## Existing baseline and loadable examples

The ten existing exercise specifications and their original intentions remain
unchanged. Two additional example families reuse their quota and thermostat
models and retain the original positive intention beside a new refusal intention:

* **SATEL Refusal — Quota reference:** reserve 3, audit, refuse release(0).
  The mutant weakens the release guard to admit zero.
* **SATEL Refusal — Thermostat reference:** adjust by 1, read 21, then select
  an adjustment outside [-5, 5]. The two sign classes select -6 and 6.
  The mutant removes the warm rule's upper bound.

The original positive intentions pass these additional mutants. The refusal
intentions detect them, with behavioral failures rather than execution errors.
Load a reference, generate its first intention, load its matching mutant, and
replay the frozen suite without regenerating.

**Account caveat:** the existing Account example explicitly implements an
insufficient-funds response using `withdrawRefused` and `ack(0)`. Such a call is
accepted at the method interface and is NOT a blocked call. It remains tested as
an ordinary expected response. A regression protects this distinction. One
focused test uses an explicitly modified partial-method account to exercise a
balance-dependent refusal; it does not change the shipped Account model.

## Verification

Focused tests cover reached-state witness selection, alternative rules, duplicate
token multiplicity/shared variables, nondeterministic enabled calls, unchanged
markings, additional marking assertions, malformed output errors, search
exhaustion, both new mutant families, and Account response semantics. Editor tests
cover finite assertions, symbolic notation, nonterminal-refusal rejection and
PNML round trips. Full regression/build/browser evidence is recorded with
increment 15 once all three increments are integrated.

## Limits

No negative-output patterns, arbitrary negative sequences, hidden transitions,
or external-system timeout protocol is introduced. “Refused” is an APN method
enabledness observation; an external adapter would need an explicit operational
means to observe it. This is a supported fragment, not a claim of complete SATEL
negative-test semantics.
