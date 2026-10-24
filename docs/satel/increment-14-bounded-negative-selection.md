# Increment 14 — Bounded automatic refusal companions

## Policy

After an intention's positive candidates have passed reference admission, the
optional companion selector visits their prefixes in stable test/position order.
It retains each prefix's concrete calls and authored expected observations. At
the next call it replaces the arguments by fresh variables of the declared method
parameter sorts and solves the universal refusal formula from increment 13 at
the reached marking. A successful companion ends with that refused call.

One valuation is selected per distinct prefix/call position, not per algebraic
class. Duplicate prefix/method combinations are skipped. The policy does not
try different method names, synthesize longer paths or negate expected outputs.
It skips seed sequences already containing refusal assertions or legacy direct
transition calls. All companions use the normal canonical pair representation,
reference admission and target replay. Their expectations are then frozen.

**Terminal parameters are intentionally allowed to leave the seed intention's
conditions and finite values.** The earlier parameter values, observations and
state remain fixed. This is an explicit robustness policy, not a claim that the
new test satisfies the original positive intention or its subuniformity classes.
Authored refusal intentions, by contrast, retain their own declared conditions
and class hypotheses throughout whole-sequence selection.

## Bounds and outcomes

Defaults per invocation:

* At most 10 selected negative tests.
* At most 40 distinct prefix/call searches.
* 10,000 cumulative binding-enumeration visits.
* 20 seconds of selection budget, plus the existing bounded equation and solver
  checks. These cooperative limits are not a hard real-time wall-clock promise.

A completed UNSAT search is recorded as `no-refusal` for that particular reached
marking and method. Unknown solver answers, undefined/unsupported evaluations,
and exhausted searches remain `unresolved`. Nothing is generated from them.
Unattempted work after a cap is recorded as `truncated`. Neither outcome implies
negative-domain coverage. Successfully admitted seed tests and companions remain
usable even if optional companion selection is incomplete; the saved suite
retains that incompleteness explicitly. This differs from required algebraic
class selection, whose unresolved obligations still block admission.

## Usage

```javascript
const { report, suite } = await generateIntention(intention, referenceNet, {
  includeNegative: true,
  negativeLimits: { maxTests: 10, maxAttempts: 40 }
});
```

The Generated tests GUI offers **Also select bounded refusal tests from validated
positive prefixes**. It is off by default. Existing generation is unchanged when
the option is off. The integrated explanation UI is described in increment 15.

## Baseline and performance checks

`negative-selection.test.js` exercises all ten existing APN families, preserving
their original positive test counts and lengths (up to 20). It verifies reference
replay, fixed prefixes, unchanged refusal markings, bounds, cancellation, solver
unknown, the Account's explicit rejection response, and detection of a newly
permissive guard that positive tests miss. The original 20 mutants continue to
be detected by the original positive suites.

Run the complete companion/mutant smoke matrix with:

```sh
cd petri-net-app
node tools/node/run-satel-refusals.js ../docs/satel/performance/refusals-2026-10-17.json
```

This command measures positive generation/admission, companion selection and
companion admission separately; it replays the combined suite against every
original mutant, recording errors separately from behavioral failures. It also
checks both new refusal-mutant families. The JSON is a single sequential smoke
measurement with a warmed shared Z3 context, not a statistical speed benchmark.
Increment 15 summarizes the integrated run.

## Remaining work

Class-aware selection within the refusal domain, fairness across seed tests,
negative-output patterns, nondeterministic conformance and arbitrary negative
sequences remain open. In particular, exhausting this finite scheduling policy
must not be described as exhausting the infinite negative test domain.
