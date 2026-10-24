# Increment 16 — Nondeterministic APN execution and HML properties

Date: 17 October 2026. Branch: `codex/satel-public-methods`.

## Outcome and interpretation

SATEL can now check finite branching properties against APN models. It explores
alternative input-token bindings and alternative rules implementing the same
public method. Properties have an HML-style syntax tree; the editor presents
nested requirements, calls and place expectations. Existing sequence intentions
remain supported through the same selection, admission and frozen-replay pipeline.

This is bounded property checking, not a bisimulation decision procedure. A
selected suite does not establish agreement on every HML formula. No weak or
branching bisimulation over autonomous internal transitions is implemented.

## Review on a laptop

Use the branch above, install dependencies if necessary, then run `npm run dev`
inside `petri-net-app`.

1. Open **Examples**, search for **Nondeterminism**, and load **SATEL
   Nondeterminism — Branching reference**.
2. Open **SATEL → Intentions**. Edit **One open outcome retains both choices**.
   The outer requirement is **Possible continuation** for `open()`. Its
   continuation is **All obligations hold here**, containing possibilities for
   `left()` and `right()`. These obligations start from the same successor state.
3. Expand **HML notation** to see the formula. Save the intention, open
   **Generated tests**, and generate. One test passes the reference oracle.
4. Load **Branching mutant: early choice**. In **Replay results**, replay the
   frozen suite. It fails, although both complete linear traces remain possible.
   Expand the property evidence to inspect both `open()` outcomes and the missing
   continuation in each.
5. Reload the reference and select **Not every open outcome retains both
   choices**. Its box formula is expected to be **false**. Generate, then load
   **Branching mutant: lost alternative** and replay. The formula becomes true,
   so this negative property test fails on the mutant.
6. Load **Multiset reference** and generate **Both token orders, multiplicity and
   final refusal**. The stock initially contains `⟦1, 1, 2⟧`. Both orders
   `1,1,2` and `2,1,1` must be possible, followed by a refused `take()`.
   Replay on **missing choice** and **missing duplicate** mutants: both fail.
7. Generate **No third value may be reported** on the multiset reference, then
   replay on **extra output**. The extra rule returning `99` makes it fail.

For a new property, use **Create branching property**. Parameters and value
selection are collapsed when there are no variables. Variables use the existing
finite/representative controls; `$name` refers to the same selected value
throughout the property. Place observations use the existing readable token-list
and marking controls. Properties survive PNML save/load.

## Property language

The persisted `formula` AST supports:

| Node | Meaning |
| --- | --- |
| `diamond` | At least one successor matching the call and observation predicate satisfies `child`. |
| `box` | Every matching successor satisfies `child`; zero matching successors satisfies the box. |
| `and`, `or` | Conjunction/disjunction of `children`, all evaluated at the same marking. |
| `not` | Negation of `child`. |
| `true`, `false` | Boolean constants. |
| `marking` | Optional explicit predicates over current place markings. |

A modal node names a concrete public method and its argument map. An omitted
`observation` matches any response. Listed output places constrain the tokens
**produced by that firing**, not the accumulated marking. Separate marking
predicates constrain the successor marking. `excludeObservation: true` matches
the complement of the supplied observation predicate. This permits tests
excluding unanticipated responses, not only tests requiring known responses.

The editor calls these observation filters **Any observation**, **Matching these
place expectations**, and **Not matching these place expectations**. A box checks
only the outcomes selected by its filter. It does not require such an outcome to
exist. Use an additional diamond when availability is required.

Tests store `expectedTruth`, defaulting to true. A false expectation is a negative
HML test, distinct from legacy whole-sequence verdict inversion. An evaluation
error never satisfies a false expectation. Refusal is `[call / *] false`.

Explicit marking assertions are an extension of action-only HML. Assertions
about internal places are intentionally stronger, white-box properties; they
must not be presented as black-box observational equivalence. The new branching
examples use public output observations to distinguish behavior.

## Execution and completeness

`enumerateMethodSuccessors` shares the compiled public-method plans with concrete
execution and symbolic sequence generation. For each method rule it:

1. Binds input variables to distinct token occurrences, including repeated input
   arcs and variables shared with method parameters.
2. Checks the guard with that binding.
3. Consumes exactly the selected occurrences and evaluates the output terms.
4. Returns the produced tokens and complete successor marking without mutating
   the source marking.

Repeated equal-valued token permutations are redundant. Multiplicity remains in
the marking and therefore still controls enabledness. Equal produced-token bags
and equal complete successor markings can be collapsed across rules; rule
identity is diagnostic evidence, not an observable action label. All produced
places are retained in this equality because explicit tests can inspect internal
places too. Distinct future markings are never merged merely because their
immediate public outputs match.

The evaluator uses three logical values: true, false and unresolved. Replay maps
these to pass/fail relative to the expected truth, or **inconclusive**. Invalid
models/tests and execution errors have a separate **error** verdict.

- A diamond is true once a successful continuation is established.
- A box is false once a counterexample is established.
- Establishing absence or universal satisfaction requires complete enumeration
  of the relevant successors and resolved continuation obligations.
- Negation preserves unresolved. Boolean combinations use decisive true/false
  results when available; otherwise unresolved propagates.
- An incomplete reference result prevents suite admission. Target inconclusive
  results are counted separately and are not mutant kills.

Default bounds are 10,000 recursive binding visits per call, 100,000 total visits
per property, 5,000 evaluated formula/state obligations and 10 seconds per
property. Formula input is limited to 1,000 nodes and 64 nested levels. APIs can
supply smaller budgets; the ordinary GUI uses the defaults. Cancellation is
checked during exploration, and formula evaluation periodically yields to the
browser. One synchronous successor enumeration can still delay UI cancellation
until that enumeration yields or completes.

Successor enumeration is cached by full marking and concrete call. Decided
formula obligations are cached by formula-node identity and full marking;
unresolved results are not reused as facts. Repeated evidence points to its
previous evaluation rather than duplicating an entire subtree. Each replay has
its own caches and snapshots; no result crosses models or invocations.

## Compatibility and selection limits

Existing deterministic sequences retain their stepwise execution evidence. If a
public call has multiple distinct successors, replay interprets the complete
sequence as nested diamonds, with a universal final refusal if present. This
means **one possible complete execution**, not that every possible execution
matches the sequence. The GUI states this distinction. Duplicate identical
successor edges no longer cause ambiguity errors. The interactive simulator's
single-firing API still requires a unique distinct successor; this increment
adds exploration to SATEL, not a manual rule-choice simulator UI.

Finite property intentions instantiate one shared variable assignment for the
whole tree, filter it by the intention conditions, then undergo reference
admission. The oracle never picks different values for different obligations.

Symbolic intentions can add **Additional branching requirements**. Selection
still uses the existing whole-sequence constraint solver, including ADT equation
classes and reachable markings. The additional property is instantiated from
that same selected goal-variable assignment and conjoined with the sequence
property, both evaluated from the initial marking. If it fails or is unresolved,
no suite is admitted. **There is not yet a solver that finds a different class
representative satisfying an arbitrary HML formula.** Only goal variables, not
protocol-case-local variables, are available to these added requirements.

Automatic refusal-companion selection skips property tests and branching
sequences: their complete behavior cannot be represented by the former single
marking history. Explicit HML refusals and expected-false properties are fully
supported. Automatic characteristic formulas, distinguishing-formula synthesis,
variable action names/paths, and autonomous internal synchronization remain open.

## Bug found through the new mutants

The lost-alternative mutant disables a rule with the literal guard `false`.
It exposed an existing truthiness bug: three code paths treated this compiled
Boolean constant as if no guard had been supplied. Concrete firing, symbolic
positive selection, and symbolic refusal construction now distinguish an absent
guard from a false guard. Regression tests cover all three. This is a previously
undetected implementation defect, not a newly discovered error in the original
reference APNs.

## Validation and performance

- The full SATEL suite passes: 36 Jest suites, 328 reported tests, including two
  pre-existing expected-failure tests. Two old assertions explicitly expecting
  nondeterminism to be rejected were updated to the new supported semantics.
- New tests cover token occurrence sharing/multiplicity, alternative rules,
  equal-observation/different-future states, both modal operators, vacuity,
  complemented observations, negation, false expectations, resource limits,
  cancellation, malformed inputs, shared parameter assignments, symbolic baseline
  integration, PNML round trips and UI editing.
- Four Playwright scenarios pass across desktop Chromium and Mobile Chrome:
  editor → reference admission → frozen mutant replay, including expected-false
  properties. Screenshots were inspected for readability.
- Production build succeeds. The existing large-bundle warning remains.
- The original ten exercise families and their twenty mutants remain covered by
  the existing regression tests. The new collection has two references, five
  properties and five detected mutants; no execution errors count as detections.

Run the new functional/performance smoke script from `petri-net-app`:

```sh
node tools/node/run-satel-nondeterminism.js
```

An optional output filename saves its JSON report. The recorded run is
[performance/nondeterminism-2026-10-17.json](performance/nondeterminism-2026-10-17.json).
Its depth-20 universal test starts with ten tokens of value 1 and ten of value 2.
There are 184,756 distinct value orders. Reusing identical formula/full-marking
obligations reduces checking to **121 evaluated obligations**, with **100 property
cache hits**, **341 binding visits**, and about **61 KB of serialized evidence**.
The single measured run took **15 ms**; this is a small functional smoke
measurement, not a statistically controlled benchmark or a claim about arbitrary
APNs. Nets with many genuinely different successor markings can still grow
exponentially and return inconclusive at the configured bounds.
