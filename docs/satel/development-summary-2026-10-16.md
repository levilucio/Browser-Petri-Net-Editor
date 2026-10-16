# SATEL operational prototype: development and decision record

**Date:** 16 October 2026 (Europe/Berlin)

**Project:** `levilucio/Browser-Petri-Net-Editor`

**Implementation branch:** `codex/satel-public-methods`

**Implementation snapshot:** `7be09f9305ab5e172d2edb0baec99a467c0ccbc1`

**Purpose:** consolidate the development conversation, implemented increments,
semantic decisions, experimental evidence and open questions for future work and
preparation of a scientific paper. This is a retrospective record, not a claim
that the full thesis has been implemented or that the implementation is verified.

The work began from the repository's SATEL branch. The later public-method,
symbolic-selection and GUI increments were published on the branch above, in the
existing stacked draft PR #4. Publication to that branch does not imply a merge
into SATEL or the default branch.

## 1. Objective and agreed scope

Levi Lúcio asked for a review of the existing prototype as a partial implementation
of his PhD work on selecting tests from algebraic Petri nets. The subsequent work
prioritized semantically meaningful generated tests: an admitted positive test
must actually execute from the specification's initial marking and satisfy its
expected observations. Mutated APN specifications provide executable fault
experiments against the same frozen tests.

The agreed development style was a series of reviewable bundles of functionality,
with examples and GUI support at each useful boundary. Full CO-OPN implementation
was explicitly judged unnecessary for this prototype. The focus became typed,
parameterized public methods and finite sequences of stimulation/observation
pairs. HML presentation was dropped at the user's request; this was a scope
choice, not an implementation of the full logic behind the scenes.

A second central requirement was to retain algebraic data definitions and derive
subuniformity domains from constructors and defining operation equations. The
user rejected an approach requiring construction of the potentially infinite
semantic state spaces in the thesis. The implementation therefore separates a
bounded operational selection technique from the thesis's semantic definitions.

## 2. Development chronology

Earlier increment documents describe the implementation at their own snapshots.
Their obsolete statements are not the current contract. In particular, injection,
output draining, test-controlled initial markings, Nat-only public calls and
purely static witness selection have all been superseded in the main symbolic
public-method workflow.

| Commit | Work completed | Main decision or consequence |
|---|---|---|
| `28081f6` | Initial symbolic account example, operation unfolding, reference admission and mutation replay | Establish an executable oracle check before expanding scope |
| `277a360` | GUI integration, independently loadable account mutants, removal of V1 intentions and dependent code | One supported editor direction; do not present fabricated/demo results as execution evidence |
| `0e60622` | Instantiated stimulation/observation pair display | Tests must be readable as concrete pairs, rather than just transition traces or JSON |
| `d2a503e` | Continuous initial-marking execution; removal of GUI version labels | Later pairs cannot repair their preconditions by injecting tokens |
| `cd96027` | Synchronous parameterized public methods | Calls carry parameters; the APN marking supplies state and resources; no full CO-OPN composition |
| `3f199eb` | Place-based observation editor and exact marking checks | Expose readable multisets and distinguish production from post-marking assertions |
| `0a2af0a` | Editable symbolic intentions, generic equation unfolding, existing Z3 connection reused | Replace the account-specific GUI selector with saved source definitions, goals and protocols |
| `7357a2a` | Built-in symbolic ADTs and compound/shared-variable guards | Solve joint conditions; do not partition independent occurrences of the same variable separately |
| `e6450e3` | Bool/String/Pair/List public-method execution and observations; Z3 lifecycle corrections | Rich symbolic witnesses can traverse the concrete simulator and oracle path |
| `448a50d` | Intention-centred workspace and editable thesis-style sequences | Main workflow becomes Intentions → Generated tests → Replay results |
| `b017503` | Symbolic marking propagation and whole-sequence parameter selection | A later pair can constrain an earlier parameter; concrete replay still gates admission |
| `7be09f9` | Larger fulfilment APN, four ten-pair tests and six independent mutants | Exercise longer state dependencies, resource multiplicity and late fault detection |

The initial account CLI and older ordinary-intention APIs remain distinct paths.
The chronology does not imply that every historical API now implements the new
symbolic execution contract.

## 3. Current semantic contract

### 3.1 Specification, initial state and method parameters

For this workflow, the tested model includes its initial marking. Changing that
marking changes the tested system configuration. Each test starts afresh from the
model snapshot; within a test, markings evolve continuously across all pairs.

The reference and the target each use **their own** initial marking. A generated
test's recorded reference marking is evidence for display, not an instruction to
overwrite the target's state. This makes initial-state mutations detectable.
The editor's current marking is used for a new generation run, so reload a supplied
reference after manual simulation if its original initial state is intended.

A stimulation is a public method call with typed parameters, for example
`withdraw(n=3)`. One or more transition rules can implement that signature.
Arguments exist for the duration of the synchronous call. They are not queued,
injected into request places, or automatically converted into state tokens.

Input-arc inscriptions bind variables to existing tokens. Those variables combine
with method parameters in the guard and output expressions. If an input variable
has the same name as a parameter, its token must equal the supplied value. Arc
multiplicity is separate from the parameter value: supplying `n=3` does not mean
consuming three tokens merely because an arc mentions `n`.

Public method rules cannot autonomously fire through the ordinary Step/Run/direct
transition paths. Interactive simulation can still have internal rules, but the
current method test oracle rejects models containing them. It does not insert
unobserved internal firings between stimuli. This is a small synchronous method
semantics inspired by the CO-OPN interface discussion, not a reproduction of its
context composition, gates/ports or multi-object synchronization semantics.

### 3.2 Observations and marking assertions

A public observation in a symbolic protocol is the multiset of tokens **produced
by that call** at public output places. Observing them does not consume them.
Tokens already present there remain in the marking and do not automatically
become outputs of subsequent calls.

The displayed sequence follows the thesis-inspired form:

```text
⟨ deposit(10) with ack(1) ⟩
⟨ withdraw(3) with ack(1) // paidAmount(3) ⟩
⟨ query() with balanceResult(7) ⟩
```

`//` joins outputs produced together. Multiple equal tokens retain multiplicity.
Token order within a place is irrelevant; element order within a List token is
significant. For example, `saved ↦ ⟦[]⟧` is one empty-list token, whereas
`saved ↦ ∅` is no token.

There are two retained assertion contracts:

| Intention path | Output-place assertion | Post-marking assertion |
|---|---|---|
| Symbolic protocol | Every public output is checked; an omitted output must produce no tokens | Whole markings are recorded as execution evidence; symbolic post-marking assertion syntax is not implemented |
| Ordinary pair intention | Selected output places are checked; unselected places are unconstrained | Separate checks such as exact multiset, cardinality, emptiness and containment are available |

Therefore a list of places and expected token multisets is a useful display, but
must identify whether it describes new production or the full marking. The two
meanings must not be silently conflated. Full marking checks also cannot replace
all future behavioural assertions, such as forbidding a particular event.

### 3.3 Admission, replay and verdicts

Expected observations are declared through the intention/protocol and algebraic
results before concrete reference replay. The implementation does not accept
whatever output the reference happens to emit as a replacement expectation.

Generated candidates must pass concrete reference execution before suite admission.
The admitted stimuli, expectations, provenance and reference snapshot are frozen.
Loading a mutant preserves that suite; replay does not regenerate its oracle.

| Situation during public-method replay | Result |
|---|---|
| Required calls execute and all output multisets match | Pass |
| A required call is blocked or an observation differs | Fail |
| Model/argument/evaluation error, unsupported nondeterminism or unresolved binding search | Error, not a successful test and not evidence that a mutant was killed |

The user initially asked whether generation precedes oracle classification. That
remains true for concrete admission, but the current positive selection process
is now also model-dependent: it uses APN guards, token availability and marking
propagation to find feasible candidates. It would be inaccurate to say that all
current witness selection is independent of the APN oracle model.

## 4. Algebraic subuniformity: what is calculated

### 4.1 Why retain ADTs alongside Z3

The agreed direction was a hybrid. Constructors and defining equations supply
structure, meaningful cases and derivation provenance. Z3 supplies feasibility
checks and witnesses for the supported residual constraints. Replacing everything
with solver-native values would not itself supply the intended test-domain
partition, nor prove a subuniformity hypothesis.

A selected operation or Boolean goal is unfolded using typed constructor-pattern
matching, fresh variables, substitutions and conditional equations. Operation
calls may occur in arguments, conditions and results. Recursion is bounded by an
explicit unfolding budget. Branches retain patterns, residual conditions,
equation paths, result patterns and witnesses.

Two extensionally equivalent definitions can induce different operational
partitions. In the account example, splitting affordability into `n < balance`,
`n = balance` and `n > balance` yields a distinct boundary class. Defining it using
only `n <= balance` and `n > balance` produces a coarser domain. This syntactic
sensitivity is intentional in the experiment and is relevant to the paper.

The domains are candidates for a subuniformity hypothesis. Calling them
“equivalence classes” does **not** establish that the engine computes the semantic
equivalence relation defined in the thesis, or that all implementations fail
uniformly throughout a domain.

### 4.2 Operation definitions and method guards

These are not two mandatory, unrelated partitioning systems:

* A saved symbolic goal identifies the expression whose cases are to be explored.
  Constructor patterns and operation equations unfold that expression.
* A Boolean guard may itself be the selected goal; its true/false regions are
  derived using the same term/constraint machinery.
* Actual method-rule guards additionally constrain executable paths during
  whole-sequence selection, together with available tokens and intention conditions.

Copying a transition guard into an intention is an explicit snapshot. It is not a
live link to later model edits. Importing custom editor ADT XML likewise copies
supported declarations and oriented equations into the saved intention.

For a condition such as `x > 0 and (x < 5 or x == 10)`, every occurrence of `x`
shares one symbolic binding. Boolean alternatives are normalized into disjoint
cases where supported; for example, `A or B` can be split into `A` and
`not A and B`. Z3 checks the joint constraints. Independently choosing a value for
each occurrence would be incorrect.

A false guard result is not automatically a negative test: a call that correctly
emits a refusal observation is a positive conformance test.

### 4.3 Supported data and operations

| Sort/family | Current supported scope |
|---|---|
| Nat / Int | Arithmetic `+`, `-`, `*`, comparisons and equality; symbolic integers with Nat nonnegativity; checked 32-bit runtime values |
| Bool | `and`, `or`, `not`, `xor`, `implies`, `iff`, equality and compound conditions |
| String | Length, concatenation, substring, substring inclusion and equality; UTF-16 code-unit semantics aligned with concrete execution |
| Pair | Construction, `fst`, `snd`, structural equality and nested values |
| List | Free list constructors, length, concatenation, head, tail, append, sublist, contiguous inclusion and structural equality |
| Any | Tagged representation for heterogeneous container elements and checked projections |
| Custom ADTs | Monomorphic free constructors and supported oriented conditional equations, including bounded recursive/mutually recursive symbolic derivation |

“Complete basic types” in the implementation history means coverage of the
operation signatures in the prototype's default registry. It does not mean a
complete decision procedure for all formulas over those types. Division is not
part of that symbolic library. `head([])` and incorrect Any projections are
undefined/error cases, not invented values. List `sublist` and String `substring`
retain their explicitly documented JavaScript-compatible indexing conventions.

The method runtime supports Nat, Int, Bool, String, Pair and List, including nested
built-in values. Custom constructor sorts can organize symbolic selection and be
mapped into those method values; arbitrary custom ADT method parameters and
user-defined operation execution are not implemented.

### 4.4 Solver contract and finite selection

The implementation reuses the repository's existing Z3 context. Equations are
unfolded by the selection engine, rather than asserted as unrestricted universal
axioms. Free constructors use solver datatypes; supported residual arithmetic,
Boolean, structural and String constraints are solved explicitly. The generic
connection avoids permissive fallback witnesses from older convenience APIs.

`unsat` identifies an infeasible constraint branch. `unknown`, timeout, unsupported
residuals, undefined operations and unresolved frontiers remain distinguishable.
Decoded models are checked for sorts and residual constraints. Completed class
intersections are checked with fresh variable renaming. Overlaps or unresolved
class-disjointness checks prevent admission. A resolved frontier and disjoint
completed classes do not establish exhaustive coverage, totality or confluence.

Variables without a finite explicit domain are not handled by enumerating an
infinite exhaustive set. In symbolic intentions they participate in the joint
constraint problem. Ordinary intentions instead use explicit finite values,
explicit uniformity representatives or retained legacy selectors. The current
ordinary UI defaults to finite domains; it does not silently infer uniformity.

## 5. Whole-sequence selection from APN markings

The user identified a limitation in static representative selection: a perfectly
reasonable representative of an algebraic class may not match the tokens or
states that the APN can actually reach. The latest selection increment addresses
this for the supported positive public-method fragment.

For each completed algebraic class and matching protocol case, the executor:

1. Starts with the model's actual initial token multisets.
2. Enumerates candidate method rules and distinct available input occurrences.
3. Adds equalities for repeated input variables and their overlap with parameters.
4. Instantiates guards and output terms symbolically, removes consumed occurrences,
   and carries the resulting marking into the next pair.
5. Conjoins class conditions, intention conditions, parameter/range constraints,
   all guards and all required output-multiset observations for the full sequence.
6. Retains an existing class witness only if the complete path admits it; otherwise
   releases that preference and solves jointly for replacement values.
7. Selects one feasible representative per completed class, then submits the
   instantiated test to concrete reference admission.

One schematic characterization is:

```text
For a class C and a candidate rule/token path π, find θ such that

  C(θ) ∧ IntentionConditions(θ) ∧ PathConstraints(π, M₀, θ)
       ∧ RequiredObservations(π, θ)

is satisfiable.
```

This describes the implementation strategy; it is not a theorem connecting the
algorithm to the full thesis semantics. The search is existential and may stop
once a witness is found for a class. It does not promise one test per feasible
internal path or complete transition/binding coverage. Unexplored alternatives
inside a class do not invalidate an already established positive witness; an
unresolved class with no established witness remains unresolved.

Method-local and intention-variable names use distinct substitution scopes.
Concrete execution and symbolic execution share typed rule compilation, while
concrete replay independently executes the selected calls. “Independent replay”
therefore means a separate execution check, not an independently implemented
semantics: shared code and shared modelling errors remain a threat to validity.

A blocked class currently prevents admission of a partial suite. Here “blocked”
can mean that no complete sequence satisfies the required observations, not just
that its first call is disabled. The interface exposes blocked and unresolved
classes instead of silently removing them. Distinguishing legitimate unreachable
classes from specification/intention defects is a future policy question.

### Demonstration: an earlier amount forced by a later observation

The whole-sequence account example starts with balance 10. Its positive-amount
class calls `withdraw(n)`, then `withdraw(7)`, then queries a required zero balance.
Static witness `n=1` fails the sequence. Joint selection obtains `n=3`. The zero
class separately calls `withdraw(0)`, `withdraw(10)`, `query()`.

Both tests pass the reference and fail on its no-debit mutant. This demonstrates
backward constraint influence through a forward-propagated marking without
constructing an infinite state space.

## 6. Nondeterminism: explicitly limited at this snapshot

This was the last semantic clarification in the conversation before this record.

Symbolic generation explores alternative rules and token bindings. Concrete
public-method execution enumerates enabled choices only for the method named by
the stimulation. It preserves token multiplicity and rejects reuse of an
occurrence across input arcs in the same firing.

Choices are deduplicated using the rule ID, complete variable binding and resulting
place multisets. Swapping two identical token occurrences can therefore collapse
into one choice. Different bindings remain distinct even if their public outputs
match. Different rule IDs remain distinct even if their observable effects match.
This is stricter than observational equivalence.

| Enabled choices after this deduplication | Current treatment |
|---|---|
| Zero | Blocked required call |
| One | Execute and compare observations |
| More than one | Unsupported-nondeterminism error |

Other public methods may be enabled simultaneously: the test's call determines
which method is considered. No scheduler chooses unrelated methods. Generated
transition IDs and token occurrences are diagnostics, not hidden instructions
that force replay down the successful symbolic path.

Consequently, generation can find an existentially feasible path that concrete
admission then rejects as nondeterministic. Admission does not currently search
for another parameter valuation after such a runtime error. The larger fulfilment
example intentionally remains within the deterministic public-call fragment;
its interchangeable crate occurrences do not constitute support for general
nondeterministic APNs.

A future extension must distinguish specification satisfaction (including possible
traces) from how an implementation run is judged when alternative observations
are permitted. Possible future work includes sets of compatible successor
markings, observation branching, and a precise may/must or conformance policy.
No such policy was implemented or agreed as the final choice in this chat.

## 7. Negative tests: researched direction, implementation deferred

The user explicitly wants the architecture to remain open for negative tests but
asked to prioritize generation of valid positive sequences first.

The thesis's Definition 8.3.4 (printed pp. 163–164) distinguishes exhaustive
positive and negative substitution/test sets according to satisfaction and
non-satisfaction. Definitions 8.4.7–8.4.8 (around pp. 171–172) address reductions
with annotations. Those semantic constructions must not be represented as an
implemented finite enumeration algorithm.

Section 9.4.2 (printed p. 199), together with `robustNotify` in Figures 9.18–9.19,
provides a particularly relevant operational direction: retain a controlled
positive prefix and express a forbidden final event using negation. The thesis
describes this as handling negative cases in a positive fashion. A positive
formula containing a negated final event and a negatively classified test case
are related but not identical notions.

The proposed later increment is a required prefix followed by a forbidden final
stimulation/observation pair. Important distinctions recorded in the discussion:

* An expected refusal output is still a positive test.
* Forbidding one particular observation does not necessarily forbid the method
  call or all its alternative observations.
* Proving absence of a final event requires considering all relevant rule/binding
  alternatives; failing to find one witness within a bound is insufficient.
* A failed prefix, solver unknown, unsupported feature or execution error must not
  count as successful negative evidence.
* A finite negative-selection strategy needs explicit scope, bounds and criteria;
  generating the complement of all positive instances is not the plan.

The new path planner records `required` assertion kinds and leaves room for a
separate final-forbidden planner. It does not yet implement it. Older ordinary
checker logic can invert an overall failed sequence for `testType: negative`;
that legacy behavior is not the intended future semantics and must not be cited
as completion of the negative-test work.

Mutant APNs currently evaluate the fault-detection ability of positive tests.
Mutation testing is not itself implementation of negative test generation.

## 8. GUI, authoring and persistence decisions

The user found the earlier intention editor and oracle tab too option-heavy.
The resulting main workflow is now:

```text
Intentions → Generated tests → Replay results
```

Typed variables, conditions, the selection hypothesis and pair sequences come
first. Source equations, operation/guard goals, budgets, protocol case bindings
and model tools are secondary details. Equation-based sequences can be edited
using `{ stimulation with observation }` notation. Ordinary intentions retain
structured fields with a live notation preview; that preview is not a parser for
the full thesis language. Invalid drafts remain visible and prevent saving.

Model-owned intentions now accompany examples and survive PNML save/load; this
resolved the earlier mismatch where account tests were available but the Intentions
tab appeared empty. The initial hidden equation-regime selector evolved into
explicit saved refined/coarse intentions with editable definitions.

Observations and expected/actual replay values use place/token notation rather
than raw JSON. Generated cards show substitutions, initial markings, ordered
pairs and optional execution details. HML wrappers and user-facing V1/V2 labels
were removed. V1 editor/generator/executor code and dependent fixtures were
removed; internal V2-named compatibility identifiers still exist.

A suite remains available across panel closure and model/example loading in the
session. Reference snapshots and stale-state notices distinguish old results from
current edits. JSON evidence download remains useful diagnostically; durable
suite import/replay across page reloads is not a completed workflow. PNML stores
models and intentions, not a claim that all session execution state persists.

## 9. Examples and empirical evidence

### 9.1 Account: equation refinement matters

The Request constructors `All` and `Amount(Nat)` map to public withdrawal calls.
The refined affordability equations produce All, less-than, equality and
greater-than classes. The coarse equations combine less-than and equality.

The refined four-test suite detects the supplied no-debit, refusal-resets-balance,
exact-balance-refusal and wrong-initial-balance mutants. The coarse three-test suite
can miss the exact-balance fault with its selected representative. This is a
controlled example of the practical consequence of the chosen partition, not
proof that finer partitions are always better or that mutation adequacy is complete.

### 9.2 Recursive list and built-in examples

The custom list membership intention demonstrates completed symbolic cases plus
an explicit recursive frontier. At unfolding budget 2 it has four completed
classes and one residual branch; at budget 3 it has six completed classes and a
residual branch. It is an algebraic derivation example, not an executable APN
protocol. Built-in type examples similarly distinguish class analysis from
admitted tests and expose undefined cases such as empty-list head.

### 9.3 Compound guard and typed store

The shared-variable compound guard `x > 0 and (x < 5 or x == 10)` yields four
regions. A missing-disjunct mutant is detected by the class containing ten.

The typed store carries Bool, String, List and Pair arguments through `store(...)`
and `read()`. Five selected classes pass the reference; a mutant that drops the
first stored list item fails one test at the later read. This demonstrates why
checking an immediate echoed argument alone is insufficient.

### 9.4 Larger fulfilment APN

The latest example has 34 places, 17 rules, 127 unit arcs and ten public methods.
Four tests each contain:

```text
open → add → reserve → pay → pack → ship → deliver → returnItems → close → audit
```

Initial stock is 12 and initial wallet 100. Reservation removes stock; payment
moves funds to escrow; shipping collects a fee; delivery returns two packing
crates; a partial return replenishes stock and refunds escrow; close recognizes
remaining revenue and loyalty. The final audit observes the resulting state.

Constructors Standard/Express and small/bulk operation equations give four
classes. Conditions restrict `2 <= q <= 8` and `0 < r < q`. Required final stock 10
forces `12 - q + r = 10`, hence `q - r = 2`.

| Class | Current buy / return witness | Fee | Final wallet / revenue |
|---|---|---:|---|
| Standard small | 3 / 1 | 2 | 78 / 22 |
| Standard bulk | 4 / 2 | 0 | 80 / 20 |
| Express small | 3 / 1 | 5 | 75 / 25 |
| Express bulk | 4 / 2 | 3 | 77 / 23 |

Bulk witness values are solver choices; other joint solutions could also be
valid. All four tests end with stock 10, loyalty 2, one shipment and one return.

| Independent APN mutant | Passed / failed / errors | First reported failure |
|---|---|---|
| Stock not reserved | 0 / 4 / 0 | Pair 10, stock audit |
| Payment not debited | 0 / 4 / 0 | Pair 10, wallet audit |
| Wrong express-bulk fee | 3 / 1 / 0 | Pair 6, shipping observation |
| Refund not credited | 0 / 4 / 0 | Pair 10, wallet audit |
| Only one packing crate initially | 0 / 4 / 0 | Pair 5, blocked call |
| Loyalty ignores returns | 0 / 4 / 0 | Pair 10, loyalty audit |

Every mutant preserves the method interface and saved intention. The reference
suite is generated once and replayed unchanged. Most faults preserve immediate
acknowledgements and are exposed only by later observations. Automated checks also
verify intermediate money, stock and crate conservation in the reference.

This is a purpose-built single-order example. Its refusal rules exist, but the
selected successful-lifecycle intention does not cover them. It does not establish
concurrency, arbitrary sequence-length scalability or industrial applicability.

### 9.5 Validation provenance and caveats

| Snapshot | Recorded checks | Qualification |
|---|---|---|
| Workspace redesign `448a50d` | 208 SATEL/PNML tests pass; 22 desktop/mobile browser checks; build passes | Two known manufacturing failures remain |
| Whole-sequence selection `b017503` | 218 SATEL/PNML tests pass; 24 desktop/mobile browser checks; build passes | Same two manufacturing failures; not an all-repository green claim |
| Fulfilment `7be09f9` | 12 targeted tests pass; desktop and mobile each generate the suite and replay all six mutants; build passes | Targeted tests include all seven PNML roundtrips; full prior suite was not rerun for this example-only increment |

These test counts are overlapping snapshots, not additive evidence totals.
Historical increment documents record earlier validation runs with different
scopes and baseline failure counts. The current known manufacturing failures are
fixture intention-count and positive-result expectations in
`manufacturing-v2.test.js`; they were not silently reclassified as successes.

A rich-type increment also fixed Z3/WASM handle-lifetime crashes under asynchronous
solving and JavaScript garbage collection. Context protection plus explicit model
and assertion-vector ownership were needed. A forced-GC child-process regression
and repeated cold-start checks were added. This is relevant reproducibility
engineering, not evidence about the mathematical selection hypotheses.

## 10. Current bounds and explicit non-goals

| Boundary | Current status |
|---|---|
| Symbolic goal unfolding | Intention budget 1–32 equation applications per path; recursive frontiers remain explicit |
| Generic branch/solver limits | Default 256 attempted branches, roughly 20-second derivation scheduling budget, 3 seconds per SMT check |
| Sequence selection | At most 32 pairs, default 10,000 search nodes and 20-second selection budget; up to 32 unfolding steps per path solve |
| Concrete method binding | 10,000 visited partial assignments; exhaustion is an error |
| Runtime values | Checked 32-bit Nat/Int, including nested integers; finite validation depth for containers |
| Ordinary finite domains | 1–128 values per variable; 10,000-combination cap before conditions |
| Arcs | Unit multiplicity and variable input inscriptions; multiple arcs can require distinct occurrences |
| Runtime nondeterminism | Unsupported beyond collapsing interchangeable identical-token choices |
| Internal exploration | Not supported in the public-method test oracle |
| Full CO-OPN / HML | Deliberately not implemented |
| General algebra | No general quotient/AC constructors, polymorphism, quantified axioms or total decision procedure |

Time limits are checked around work/solver calls; they are scheduling limits, not
hard real-time guarantees. Symbolic mathematical integers and runtime bounded
integers are different domains. Concrete admission catches remaining representation
or arithmetic-intermediate errors; it does not turn them into negative tests.

## 11. Open points and proposed next research boundaries

The following are open work items, not commitments that they have been implemented:

1. **Nondeterministic specification and execution semantics.** Decide how
   existential pattern satisfaction relates to observed implementation choices,
   admissible observation sets and subsequent states. Add examples with genuinely
   different enabled bindings/rules before claiming support.
2. **Controlled negative tests.** Formalize required prefixes and forbidden final
   pairs, including the universal absence check, finite selection policy and
   handling of unknowns. Replace or clearly isolate legacy whole-sequence inversion.
3. **Correctness argument for the supported fragment.** State assumptions on
   equation definitions, typing, runtime representations, path constraints and
   deterministic replay. Prove or test specific preservation/admission properties;
   do not infer them from mutation scores alone.
4. **Coverage and subuniformity justification.** Establish what algebraic domains
   cover, how syntactic refinements relate to semantic distinctions, and which
   test-selection hypotheses are supplied rather than verified. Separate value,
   equation, path, rule and mutation coverage.
5. **Unreachable-class policy.** Currently any blocked class prevents admission.
   Consider explicit declared restrictions or reviewed partial-suite policies
   without allowing faulty references to silently erase inconvenient classes.
6. **Scalability.** Measure branching, shared-token bindings, sequence length,
   recursive unfolding and solver costs on a family of models. Explore earlier
   pruning, caching or symbolic-state sharing without changing semantics silently.
7. **Broader language/runtime support.** If useful, add richer input patterns,
   weighted multiplicity, custom ADT execution, symbolic post-marking assertions,
   or internal transitions as separate justified increments. Full CO-OPN remains
   outside the agreed immediate objective.
8. **Unify or retire legacy paths.** Ordinary intentions and the old CLI do not
   have all the new symbolic capabilities. Address the known manufacturing
   failures and avoid ambiguous compatibility claims.
9. **Reproducible evidence.** Durable suite import, saved solver/version/budget
   metadata and benchmark output would improve later experiments and publication.
10. **Broader evaluation.** Include additional fault models, surviving/equivalent
    mutants, refusal protocols and examples not designed alongside the generator.
    Compare selection strategies with controlled budgets and report errors
    separately from detected faults.

## 12. Framing for a future paper

A defensible working theme is **operationalizing a semantic test-intention
framework through a bounded algebraic and symbolic-execution fragment**.
The engineering contributions demonstrated here include:

* a precise public-method/APN mapping with continuous initial-state execution;
* constructor/equation-guided domains with explicit unresolved frontiers;
* joint selection over complete stimulation/observation sequences;
* separation of declared expectations, executable admission and frozen mutation
  replay; and
* reviewable examples showing boundary-sensitive selection and late state faults.

Possible research questions are whether joint sequence constraints recover useful
witnesses missed by static representatives, how equation refinements affect fault
detection, and what practical limits arise as token/path/term branching increases.

The present evidence supports feasibility and regression claims for the supplied
fragment and examples. It does **not** establish full semantic subuniformity,
full SATEL/CO-OPN correctness, bisimulation-based conformance, exhaustive test
coverage, a sound-and-complete general procedure, or broad industrial utility.
Failure to operationalize the full original definitions is not by itself a
mathematical refutation of the thesis. Infinite semantic domains alone are not a
proof that every useful operational fragment is impossible. Any negative result
in a paper needs a precisely stated proposition and supporting argument.

Threats to validity include co-designed examples and mutants, restricted initial
configurations and data conditions, shared symbolic/concrete compilation code,
solver-dependent representatives, unproved equation properties, bounded search,
and the lack of broad comparative performance measurements. AI-assisted
implementation and dialogue helped expose assumptions and construct experiments;
that process should be documented as methodology, not substituted for formal or
empirical evidence.

A possible paper structure is: semantic background and operational gap; supported
fragment and assumptions; decomposition and sequence-selection algorithm;
implementation/oracle contract; controlled experiments; limitations and future
negative/nondeterministic extensions. The personal experience of revisiting the
thesis can be treated separately from technical correctness claims.

## 13. Sources, literature status and implementation map

Primary thesis: Levi Pedro Silva Lúcio, *SATEL — A Test Intention Language for
Object-Oriented Specifications of Reactive Systems*, University of Geneva, 2009,
Thesis 3988. [Repository record and DOI](https://archive-ouverte.unige.ch/unige:2498).
Useful anchors include §7.1.1 (pair notation), Definitions 8.3.3–8.3.4
(satisfaction and positive/negative sets), Definitions 8.4.7–8.4.8 (annotated
reductions), and §9.4.2 / Figures 9.18–9.19 (controlled negative behaviour).
Page references above use printed thesis pagination, not PDF viewer indices.
Recheck exact formal notation against the PDF when writing the paper; extracted
text loses some mathematical symbols.

The implementation was inspired by the constructor/equation-unfolding direction
discussed in Cécile Péraire's *Formal Testing of Object-Oriented Software: From the
Method to the Tool* (EPFL thesis 1904, 1998,
[DOI](https://doi.org/10.5075/epfl-thesis-1904)) and Bruno Marre's LOFT work
([1995 paper DOI](https://doi.org/10.1007/3-540-59293-8_240)). The earlier increment
record notes consultation of Péraire's text and the LOFT paper. Marre's 1991 thesis
was identified ([catalogue](https://theses.fr/1991PA112052)), but its full text was
not obtained. This summary is not a new comprehensive literature review.

**The prototype is not an exact reproduction of a Marre/Péraire Prolog algorithm.**
It uses a JavaScript typed-term/narrowing implementation and Z3 constraint solving.
An algorithm-by-algorithm literature comparison and novelty assessment remain
necessary before claiming equivalence, completeness or a new research contribution.

| Concern | Repository entry point |
|---|---|
| Symbolic source, goals, protocol cases | [SymbolicSource.js](../../petri-net-app/src/satel/core/SymbolicSource.js) |
| Typed terms and substitutions | [SymbolicTerms.js](../../petri-net-app/src/satel/core/SymbolicTerms.js) |
| Built-in operation definitions | [BuiltinAlgebra.js](../../petri-net-app/src/satel/core/BuiltinAlgebra.js) |
| Equation-domain derivation | [GenericSubuniformity.js](../../petri-net-app/src/satel/core/GenericSubuniformity.js) |
| Residual solver | [SymbolicZ3.js](../../petri-net-app/src/satel/core/SymbolicZ3.js) |
| Whole-sequence selection | [ExecutableSequence.js](../../petri-net-app/src/satel/core/ExecutableSequence.js) |
| Generation/admission orchestration | [SymbolicIntention.js](../../petri-net-app/src/satel/core/SymbolicIntention.js) |
| Rule compilation and concrete choice | [PublicMethods.js](../../petri-net-app/src/features/simulation/PublicMethods.js) |
| Reference observation and frozen replay | [BoundedOracleAdapter.js](../../petri-net-app/src/satel/core/BoundedOracleAdapter.js), [ValidatedSubuniformity.js](../../petri-net-app/src/satel/core/ValidatedSubuniformity.js) |
| GUI generation/replay | [OracleValidationPanel.jsx](../../petri-net-app/src/components/OracleValidationPanel.jsx) (historical filename retained) |
| Pair presentation | [SatelTestDisplay.jsx](../../petri-net-app/src/components/SatelTestDisplay.jsx) |
| Larger reference/mutants | [fulfilment/editor.js](../../petri-net-app/src/satel/examples/fulfilment/editor.js) |
| Regression evidence | [SATEL tests](../../petri-net-app/src/__tests__/satel), [browser scenarios](../../petri-net-app/tests/e2e/satel/oracle-account.spec.js) |

Detailed review guides: [increment 1](increment-01-symbolic-oracle.md),
[increment 2](increment-02-gui-v2.md), [increment 3](increment-03-initial-marking.md),
[increment 4](increment-04-public-methods.md), [increment 5](increment-05-generic-symbolic-z3.md),
[increment 6](increment-06-builtins-compound-guards.md), [increment 7](increment-07-typed-methods.md),
[increment 8](increment-08-intention-workspace.md), [increment 9](increment-09-executable-sequences.md)
and [increment 10](increment-10-fulfilment-example.md). The older
[DESIGN.md](DESIGN.md) is historical and must not be used as the current contract.


## Subsequent increment

After this snapshot, [increment 11](increment-11-typed-exercise-collection.md)
added ten reference APNs and twenty mutants, sequences up to twenty pairs,
ground-term evaluation improvements, and reproducible performance measurements.
It records the evidence and limitations separately rather than changing the
historical results above.

[Increment 12](increment-12-unified-pipeline.md) subsequently unified the explicit
and symbolic test pipelines, made observation scope explicit, fixed stepwise
verdict precedence, separated static and executable witnesses, and refactored
compilation, search and GUI orchestration. Its own report records compatibility
limits and before/after performance evidence.
