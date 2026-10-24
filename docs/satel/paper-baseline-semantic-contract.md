# Proposed paper baseline and semantic contract

Draft for author review, 24 October 2026. This is a proposal, not an approved
semantic correspondence theorem or an implementation change.

## 1. Freeze a reproducible implementation, not all future development

Use implementation **B0 = `f6a92c0e2a9364755393b9af5c1de70549354758`**
(`codex/satel-public-methods`, through increment 39). Its tree is
`dc093c314b2f641e4297ea1afc76a131c69c32c6`.
The accompanying [manifest](paper/baseline.json) records source hashes and the
lockfile hash. The proposed manuscript is [paper/main.tex](paper/main.tex).

B0 includes the worker GUI, the common selection/admission pipeline, concrete APN
HML replay, bounded refusal companions, and the black-box campaign runner. Keep
shared solver contexts/full preambles as the production default; query-owned
contexts/declaration projection remain opt-in. Freeze each experiment's explicit
options, seeds, models, intentions and admitted tests as well as its code version.
A code commit alone does not fix the experimental protocol.

Keep the separate evidence lineage:

| Item | Immutable source | Interpretation |
|---|---|---|
| Implementation B0 | `f6a92c0e2a9364755393b9af5c1de70549354758` | Proposed implementation baseline |
| Claim/evidence audit | `34b6078e5fea48ccb4a1271e8c96acf680684c50` on `docs/satel-black-box-scientific-foundation` | Research document, audit program and retained audit artifact |
| Implementation inspected by that audit | `1fa8b65e2ef8192affe81b79e49145bb18b826ea` | Increment 38; do not relabel the campaign as newly rerun on B0 |
| Historical black-box campaign | `docs/satel/experiments/black-box-2026-10-19.json` at B0 | Original campaign observations, not a new experiment |
| Increment 39 regression evidence | Its report and two browser artifacts at B0 | 750 unit/integration checks; 46 browser checks in each of two modes; reported evidence, not rerun for this document |

The semantic-core directories and builtin-value implementation inspected here have
no changes between increments 38 and 39. This supports reuse of the analysis, but
is not a fresh execution of the scientific campaign.

Do not move or rewrite B0. Future correctness repairs get a new baseline identifier,
a documented semantic diff and reruns of affected experiments. Continue general
optimization only to unblock a named experiment with fixed budgets or an observed
GUI problem. No tag or release is created by this proposal.

## 2. Proposed scope: a synchronous public-method fragment

The SUT is an initialized transition system, not a net without a marking. The
reference is an APN with fixed initial marking, public method signatures and an
explicit observation projection. The implementation is hidden behind reset/invoke.

- A concrete stimulation is a method name and a complete named map of ground,
  typed arguments. Parameters are supplied by the call, not injected as tokens.
- One accepted call fires one applicable method rule. Bindings use tokens actually
  present in input places, respect multiplicity and shared variables, and satisfy
  the guard. Every compatible rule/token choice is a semantic alternative.
- Each input/output arc has one binding and unit weight in this fragment. Several
  arcs can consume several tokens; one token occurrence cannot satisfy two arcs.
  Input bindings are variables, not arbitrary constructor patterns.
- A marking maps each place to a finite multiset of supported values. Equality
  preserves multiplicity, ignores token order and includes hidden places.
- Public methods/places support Nat, Int, Bool, String, List and Pair. Int is signed
  32-bit, Nat is its nonnegative part; arithmetic overflow is an error, not wrapping.
  Lists/pairs use the current nested builtin representation and validation limits.
  String operations currently follow the concrete JavaScript implementation;
  Unicode/SMT correspondence needs a separate audit, not an implicit mathematical
  string assumption.
- Custom ADT declarations/equations can be analysed by the symbolic subsystem. This
  does not make arbitrary custom ADTs executable public-method parameter sorts.
  Ground operation behavior is pinned by `MethodTerms.js`, including partial
  operations, short-circuiting and range checks. Undefined evaluation is not a
  disabled transition and must not become a refusal or mutant kill.
- No autonomous transitions, unmodelled background events, distributed method
  synchronization, transition scripts, weak/tau semantics, or full CO-OPN contexts
  are claimed. Current asynchronous JavaScript APIs do not enlarge this fragment.

## 3. Three semantic objects that must remain distinct

**Full state:** the complete reference marking. **Output event:** tokens produced
on declared public output places by this call. **Marking assertion:** a predicate
on the resulting state (or a standalone predicate at the current state).

Write an accepted edge as `m --(c,o)--> m'`, where `o` is the public projection of
this firing's production. Tokens already present at an output place are not
produced again. Observations in APN replay may constrain both `o` and `m'`. A
black-box invoke response supplies `o`, not `m'`; an output-place name does not
provide marking access.

An observation constrains exactly the places selected by its normalized scope,
using structural multiset equality or supported marking assertions. Omitted output
constraints are unconstrained unless normalization explicitly expands public scope.
The black-box response protocol, in contrast, requires one typed token list for
*every* declared output, including empty lists.

For history checking only, add `(c, refused, empty)` as a self-loop exactly where
no accepted `c` edge exists. The adapter must implement that refusal contract;
timeout is not refusal. HML modalities range over accepted edges, without these
refusal self-loops.

## 4. Intentions, computed regions and admission

A finite intention has data variables, constraints and a finite sequence/HML
property. A single ground substitution is shared throughout the formula, including
its branches. It is not freshly chosen at each step or branch. Method/observation
names and path variables are outside this selected fragment.

For a computed symbolic region C, selection seeks a valuation satisfying C, the
intention constraints, reachable input-token bindings, guards, defined operations
and the whole sequence/branching requirement from m0. Later obligations can
restrict earlier choices. ADT unfolding supplies cases and residual constraints;
Z3 supports constraint solving. Neither successful solving nor class disjointness
alone establishes reference admissibility or semantic subuniformity.

Every selected ground test passes concrete reference replay before admission.
Symbolic admission also rejects unresolved decomposition/execution, blocked classes
and overlap/unknown-disjointness reports. Class-only reports are not executable
admitted suites. The saved reference, interface, selected tests and expected
polarities are frozen; target replay must not regenerate expectations on the SUT.

Call the unfolding outputs **computed regions** until a relation to the thesis's
annotated substitutions is proved. Separate five obligations: region feasibility,
disjointness, coverage of a declared domain, correspondence to thesis annotations,
and the testing hypothesis licensing untested representatives. A witness proves
only its own feasibility/admissibility. Variables without selection hypotheses
require a declared finite restriction or remain outside a completeness claim.

A negative expected polarity `(phi, false)` is different from a refusal test
`([c] false, true)`. Both can be reference-correct. Bounded refusal companions are
not the exhaustive negative substitution set of the thesis.

## 5. Two black-box verdict channels

For history h, start with B0={m0}. Update B by taking all reference successors
matching the next call and the complete observed response (status plus output
multisets). Deduplicate by full marking. Complete exploration yielding an empty
set means **history mismatch**. A nonempty set means **this finite history is
compatible**. Neither statement determines all HML properties of the hidden SUT.

Separately evaluate evidence for a ground HML formula on one authentic execution.
Use ordinary two-valued HML truth; T/F/U are knowledge values, not a new property
semantics. A matching edge with a T continuation witnesses a diamond; a matching
edge with an F continuation refutes a box. Negation exchanges T/F, preserving U;
Boolean combinations use conservative evidence rules at the same actual state.
No edge, a nonmatching edge, a refusal or an unavailable marking does not prove
modal absence. The implementation may remain U even for tautologies.

| Evidence | Expected true | Expected false |
|---|---|---|
| T | witnessed | counterexample |
| F | counterexample | witnessed |
| U | inconclusive | inconclusive |

Do not identify states from different runs just because their observed prefixes
or seeds coincide. Reset and seeds need explicit contracts. In particular,
seed-specific initial states are not automatically one common state for modal
reasoning. No probability/confidence conclusion follows from deterministic seeds.

Preserve distinct unresolved causes: reference enumeration limit, symbolic
residual/SMT unknown, adapter timeout, missing sampled behavior, unavailable
state identity/marking, and incomplete evidence rules. Malformed models/adapters
are errors. A trustworthy decisive prefix may survive a resource cutoff; a broken
adapter/reference error suppresses property evidence in the current campaign.

## 6. Thesis anchors now located, with interpretation obligations

Primary source: Levi Pedro Silva Lúcio, *SATEL — A test intention language for
object-oriented specifications of reactive systems*, University of Geneva, 2009,
[official record](https://archive-ouverte.unige.ch/unige:2498), DOI
`10.13097/archive-ouverte/unige:2498`.
[Downloaded thesis](https://access.archive-ouverte.unige.ch/access/metadata/b010d34e-ad2c-4a39-8986-c0ace50e5f29/download).
Page numbers below are printed thesis pages; PDF page indices refer to the
257-page download retrieved on 24 October 2026, including its repository cover.
Download SHA-256: `a7efb3a7c0c772153cf0227693a85ee771c803293b8ffc4ab5d45eeb375d3a58`.
The repository cover may change between downloads; definition numbers are the
stable anchors. The thesis PDF is not copied into this code repository.

| Anchor | Printed / PDF page | Role and outstanding translation |
|---|---|---|
| Def. 5.4.10 | 101 / 120 | Context semantics; identify the flat synchronous fragment and label/state map |
| Defs. 6.2.3–6.2.4 | 116 / 135 | HML syntax/satisfaction; explicitly specify standard successor-state semantics |
| Defs. 6.2.5–6.2.6 | 117 / 136 | Formula plus truth polarity; oracle agreement rather than positive traces only |
| Def. 6.2.7, Thm. 6.2.8 | 118 / 137 | Exhaustive oracle/bisimulation setting; not a finite prototype guarantee |
| Def. 8.3.1 | 160–162 / 179–181 | Expanded patterns; restrict to finite data-variable intentions here |
| Defs. 8.3.3–8.3.4 | 162–164 / 181–183 | Pattern satisfaction and positive/negative substitutions; resolve printed-rule issues below |
| Defs. 8.4.1–8.4.2 | 165–167 / 184–186 | Annotations record behavioral/coordination formulas and object identity; equation branches alone are not these annotations |
| Def. 8.4.5 | 169–170 / 188–189 | Annotated pattern validation; review together with Def. 8.3.3 |
| Defs. 8.4.7–8.4.8 | 171–172 / 190–191 | Families of reduced substitution sets and choice of a test set; prove which family the algorithm implements, if any |

**Author review R1 — printed satisfaction rules.** Visual inspection of printed
p.163 confirms that Def. 8.3.3's diamond continuation is written at source q,
and its negative rules include existence of an edge with a failing continuation.
Standard nondeterministic HML evaluates at successor q' and refutes a diamond
only if *all* matching successors fail (including no successors). Under a literal
reading these rules require clarification; do not silently change a quantifier or
claim implementation equivalence. Proposed paper convention: standard HML,
explicitly documented; defer correspondence with this definition until an agreed
interpretation/erratum is recorded. Review the related annotated rules too.

**Author review R2 — reduction and coverage.** Def. 8.4.7 constrains sets of
substitutions, including equal values when annotations agree. The displayed subset
conditions alone do not state an executable coverage policy. The prose/examples
supply further intent. Decide whether the theorem targets membership in an allowed
reduction family, coverage of feasible annotation classes, or a stronger equality.
Do not infer this from the word “partition” or from our one-witness-per-region UI.

## 7. Initial theorem targets and review decisions

The first theorem target should be *per-selected-test preservation*, not equality
of entire exhaustive/reduced test sets. Define a state relation and a label/formula
translation for a small supported fragment. Require initial states related and
matching accepted successors in both directions, with observation predicates
preserved. Induction on finite HML would then establish truth preservation; the
actual relation/encoding and algebra assumptions still need proving. Do not use
one-way simulation to claim preservation of arbitrary negation/boxes.

Independently, target P1 (belief-set invariant and mismatch soundness) and P2
(soundness of definite per-run HML evidence). Their mathematical arguments can be
studied without claiming that the program or the full thesis has been verified.
Keep X2 independent finite-LTS testing and X3 controlled selection ablation as
subsequent experiments; neither was executed for this proposal.

Review decisions before promoting this draft to an agreed contract:

1. Accept B0 and the separate evidence provenance; fix per-experiment options.
2. Accept synchronous public calls and per-call output events as the paper fragment.
3. Resolve R1's interpretation and R2's reduction/coverage target with the author.
4. Choose the initial algebra subset for a correspondence theorem; leave uncertain
   Unicode, partial-operation and custom-ADT bridges outside that theorem.
5. Approve per-test preservation plus P1/P2 as initial proof goals; retain all
   completeness, representative adequacy and statistical claims as open.

No production code, solver defaults or experiment results are changed by this
proposal. The companion manuscript is a working draft with open obligations,
not a submission-ready paper or a declaration of novelty.
