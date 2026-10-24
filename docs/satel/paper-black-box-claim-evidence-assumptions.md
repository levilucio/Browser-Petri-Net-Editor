# SATEL black-box testing: claim–evidence–assumption matrix

Research foundation, 24 October 2026 (Europe/Berlin).

**Inspected implementation:** `codex/satel-public-methods` at
[`1fa8b65e2ef8192affe81b79e49145bb18b826ea`](https://github.com/levilucio/Browser-Petri-Net-Editor/tree/1fa8b65e2ef8192affe81b79e49145bb18b826ea),
through increment 38. Relative source links below refer to files inspected at that
commit; use that immutable tree when reproducing this analysis after later changes.
This note develops the [18 October publication plan][plan], particularly §§3–8.
It is not a new solver optimization or a solver-cache fault-detection study.

## 1. Defensible contribution and evidence status

The strongest current contribution is an executable separation between **reference
selection**, **observable response-history compatibility**, and **partial evidence
about a branching requirement**. The implementation demonstrates faults in small
procedural implementations without inspecting their states. It also deliberately
withholds HML conclusions that the sampled executions cannot support.

Suggested paper claim, supported now:

> We operationalize a restricted synchronous SATEL/APN testing workflow using
> admitted ground tests, a set-valued reference oracle, and conservative per-run
> HML evidence. Reproducible campaigns against three procedural service families
> detect observable violations in five deliberately faulty variants. The results
> distinguish response-history mismatches from property counterexamples and expose
> the limits of inferring shared-state branching from reset-based executions.

Add “we prove correspondence with the thesis” or “we characterize the complete
testable fragment” only after discharging the obligations in §7. Do not claim
general black-box conformance, a complete HML monitor, industrial validation, or
novelty for trace/branching separation itself.

Status labels used throughout:

| Label | Meaning |
|---|---|
| **Observed** | Result in a retained experiment, or directly inspected implementation behavior; finite scope |
| **Reproduced** | Rerun during this analysis with recorded counts and source fingerprint |
| **Derived** | Mathematical consequence with an explicit argument for the definitions in this note |
| **Proposed** | Statement/experiment still requiring proof or execution; not an established implementation guarantee |
| **Assumed** | Contract or hypothesis on which a conclusion depends; not established by passing tests |

No theorem relating the code to the original thesis is established here. The thesis
full text and its numbered definitions have not been audited in this work; the
mapping in §7 is a proof checklist, not an attribution of definitions to the thesis.

## 2. Evidence inventory and current-state audit

| ID | Source and exact role |
|---|---|
| E1 | [Publication plan][plan], 18 October: research question, three semantic levels, proposed proofs, capability limits, independent SUT development protocol |
| E2 | [Increment 21][inc21], 19 October: experimental contract, design and original results |
| E3 | [Original campaign artifact][historical]: 10 campaign summaries, 240 per-run identities/verdicts, call paths and representative full mismatches |
| E4 | [Campaign.js][campaign], `runBlackBoxExperiment`/`runBlackBoxCampaign`: complete successor search, belief update, typed responses, errors/budgets, two separate verdict channels |
| E5 | [Experiments.js][experiments], `experimentsForTest`/`traceEvidence`: fixed call paths and single-execution partial HML evaluation |
| E6 | [DemoSystems.js][demos]: closure-private procedural services, seeded choices, five faults; no APN simulator/selection/reference imports |
| E7 | [PublicMethods.js][methods], `enumerateMethodSuccessors`/`markingKey`, and [HmlEvaluator.js][hml]: concrete reference semantics, full marking identity and bounded model checking |
| E8 | [Core black-box tests][tests] and [workspace tests][gui-tests]: 28 focused regressions; rerun passed, 2 suites, 3.874 seconds |
| E9 | [Increment 35][inc35]: reported 576 SATEL tests/54 suites, 84 main and 42 repeat benchmark trials, 3,414 + 518 concretely validated class witnesses; contextual implementation evidence |
| E10 | [Increment 38][inc38]: later reported 732 tests/82 suites across a broader unit/integration scope, 35 SATEL GUI checks and browser lifecycle results; not a directly comparable SATEL-only count |
| E11 | [Evidence audit artifact][audit] and [audit program][audit-code], added here: historical count checks, fresh campaign comparison, synthetic observability example and bounded evidence checks |
| E12 | [IntentionPipeline.js][pipeline], [Admission.js][admission], [ValidatedSubuniformity.js][validation]: selection, concrete reference replay, frozen admitted suite |

The fresh campaign used the existing [CLI runner][runner], Node v24.22.1, Linux
x64 and installed `z3-solver` 4.15.3. Its 240 `(test, path, repetition, seed,
execution verdict, HML value, HML verdict)` records match E3 exactly. The CLI's
initial browser-asset attempt failed under Node, then its existing Node fallback
initialized Z3 successfully; all campaigns completed. This is a reproducibility
result, not a performance measurement. E9/E10 totals were read from their reports,
not rerun here.

E3 is a compact artifact, not a full transcript archive: it retains every run's
seed/verdict and path, but full step evidence only for representative mismatches.
E11 records aggregate/path counts and a timing-independent digest of the fresh
observations. Full fresh step evidence is regenerable with §10's command; it is
not duplicated in this documentation change.

### 2.1 What the 240 executions actually establish

| Intention / SUT | Runs | Compatible | Mismatch | HML witnessed | HML counterexample | HML inconclusive |
|---|---:|---:|---:|---:|---:|---:|
| Bag orders / bag | 16 | 16 | 0 | 0 | 0 | 16 |
| Bag orders / missing duplicate | 16 | 0 | 16 | 0 | 0 | 16 |
| Bag orders / wrong output | 16 | 0 | 16 | 0 | 0 | 16 |
| No third value / bag | 16 | 16 | 0 | 0 | 0 | 16 |
| No third value / wrong output | 16 | 0 | 16 | 0 | 16 | 0 |
| Shared choices / choice | 32 | 32 | 0 | 0 | 0 | 32 |
| Shared choices / early commitment | 32 | 25 | 7 | 0 | 0 | 32 |
| Joint selection / workers | 32 | 32 | 0 | 0 | 0 | 32 |
| Joint selection / failed worker | 32 | 23 | 9 | 0 | 0 | 32 |
| Joint selection / wrong receipt | 32 | 16 | 16 | 0 | 0 | 32 |
| **Total** | **240** | **160** | **80** | **0** | **16** | **224** |

The two verdict channels cross-classify as follows:

| Execution verdict | HML witnessed | HML counterexample | HML inconclusive |
|---|---:|---:|---:|
| Compatible | 0 | 0 | 160 |
| Mismatch | 0 | 16 | 64 |

There were no execution errors or incomplete executions in these campaigns.
**224 inconclusive HML results are not 224 satisfactions**, and none of the
campaign's complete selected properties was witnessed. Positive evidence exists
in focused regressions and the synthetic checks, not in this campaign's witnessed
column. The 16 counterexamples are repeated observations refuting one selected
forbidden-output property against one faulty SUT, not 16 distinct properties.

There are five unique faulty variants in three families. All five produce at least
one mismatch on the selected tests/seeds. “80 faults detected” is therefore wrong;
“80 mismatch executions across five faulty variants” is accurate. The wrong-output
bag appears under two intentions. These deliberately constructed variants do not
support a population-level detection rate.

For each worker campaign, 16 runs execute only `open(n=3)` and 16 also execute
`finish()`. Conditional on exercising completion, missing-finish mismatches occur
in 9/16 runs and wrong-receipt mismatches in 16/16. The shorter paths cannot expose
those faults. The Choice mutant's 7 mismatches occur on the 16 `open; left` paths;
the 16 `open; right` paths remain compatible. Report these denominators before
interpreting aggregate percentages.

## 3. Semantic objects and assumptions to freeze

Let the reference have markings M, initial marking m0, concrete public calls c,
and accepted edges `m --(c,o)--> m'`, where o is the multiset of output **events
produced by that call**. It is not the accumulated marking of an output place.
Method parameters are named and typed; a single ground substitution is shared
through the selected formula. There are no autonomous/internal transitions in
the black-box fragment accepted by E4/E7.

For response-history monitoring, extend this relation with
`m --(c,refused,empty)--> m` exactly when c has no enabled accepted edge at m.
Accepted responses include their status and complete declared output map. Call
this augmented relation R. HML modalities in E5/E7 range over **accepted edges**;
the monitor's refusal self-loops are not automatically HML edges.

For history h = `(c1,r1)…(ck,rk)`, define:

\[
B_0=\{m_0\},\qquad
B_{i+1}=\{m'\mid m\in B_i\land m\xrightarrow{(c_{i+1},r_{i+1})}_R m'\}.
\]

E4 implements this set update, using all compatible reference markings, with
deduplication by the full marking including hidden places and multiplicities.
An empty set after complete exploration is a response-history mismatch. Nonempty
B means that this one finite history is admitted. It does not assert inclusion
of every possible implementation history in the reference language.

| Assumption | Required meaning | Consequence if absent |
|---|---|---|
| A1 — Reset/initialization | Each run starts in an allowed initial configuration, without persistent leakage between instances | An observed history may concern the wrong system/configuration |
| A2 — Faithful adapter | Calls, arguments, acceptance, refusals and output events faithfully represent the SUT; type validation alone does not establish this | A mismatch may be in the adapter/abstraction rather than the implementation |
| A3 — Synchronous protocol | Each accepted call denotes one semantic transition; no unmodelled background actions during/between calls | Trace suffixes may not start at the state assumed by the HML rule |
| A4 — Reference enumeration | All relevant method rules/bindings explored; ground terms, guards, arithmetic and token identity interpreted correctly | Empty belief sets need not be real mismatches |
| A5 — Observation mapping | Structural multiset equality and output projection are appropriate; observations preserve the propositions being claimed | Both false alarms and observationally invisible faults become possible |
| A6 — Formula/polarity | A valid, ground formula and saved `expectedTruth` describe the actual requirement | A correct logical value can be reported against the wrong requirement |
| A7 — Controlled choices | Seeds/schedules have documented meaning; a seed is not a state-identity certificate | Repeated prefixes cannot be pooled as one hidden state |
| A8 — Admission provenance | Campaign suites originate in the admitted pipeline, with reference and requirements frozen | Arbitrary caller-supplied suites need not satisfy reference intentions |

The API checks that a suite has a reference, interface and selected tests; it does
not authenticate `oracleValidated` or independently repeat admission inside
`runBlackBoxCampaign`. The normal GUI/CLI path does use E12. Keep A8 explicit in
any theorem about the public API, and distinguish it from mismatch detection,
which is meaningful for arbitrary well-formed calls under A1–A5.

Specify how seeds relate to semantics. A PRNG seed can be part of a concrete
initial state or an external scheduling control. A witness pertains to the actual
run's initial state; it does not prove satisfaction at every seed-specific initial
state. A paper may abstract admitted scheduling choices into nondeterminism, but
must justify that abstraction and its modal preservation rather than silently
merging hidden seeded states.

## 4. Claim–evidence–assumption matrix

| ID / candidate claim | Status and evidence | Essential assumptions / missing obligation | Strongest justified wording; prohibited extension |
|---|---|---|---|
| C1 — Execute selected tests against software with hidden state | Observed/reproduced: E4/E6/E11; 3 families, 8 variants including 3 baselines | A1–A3, A5; procedural code written with knowledge of reference contracts | “Architecturally separate procedural SUTs”; not blind independent development or industrial representativeness |
| C2 — Detect observable implementation faults | Reproduced: 80 mismatches, all 5 faulty variants detected at least once, E3/E11 | A1–A5; P1/P3 below for general soundness | “Concrete histories incompatible with the reference under the declared protocol”; not universal conformance or 80 distinct defects |
| C3 — Respect allowed nondeterminism | Observed: both hidden reference states retained after Choice `open`; later response filters them; E4/E7/E8 | Full-state identity and enumeration, A4 | “Selected examples avoid rejection caused by choosing one arbitrary reference branch”; not a general verified oracle |
| C4 — Witness existential behavior | Observed in E8; reproduced synthetic checks E11, not the 240 campaign aggregate | A1–A3, A5–A7; P2 | A matching accepted path can witness the corresponding existential sequence; not an absent alternative or arbitrary branching conjunction |
| C5 — Refute forbidden observable behavior | Reproduced: 16 `picked(99)` counterexamples to `not <take/picked(99)> true`, E3/E11 | A2/A3/A5/A6; one observed edge suffices under P2 | “16 execution witnesses refute one forbidden-output property”; not every mismatch refutes the selected formula |
| C6 — Preserve required polarity | Observed: E5/E8; both polarities checked in E11 | Formula validity and correct `expectedTruth`; P2 | `witnessed` means evidence for required polarity, including false; never equate the label with formula truth |
| C7 — Keep uncertainty explicit | Observed/reproduced: 224 HML unknowns; budgets/errors/refusal-timeout distinctions tested in E8 | Distinguish search exhaustion, absent evidence and hidden-state limitations; no complete reason classifier exists | “No unsupported modal verdict in the checked cases”; not a complete decision procedure |
| C8 — Frozen tests satisfy reference requirements | Observed admission/replay boundary E12; E7 handles definite results and unknowns | Sound concrete semantics, A4/A6/A8; selection and implementation correspondence P3/P4 remain | “Every admitted candidate passed implemented reference replay”; not proof of thesis semantics or representative sufficiency |
| C9 — Different traces cannot generally establish shared-state alternatives | Derived §6; E11 finite-LTS check includes refusals | Explicit call/reset capability and no guaranteed exploration; no same-state restore or known probabilistic model | “Finite trace evidence is insufficient for this branching distinction”; not a theorem that every Choice fault is unobservable |
| C10 — Bounded computation is practically viable | Reported E9/E10; fresh CLI/28 focused tests here | Workloads, hardware, budgets and test scope retained | Engineering feasibility and regression confidence; not semantic correspondence, exhaustive classes or conformance |
| C11 — Generated equation cases correspond to thesis subuniformity classes | Proposed only, E1 §2/§3 | P4/P5; exact thesis definitions, coverage/disjointness and uniformity hypotheses | Call them computed cases/regions until their relation is proved |
| C12 — Distribution-level reliability or confidence | Not established; deterministic seeds reused across paths in E4/E6 | Fixed sampling policy, justified probabilistic model, detectable event, independence/stopping rules | Descriptive counts only; no binomial confidence claim from these campaigns |

C1–C8 describe a credible prototype contribution today. C9 provides a precise
limitation result under defined capabilities. C10 supports practicality. C11/C12
are not achieved results and should not be mixed into the abstract's claims.

## 5. HML witnessing, refutation and unknown evidence

E5 computes values T, F or U for **one execution**, then compares a definite value
with the required polarity. These values are knowledge about an ordinary two-valued
HML semantics; U is not a third truth value of the intended system property.

| Formula evidence | `expectedTruth=true` | `expectedTruth=false` |
|---|---|---|
| T | witnessed | counterexample |
| F | counterexample | witnessed |
| U | inconclusive | inconclusive |

The principal rules are asymmetric:

* A matching accepted edge followed by T evidence for its child yields T for a
  diamond. F evidence along one branch does not refute an existential modality.
* A matching accepted edge followed by F evidence for its child yields F for a
  box. T evidence along one branch does not establish a universal modality.
* Negation flips T/F and preserves U. Conjunction/disjunction use conservative
  three-valued Boolean rules, at the same actual state along the same execution.
* Missing or nonmatching events, sampled refusals and nonempty marking predicates
  yield U where required. Even a predicate on a publicly named output place is
  not a marking snapshot: outputs are per-call events.

Consequently, `picked(99)` immediately refutes `not <take/picked(99)> true`.
The same event does not prove the falsity of an existential sequence requiring
`picked(1)`: another accepted alternative might still exist. Likewise, a refused
`finish()` can contradict every compatible reference state without refuting
`<finish> true` in the unknown SUT. This explains the 64 mismatch/U combinations.

The evidence evaluator is deliberately **incomplete even where no fundamental
observability problem exists**: `[a] true` is logically valid, but its modal rule
does not return T; some Boolean tautologies with unknown children also stay U.
Therefore do not present the implemented decisive fragment as the maximal
black-box-testable fragment. Formula simplification and richer sound evidence
composition could decide more cases without changing the observation interface.

Repeated experiments also need not lose all information: existential witnesses
for `<a>true` and `<b>true` can support their conjunction at a guaranteed common
initial state. What is invalid is identifying *post-prefix* hidden states merely
because their visible prefixes agree. The current code avoids cross-run
composition entirely; that is conservative rather than a completeness result.

| Cause of an unresolved result | Meaning | Remedy / boundary |
|---|---|---|
| Reference enumeration/state/time limit | Compatibility could not be decided | Increase/alter computation; never discard states and declare mismatch |
| Symbolic residual or SMT unknown | Selection obligation not discharged | Resolve/restrict the fragment; not UNSAT, an empty class or SUT refusal |
| SUT/adapter timeout | No trustworthy completion/refusal within the operational timeout | Define deadline/quiescence semantics separately or improve adapter |
| No sampled witness/counterexample | Relevant behavior not seen | More/directed runs may help under declared policy; no finite certainty of absence |
| Unavailable state identity/marking | Evidence cannot establish the claimed branching/atom | Change capability or weaken claim; repetition alone does not recover identity |
| Conservative rule incompleteness | Definite truth might be obtainable without new observations | Prove and implement additional rules; do not call it fundamental impossibility |
| Malformed response/reference or exception | The experiment is invalid | Repair it; error is neither a conformance fault nor logical false |

These are analytical categories; current HML U reasons are coarse. The two verdict
channels must also remain independent when execution is incomplete: E4 can retain
decisive HML evidence from a trustworthy prefix even if a later execution budget
is exhausted. An execution `error` explicitly suppresses property evidence.

## 6. Trace compatibility versus branching: two different examples

Let `a = open/0`, `b = left/1`, `c = right/2` be accepted call/output labels and
let

\[
\Phi=\langle a\rangle(\langle b\rangle\top\land\langle c\rangle\top).
\]

This requires **one** a-successor that supports both continuations. Observing ab
after one reset and ac after another does not identify that successor.

### 6.1 Existing Choice service: useful, but not refusal-trace equivalent

The reference's `open` reaches either a both-choices state B or a left-only state L.
The early-commitment mutant reaches either a right-only state R or L. Successful
left/right calls consume the choice and reach a terminal state D. Their accepted
trace languages agree, and Phi is true only in the reference's nondeterministic
abstraction. However, `open accepted(0); left refused` is possible in the mutant
and impossible in the reference. That is exactly the recorded mismatch mechanism.

Thus these systems are **not** indistinguishable under the actual status-aware
experiment interface. The 7 observed refusals detect a stronger response-history
violation; they are not evidence that the monitor has decided Phi's hidden
branching semantics. E11 independently finds this distinguishing history.

### 6.2 Refusal-preserving example added for the paper

Consider two small abstract LTSs with the same calls and outputs:

| State / action | Behavior |
|---|---|
| Initial state of M+ / open | Nondeterministically enter B, L or R, always output 0 |
| Initial state of M− / open | Nondeterministically enter L or R, always output 0 |
| B / left or right | Accept, output 1 or 2 respectively, enter D |
| L / left; R / right | Accept, output 1 or 2 respectively, enter D |
| Any state / disabled call | Explicit refusal with empty outputs; preserve that state |
| D / any call | Refuse and remain in D |

**Derived lemma, for these definitions:** M+ and M− have equal finite
call/response trace languages, including refusals, but M+ satisfies Phi and M−
does not.

Argument. M−'s branches occur in M+, so its traces are included. The extra branch B
can refuse only `open` before its first successful choice. If that choice is left,
L reproduces the whole finite history; if right, R does; if neither occurs, either
does. After the successful choice both systems are in D. Hence every additional
M+ trace already occurs in M−. B witnesses Phi in M+, whereas neither L nor R can
witness its conjunction in M−. This is a direct mathematical argument about the
defined LTSs, not a proof about the APN compiler or the original thesis.

E11 additionally checks language equality by exploring the entire reachable
product of determinized state sets: 6 pairs, including the empty pair, with no
depth cutoff. It separately uses the actual `traceEvidence` on histories of up
to 3 calls from these models: 155 state-path histories (not necessarily distinct
visible traces), 8 formulas, both polarities, 2,480 evaluations, 332 definite
values, zero disagreements with a tiny independent exact LTS evaluator. All 155
checks of Phi remain U. These checks supplement the argument; the bounded
evidence corpus is not a proof of P2 for arbitrary formulas/programs.

**Capability consequence.** Without same-state restore, guaranteed exploration,
or an assumed probabilistic law, every finite transcript from M+'s extra branch
can also be explained by M−. Adaptive calls based on that transcript choose the
same next input in the alternative explanation. Separate resets may choose L or
R independently, so finitely many runs do not remove the ambiguity. No procedure
based only on such finite observations can be both sound and guaranteed to settle
Phi on both systems. This is a qualitative possible-transcript argument, not
equality of probability distributions, seed-indexed behavior or richer testing
equivalences. A stipulated scheduler/seed-control contract may distinguish them.

Opaque snapshot/restore could witness both successful continuations from one
restored B without exposing its contents. It requires restoration of every
behavior-relevant system/environment component while allowing the intended future
choices. It still cannot establish absence of unobserved successors or existence
of a shared state that the campaign never reaches. Restoring PRNG state can repeat
the same future; reset plus the same seed is not automatically snapshot/restore.

## 7. Mathematical statements still requiring proof

The statements below are **proposed implementation theorems**, with proof routes.
Their abstract arguments do not amount to completed proofs of JavaScript or thesis
correspondence. The finite-LTS lemma in §6 has a separate, explicitly limited status.

| ID | Precise proposed statement | Assumptions and proof obligation | Plan link |
|---|---|---|---|
| P1 — Belief invariant / mismatch soundness | For every processed prefix h whose reference enumeration completes, the stored belief set equals all R-reachable markings after h. Consequently `mismatch` implies h is outside the reference response-history language | Induct over calls using §3's recurrence. Prove E7 enumerates exactly enabled firings; full marking keys preserve future behavior; projection/equality correct; incomplete exploration cannot decide emptiness. Faithful adapter needed to attribute the mismatch to the SUT | §3.1, §5 |
| P2 — Definite trace-evidence soundness | For a valid ground formula phi and an authentic path from concrete initial state s, E(phi,path)=T implies s satisfies phi, and E=F implies s does not satisfy phi; U entails neither | Structural induction: constants, unknown atoms, Boolean rules, witnessed diamond and refuted box. Matching accepted labels must denote actual transitions; no illicit state merging; prove observation complement/equality and `expectedTruth` labeling. Refusal handling remains conservative | §3.4–3.5, §6 |
| P3 — Concrete model-checker soundness | Every definite result of `evaluateFormula` agrees with the defined APN HML semantics despite finite budgets | Prove exact successor enumeration, ground evaluator correctness, atom interpretation and conservative partial search. Existential witnesses/universal counterexamples can be decisive before exhaustive search; the opposite directions need complete matching-successor coverage | §3.1–3.2 |
| P4 — Admission/selection soundness | Every test admitted by the standard pipeline is ground, starts at m0, satisfies its intention and required reference polarity in the chosen fragment | Separate symbolic constraint construction, SMT translation, witness decoding/validation and concrete replay. P3 supports replay polarity, but intention membership/region provenance and shared-variable obligations also require proof. Shared semantic utilities are a common-mode risk | §3.2 |
| P5 — Thesis correspondence / region relation | For an explicitly defined thesis fragment F and translation T, related states preserve the chosen observation labels and formula fragment; specify whether computed regions refine, cover or equal semantic subuniformity classes | Obtain exact thesis definitions. If claiming all finite HML with negation and atoms, provide atom-preserving labeled bisimulation (or prove the needed logical equivalence); one-way simulation alone does not establish both polarities. Prove domain/equation assumptions and specify hidden-action treatment | §3.1 and §2 |
| P6 — Bounded relative completeness | Within a mathematically defined finite search domain D, an exhaustive selector returns an admissible witness whenever one exists, assuming every relevant constraint problem is decided | Define D by structural/data/execution bounds, prove coverage of case generation and witness search, require terminating complete decision procedures for the supported fragment. Wall-clock budgets, unresolved frontiers or SMT unknown invalidate this conclusion | §3.3 |
| P7 — Capability-dependent decidability/testability | Characterize a declared formula fragment for which finite experiments can soundly witness/refute required polarity under a specific interface | Give constructive evidence rules and, for claimed boundaries, indistinguishability arguments for that exact observation alphabet. §6 supplies one example, not a maximal-fragment theorem | §3.4–3.5 |

### 7.1 Required correspondence table before claiming a thesis result

| Thesis-side item to locate precisely | Implementation-side item | Required decision/lemma |
|---|---|---|
| Algebra, carriers, equations and observational equality | Supported builtin/structured values, ground evaluator, SMT encoding | Which carriers/equations are supported; overflow/undefined-operation semantics; free-constructor versus quotient assumptions |
| Initial configurations and state | Saved APN initial marking, full marking keys | State relation and preservation of token multiplicity; parameterized initial configurations only if declared |
| Stimulation/observation and method semantics | Public named calls and per-firing output events | Label translation; input binding and synchronized firing fragment; relation to methods/ports/gates |
| Internal actions/concurrency | Synchronous public-method-only replay | Explicit exclusion or a proved weak/saturated semantics; do not infer it from async JavaScript signatures |
| Intention semantics and parameter quantification | Shared ground substitution over sequence/formula | Quantifier order, reachability, same substitution across branches, expected polarity |
| Uniformity/subuniformity hypotheses | Equation-unfolding cases and selected representatives | Exact region relation and the hypothesis allowing one representative to stand for untested values |
| Non-enabledness and observation adequacy | Explicit protocol refusal versus `[call] false` | When absence is semantic, when refusal is merely a sampled response, and which predicates are observable |

No amount of additional regression testing discharges P5. Conversely, proving P5
would not make arbitrary SUT conformance decidable through finitely many runs.
These are independent proof targets, as the October plan requires.

## 8. Smallest additional experiments, ordered by evidential value

The completed work below is intentionally small. The remaining experiments target
semantic evidence and contribution attribution, not performance or cache settings.

| ID / question | Minimal design and controls | Required output / success criterion | Status |
|---|---|---|---|
| X0 — Do the published campaign counts still hold? | Rerun existing 10 campaigns at pinned commit; compare all 240 run identities and verdicts, not only totals | Same historical vector, joint verdict table, per-path denominators and fingerprint | **Completed**, E11; 28 focused tests also passed |
| X1 — Does the impossibility example survive refusal observations? | Two tiny finite LTSs from §6; exact response-language comparison; independent HML truth; actual evidence evaluator | Equal refusal-augmented languages, opposite Phi truth; both trace evidence results U | **Completed at abstract LTS level**, E11. A procedural/APN integration fixture is optional next work, not already present |
| X2 — Are all implemented evidence rules sound on a broader independent corpus? | Enumerate tiny LTSs (e.g. 1–3 states, 2 calls, finite outputs), bounded formulas including `not`, `and`, `or`, box/diamond, observations/complements and both polarities; compare with independent exact truth. Add private predicates, timeout/refusal and cutoff cases | Zero definite-value disagreement; report corpus sizes and U separately. Ensure counterexamples shrink to reviewable witnesses. This expands E11's 8-formula check, which does not cover all observation features | **Proposed**; strongest next assurance experiment for P2, still not a proof |
| X3 — What does joint branching selection add? | Existing workers only: use a legal sequence-only amount such as n=1 and joint-selected n=3, identical completion-capable call paths and seeds. Include baseline, failed-worker and wrong-receipt SUTs; retain open-only paths as a separately reported control | Show whether both-worker completion becomes a decisive reference obligation at n=3, and whether failed-worker refusals at n=1 remain compatible. Count faults per exercised path and selection/admission outcomes, not just successes | **Proposed**; n=1 contrast is source-based prediction, not measured here |
| X4 — Does capability, rather than run count, resolve shared-state witnessing? | One B fixture with opaque snapshot/restore; execute left and right from the same saved state. Compare reset-only and snapshot protocols with the same calls; include L/R controls and restored-PRNG trap | A same-state certificate justifies an existential conjunction only in the snapshot experiment. No universal-satisfaction claim from snapshot alone | **Proposed**, optional for a capability paper; requires a new control contract and evidence rule |
| X5 — Does the approach transfer beyond known demo fixtures? | One small synchronous requirements-driven service (e.g. reserve/cancel/dispatch), 2–3 documented faults and one intentionally unobservable or insufficient-depth fault; build SUT from API/requirements without APN code or generated tests | Contract/abstraction map, construction protocol, fault ledger, detection and survivors with causes; frozen tests before revealing fault implementations | **Proposed**; needed before claiming development independence or broader software applicability |

For the smallest focused methods paper, prioritize **P1/P2 proofs plus X2/X3**;
X0/X1 are already supplied here. Add X5 if independent software applicability is
a central empirical claim. X4 is useful if the paper promises a capability ladder,
but a new HTTP adapter, asynchronous service or large benchmark is unnecessary
for the present semantic contribution. More seeds alone would not address P5,
shared-state identity, or the absence of a controlled selection ablation.

## 9. Connection to the October 18 plan and paper structure

| Plan commitment | Current position | Remaining paper work |
|---|---|---|
| Connect theory, executable selection and black-box evidence | E12/E7/E4/E5 provide distinct implementation boundaries | P3–P5 connect them mathematically; cite exact thesis definitions |
| Independent synchronous SUT | Three architecturally separate procedural families exist | Independence-by-development protocol and realism remain limited; X5 |
| Set of compatible reference states | Implemented and exercised | P1 proof and an independently checked semantic specification |
| Witness/counterexample/unresolved evidence | Implemented and reproduced; 224 unknowns are visible | P2 proof; X2; finer reason taxonomy; no complete testability claim |
| Explain why pooled traces cannot settle branching | Existing Choice illustration plus corrected refusal-aware lemma here | State exact capability quantifiers; compare with related testing/HML results |
| Comparative experiments | Existing campaign is a feasibility/detection demonstration | X3 isolates the effect of joint selection; no causal benefit claim yet |
| Bounded computation with honest residuals | Extensive engineering reports, including increments 35–38 | Keep structural completeness claims conditional; do not substitute test totals for proofs |
| Statistical execution | Reproducible seeded campaigns exist | No operational sampling model; omit statistical guarantees unless separately justified |

Suggested contribution order: (1) define the synchronous fragment and observation
contract; (2) state the two oracle semantics and prove P1/P2; (3) state exactly the
thesis correspondence achieved, if any; (4) give the refusal-aware limitation;
(5) evaluate detection, evidence polarity and selection ablation; (6) explain
independence, sampling, observability and bounded-search threats to validity.

The paper can answer the plan's research question without claiming to recover the
whole thesis: finite accepted paths and forbidden observable outcomes remain
operationally useful; arbitrary absence, hidden branching identity and unproved
selection hypotheses do not become established merely because execution is fast
or every regression passes. The strongest prospective scientific contribution is
the precise relationship between these guarantees, rather than the raw test count.

## 10. Reproduction and maintenance

From `petri-net-app`, after installing the lockfile dependencies:

```sh
npm ci --no-audit --no-fund
node tools/node/run-satel-black-box.js /tmp/satel-black-box-current.json
node tools/node/audit-satel-black-box-evidence.js /tmp/satel-black-box-current.json /tmp/satel-black-box-evidence-audit.json
npm test -- --runInBand src/__tests__/satel/black-box.test.js src/__tests__/satel/black-box-workspace.test.jsx
```

The audit exits nonzero on a historical count inconsistency, changed per-run
verdict, unequal synthetic languages or an unsound definite result in its corpus.
It includes source hashes and the current commit. Running it without arguments
audits the historical artifact and synthetic models only; `freshReplay` is null.
The new audit code imports the real evidence evaluator but uses its own tiny LTS
semantics, rather than the APN evaluator, for independent comparison.

Update this note's baseline, evidence table and claim status when semantic changes
occur. Preserve historical results; a new successful experiment does not silently
retroactively prove an earlier claim. Source-code regressions, model-level lemmas,
formal implementation proofs and statistical evidence should remain separately
identified in the eventual article.

[plan]: paper-planning-publishability-and-black-box-testing.md
[inc21]: increment-21-black-box-campaigns.md
[inc35]: increment-35-numeric-preference-refutation.md
[inc38]: increment-38-browser-worker-lifecycle.md
[historical]: experiments/black-box-2026-10-19.json
[audit]: experiments/black-box-evidence-audit-2026-10-24.json
[audit-code]: ../../petri-net-app/tools/node/audit-satel-black-box-evidence.js
[runner]: ../../petri-net-app/tools/node/run-satel-black-box.js
[campaign]: ../../petri-net-app/src/satel/blackbox/Campaign.js
[experiments]: ../../petri-net-app/src/satel/blackbox/Experiments.js
[demos]: ../../petri-net-app/src/satel/blackbox/DemoSystems.js
[methods]: ../../petri-net-app/src/domain/apn/PublicMethods.js
[hml]: ../../petri-net-app/src/satel/core/HmlEvaluator.js
[tests]: ../../petri-net-app/src/__tests__/satel/black-box.test.js
[gui-tests]: ../../petri-net-app/src/__tests__/satel/black-box-workspace.test.jsx
[pipeline]: ../../petri-net-app/src/satel/core/IntentionPipeline.js
[admission]: ../../petri-net-app/src/satel/core/Admission.js
[validation]: ../../petri-net-app/src/satel/core/ValidatedSubuniformity.js
