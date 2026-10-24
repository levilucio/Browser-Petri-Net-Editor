# Increment 21 — bounded black-box campaigns and observable evidence

19 October 2026. Builds on the existing SATEL/APN reference specifications and the
[publication planning note](paper-planning-publishability-and-black-box-testing.md).

## What this increment delivers

An admitted SATEL suite can now drive an independent procedural JavaScript SUT.
The reference remains the saved APN. The tester receives method responses, not
the SUT's places, internal state, token selections, or transition firings.

The GUI has a **Black-box runs** tab, with three small service families and five
faulty variants. It displays readable stimulation/observation pairs, compatible
reference-state counts, observable mismatch explanations, and separate HML
evidence. Runs, reference model, and tests can be downloaded together.

This is the first experimental execution increment. It does not establish the
planned correspondence theorems or implement statistical model checking,
snapshot/restore, adaptive test strategies, or asynchronous systems.

## Laptop walkthrough

```sh
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm ci
npm run dev
```

### Multiset service and missing stock

1. Load **Examples → SATEL Nondeterminism — Multiset reference**.
2. Open **SATEL → Generated tests**, keep **Both token orders, multiplicity and
   final refusal**, and click **Generate tests**.
3. Open **Black-box runs**. Choose **Bag service** and run the campaign.
4. Observed executions should be compatible. The complete HML property stays
   inconclusive: sampled refusals do not prove absence of all alternatives.
5. Choose **Bag fault: missing duplicate** and run again. The third `take()` is
   refused while every compatible APN state still holds one token.
6. Inspect the pairs, allowed reference responses, and counts. Download the evidence.

The saved reference stays fixed when another model is loaded into the editor.
Generating a new suite clears the previous black-box campaign. Closing/reopening
SATEL or switching tabs retains it; browser refresh does not persist it.

### A decisive negative-property counterexample

Using the multiset reference, generate **No third value may be reported**. Run
**Bag fault: wrong output**. Its `picked(99)` both contradicts the reference and
refutes the forbidden-output HML property. The report therefore contains an
observable mismatch and a genuine property counterexample.

### Hidden branching remains unresolved

Load **SATEL Nondeterminism — Branching reference** and generate **One open outcome
retains both choices**. Run **Choice service**. The experiment tries `open; left`
and `open; right` from separate fresh instances. Although both continuations are
observed, it does not establish that they were possible from the same hidden state.
All property evaluations remain inconclusive.

**Choice fault: early commitment** has the same accepted traces as the reference,
but its explicit refusal of `left` after choosing right can be detected. This is
not a contradiction of the trace/branching limitation: the experimental alphabet
also observes refusals. The original HML property still cannot be settled by those
separate sampled runs.

### Shared parameters and a failing worker

Load **SATEL HML selection — Reference**, generate **Choose an amount allowing
every open outcome to finish**, then run **Two-worker job service**. Generation
selects an amount of at least 3, using the existing symbolic pipeline.

Try **Job fault: failed worker** and **Job fault: wrong receipt**. The first can
refuse `finish()` despite every compatible reference state accepting it; the second
reports `reply(99)` rather than `reply(0)`. They are different mismatch reasons.
The complete nested HML property may remain inconclusive even when an observable
execution mismatch is decisive.

## Experimental contract

The API lives in `petri-net-app/src/satel/blackbox/`. An adapter factory returns a
fresh SUT instance per experimental path and repetition:

```js
const createSut = () => ({
  interface: {
    methods: [{ name: 'take', parameters: [] }],
    outputs: ['picked'],
    outputSorts: { picked: 'Int' },
  },
  async reset({ seed, signal }) {
    // Restore the declared initial configuration. Seed controls future choices.
  },
  async invoke({ method, arguments: args }, { signal }) {
    return { status: 'accepted', outputs: { picked: [1] } };
  },
});
```

`invoke` returns `accepted`, `refused`, or `timeout`. Accepted/refused responses
must name every declared output with a correctly typed token list. A refusal has
empty outputs. Outputs are events produced by this call, not accumulated markings.
An accepted call returning an application error remains an accepted response.

The current reference contract is synchronous, with no internal transitions.
At a given reference marking, refusal is the observable response when there is no
enabled method rule. It preserves that reference marking. This is an explicit
protocol assumption, not a conclusion inferred from a timeout or silence.

Initial configuration, method signatures, data abstraction, and output mapping must
agree between adapter and specification. The fixture services use fresh instances
and private closure state; the harness never receives their private variables.
Adapters receive only calls, seeds, and cancellation, never oracle outcomes.

The adapter API supports asynchronous operations, but the SUT semantics in this
increment are synchronous call/response. Arbitrary asynchronous background events
and uncontrolled external systems require additional modelling. There is no URL
connector or user-code execution field in the GUI; new SUTs need a coded adapter.

## Compatible reference states

Let B be the set of reference markings compatible with the execution observed so
far; initially B contains the reference initial marking. For the next method call:

1. Enumerate all firings/bindings from every marking in B using the existing
   `enumerateMethodSuccessors` implementation.
2. Project accepted firings onto the public output events. Add a refused response
   for each marking with no enabled firing, retaining that marking.
3. Invoke the SUT and observe its response.
4. Retain every successor whose status and output multisets match that response.
5. Deduplicate only by the full reference marking, including private places and
   multiplicities. Never identify states by their visible observations alone.

An empty successor set after complete exploration is an observable mismatch. The
runner distinguishes unexpected refusal, unexpected acceptance, and unexpected
output. It is checking finite response-history compatibility, not claiming ioco,
bisimulation, or full branching conformance.

Incomplete reference exploration stops the experiment as inconclusive. No states
are silently dropped to fit a budget. Malformed interfaces/responses and execution
exceptions are errors, not detected implementation mutations. Adapter timeouts
are inconclusive, never implicit refusals.

Default budgets: 512 compatible states, 10,000 binding visits per successor search,
100,000 total binding visits per execution, 10 seconds per execution, 2 seconds
per adapter operation, 64 experimental paths per test, and 2,048 runs per campaign.
Cancellation is propagated. A remote adapter must honour its signal; a same-thread
CPU-bound adapter cannot be preempted by a JavaScript timeout. Timed-out instances
are not reused by subsequent runs.

## HML experiment paths and conservative evidence

Each distinct root-to-leaf call path in a ground formula becomes a separate
experiment. Boolean groups and observation predicates do not become assertions
that every sampled execution must follow. Identical call paths are deduplicated.
This is an experiment-selection heuristic, not an equivalence-preserving
translation from arbitrary HML into traces. Calls are fixed within a path; adaptive
response-dependent strategies remain future work.

`traceEvidence` evaluates each recorded execution separately using true/false/
unknown evidence. It can establish an existential modality when an observed
matching accepted edge has a witnessed continuation, and refute a universal
modality when such an edge has a refuted continuation. Boolean operators compose
this evidence within that execution. Unobserved alternatives, nonmatching labels,
and unavailable marking predicates remain unknown.

An explicit sampled refusal is not used to establish that no accepted successor
exists in the SUT's transition system. For example, `[take] false` remains unknown
after one refused invocation. Reference compatibility and HML evidence deliberately
have different conclusions here.

Per-run property evidence is `witnessed`, `counterexample`, or `inconclusive`,
respecting the saved expected truth. Evidence is never pooled across runs to
invent a shared hidden state. Counts report runs, not distinct formulas. A
compatible execution is not labelled a universally passing property.

These are implementation rules with regression checks, not yet a mechanised or
published soundness proof. Their intended justification assumes faithful call
labels/observations and the declared initial configuration. State-predicate
observability, richer evidence composition, and a formal capability-based theorem
remain research tasks from the planning note.

## Procedural SUTs and independence

`DemoSystems.js` imports no APN simulator, selection solver, generated tests, or
reference models. Its bag, choice, and worker services are ordinary procedural
implementations of the existing example contracts. Faults alter these programs,
not the APNs. Their private state is accessible only through calls and responses.

These small fixtures were implemented with knowledge of the reference contracts.
They demonstrate architectural separation, not blind independent development or
industrial realism. Larger independent SUTs built from requirements, and remote
process adapters, remain later increments.

## Reproducible campaign results

Run from `petri-net-app`:

```sh
node tools/node/run-satel-black-box.js /tmp/satel-black-box-results.json
```

The command generates and admits suites using the existing reference models,
runs 16 repetitions per distinct call path, and writes full step evidence when an
output filename is supplied. The [recorded summary and representative failures](experiments/black-box-2026-10-19.json)
retain every run's seed, path, calls, outcome, and property evidence.

| Intention / service | Runs | Compatible | Mismatches | HML counterexamples |
| --- | ---: | ---: | ---: | ---: |
| Bag orders / bag | 16 | 16 | 0 | 0 |
| Bag orders / missing duplicate | 16 | 0 | 16 | 0 |
| Bag orders / wrong output | 16 | 0 | 16 | 0 |
| No third value / bag | 16 | 16 | 0 | 0 |
| No third value / wrong output | 16 | 0 | 16 | 16 |
| Shared choices / choice service | 32 | 32 | 0 | 0 |
| Shared choices / early commitment | 32 | 25 | 7 | 0 |
| Joint selection / workers | 32 | 32 | 0 | 0 |
| Joint selection / failed worker | 32 | 23 | 9 | 0 |
| Joint selection / wrong receipt | 32 | 16 | 16 | 0 |

Total: 240 executions, 160 compatible and 80 mismatches, with no execution errors
or incomplete executions in this run. HML evidence remains inconclusive for 224
runs, with 16 decisive counterexamples. For workers, half the experiments are the
short `open` prefix, which cannot exercise a completion fault.

The seed schedule is deterministic and shared across paths for reproducibility.
These are descriptive regression counts, not independent samples from a known
operational distribution. No confidence interval, scheduler coverage, or universal
conformance claim is made.

## Verification and remaining work

The SATEL regression suite passed: 39 suites / 406 tests, including 28 new core and
GUI tests. Checks include retained ambiguity, shared variables, multiplicity,
typed structured outputs, expected-false evidence, hidden markings, refusal versus
timeout, adapter errors, cancellation, budgets, reproducibility, and the existing
symbolic HML-selection pipeline. Production build passed with existing bundle-size
and mixed-import warnings.

Four Playwright checks passed across desktop Chromium and Pixel 5 Chromium
emulation. They cover generation, saved-reference retention across model loads,
campaign replay, readable pairs, mismatch explanations, evidence download, and
the unresolved shared-state property. Desktop/mobile screenshots were visually
inspected. The first mobile attempt reached the screenshot step but exceeded the
30-second test budget; the longer multi-stage test passed with a 90-second budget.
Safari and deployment were not tested. After the final response-projection and
provenance-display adjustments, the 28 focused tests and production build passed
again; the complete 406-test run preceded those small adjustments.

The intention preview also now displays **must hold / must not hold**, including
additional requirements. This fixes the previously identified missing-polarity
display; it does not change or unify the underlying SATEL/HML syntax.

Next reviewable work: formalise the evidence contract against the thesis fragment;
then add a process/HTTP adapter and a larger requirements-driven SUT. Adaptive
strategies, snapshot/restore, background events, statistical guarantees, and full
HML testability characterisation remain separate increments.
