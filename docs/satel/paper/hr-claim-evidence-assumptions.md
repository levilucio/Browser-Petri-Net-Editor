# HR experiments: claim, evidence and assumption matrix

Working research synthesis, 31 October 2026. This supplements the
[paper draft](README.md) and [proposed semantic contract](../paper-baseline-semantic-contract.md).
It does not replace the frozen B0 baseline, the separate historical black-box
audit, or the thesis correspondence obligations. The newer methods/gates engine
and HR experiments have their own code changes and source-hashed manifests.

## Research question

Which parts of algebraic test selection remain operationally useful when
computation is bounded and observations come from a real application's public
interface? Separate the costs of data-term unfolding, token binding and interaction
history. Separately ask whether selected representatives and observations expose
particular implementation faults. Successful execution is evidence for a bounded
configuration, not a theorem about unrestricted SATEL or CO-OPN.

## Claim–evidence–assumption matrix

| Claim suitable for the paper | Evidence and provenance | Assumptions and limits |
| --- | --- | --- |
| Generic token data avoids one transition per employee in this HR model. | The current reference has four places, 21 transitions, 12 methods and six gates. Employee, role, company and record identities reside in tokens. [Increment 44](../increment-44-generic-hr.md). | This is one modelling case study. The APN's bounded roster is distinct from the application's 256 seeded staff. It is not evidence of complete HR requirements coverage. |
| Necessary guard equalities can substantially reduce binding search on this fixture while retaining checked results. | At 256 employees, paired exhaustive/indexed runs measured 64.43/6.44 seconds with two slots and 204.06/6.34 with eight. Frozen selected pairs agree. [Index results](../../../experiments/hr-management-sut/INDEX_RESULTS.md). | Single-trial historical measurements; unknown index keys retain fallback. These numbers do not prove general equivalence of the optimization or predict arbitrary APNs. |
| Finite ADT-depth configurations can be completely processed within explicit budgets. | The five-entry WorkLog derives, selects and admits 3,125 computed regions; the reported stage times are 39.17, 63.75 and 79.96 seconds. [Scale results](../../../experiments/hr-management-sut/SCALE_RESULTS.md). | Fixed 12-person/five-slot marking. Five choices per entry still give exponential region growth, and pairwise overlap processing remains costly. Completion applies to that configured unfolding, not unrestricted recursive data. |
| Independent finite checking supports the computed WorkLog partitions on enumerated inputs. | The audit uses a separate restricted interpreter and checks membership, coverage, overlap, results and witnesses. Earlier lengths 1–3 check 24/576/13,824 boundary inputs; deeper cases check the declared finite kind vectors. [Depth results](../../../experiments/hr-management-sut/DEPTH_RESULTS.md), [scale results](../../../experiments/hr-management-sut/SCALE_RESULTS.md). | Independent for its supported language and finite corpus. It is not a proof for all Nat values, arbitrary recursive lengths, APN semantics or thesis annotation classes. Engine coverage remains `not-proved`. |
| Interaction-history length has a separately measurable cost with data regions and initial marking held fixed. | Increment 51 admits all 25 regions at 25/50/100 pairs in three trials each, with the same two-entry goal, witnesses and 87-token marking. Median selection takes 13.33/32.37/100.27 seconds. [Sequence results](../../../experiments/hr-management-sut/SEQUENCE_RESULTS.md). | The changing history naturally adds constraints and audit operations. This is a controlled fixture, not a complexity theorem. Explicit HML formula limits and nondeterministic fallback are separate. |
| Longer histories can reveal a delayed effect missed by their exact shorter prefixes. | The late-correction mutant passes every 25/50-pair test but fails all 25 REST and two browser 100-pair tests at pair 53 or 58. Unmutated baselines pass; matched prefixes and transport traces agree. [Sequence results](../../../experiments/hr-management-sut/SEQUENCE_RESULTS.md). | This is one deliberately delayed fault and a predeclared browser subset. It establishes an incremental detection benefit for that fault, not the general superiority of long tests or a population detection rate. |
| A representative's success does not establish adequacy of its entire computed region. | In 155 matched within-region contrasts, selected members pass the duration-boundary mutant while valid upper-boundary members fail. Equal-size selected/interior policies detect five of six seeded faults; upper-boundary policy detects six. [Effectiveness results](../../../experiments/hr-management-sut/EFFECTIVENESS_RESULTS.md). | This challenges uniformity for that implementation and observation protocol. It does not invalidate the algebraic partition or a theorem conditional on a testing hypothesis. The fault set is deliberately constructed; upper boundaries are not shown universally superior. |
| Bounded forbidden-call arguments can be selected and executed against the real SUT. | 160 declared targets yield 129 refused witnesses and 31 scoped no-refusal results. Concrete enumeration agrees on all 565 domain valuations. Five permissive mutants are detected through REST and browser. [Negative results](../../../experiments/hr-management-sut/NEGATIVE_RESULTS.md). | Prefixes, methods, actors and finite domains are supplied. One witness per successful target is selected. The concrete and symbolic checks share APN semantics; this is not independent formal validation or the exhaustive negative substitution set. |
| Added observations can detect persisted effects that terminal-only refusal tests miss. | All four persisted-write mutants survive the terminal ablations but fail added probes. The experiment contains 387 extensions of 129 negatives, 2,590 REST and 170 browser executions. [Post-refusal results](../../../experiments/hr-management-sut/POST_REFUSAL_RESULTS.md). | Separate trace experiments preserve the current terminal-refusal intention/HML syntax. Each probe uses a fresh reset. Finite observations do not prove unchanged hidden state. |
| The observation abstraction determines which state changes can be exposed. | An orphan vacation charge is seen by balance, an extra audit row by audit count, and a version-only write remains compatible because the gate mapping omits version. [Post-refusal results](../../../experiments/hr-management-sut/POST_REFUSAL_RESULTS.md). | A change outside the declared projection is not automatically an observable conformance violation. Broader claims require a broader abstraction and new tests. |
| Matching selected REST/browser histories provide evidence that both adapters realize the same declared interaction contract. | Exact matched event/verdict comparisons are retained for the effectiveness, refusal and post-refusal campaigns; their browser subsets were fixed before outcomes. | This is neither complete frontend equivalence nor a blinded independent-development study. The SUT is implemented separately from the APN evaluator but developed in the same research process. |
| A trace mismatch and a decisive HML counterexample are different claims. | Prefixed refusal runs remain HML-inconclusive even when they yield an APN trace mismatch. The historical worker/Choice study independently records 80 mismatches, 16 HML counterexamples and 224 inconclusive evidence records. [Semantic contract](../paper-baseline-semantic-contract.md), [negative results](../../../experiments/hr-management-sut/NEGATIVE_RESULTS.md). | Existential prefixes and unobserved alternatives prevent promoting an arbitrary bad continuation to whole-formula falsity. Historical counts are reported from their pinned source, not rerun on the current HR engine. |

## Three independent scaling axes

| Axis | What was varied | What was controlled | What must not be inferred |
| --- | --- | --- | --- |
| Token binding | Roster and record slots | Algebraic goal and generic transition logic | A larger database alone does not imply more ADT regions. |
| Algebraic unfolding | WorkLog entries, one through five | Fixed roster/slots in the depth experiment | ADT entry count is not the number of stimulation/observation pairs. |
| Interaction history | 25, 50 and 100 pairs | Two ADT entries, 25 regions, fixed initial marking and representatives | Results for one deterministic workflow do not establish arbitrary branching-history scalability. |

Do not pool the numeric results into one synthetic speedup. They were measured on
different protocols, bounds and engine versions. The current sequence experiment
uses repeated trials; earlier timing tables are predominantly individual trials.
Report median/range only where repetitions actually exist.

## Formal obligations still open

1. **Reference transition semantics.** Establish correspondence for the implemented
   synchronous method/gate fragment, including token multiplicity, typed argument
   evaluation, undefined operations and the public observation projection. Shared
   implementation paths and regression counts do not prove this correspondence.
2. **History-oracle soundness.** Under exact completed reference enumeration,
   faithful adapters and correct reset, prove that an empty compatible-state set
   is a finite observable conformance violation. Cutoffs must remain unknown and
   must not silently discard alternatives. This is the earlier P1 target.
3. **HML evidence soundness.** Prove the conservative evidence rules with the
   declared edge and state interpretation. Preserve uncertainty about unobserved
   alternatives and never merge hidden states across separate runs. This is P2;
   finite tiny-LTS checks remain supporting evidence.
4. **Selection and reduction correspondence.** Relate computed equation regions
   and selected executable substitutions to the thesis's annotations and allowed
   reduction families. Feasibility, disjointness, coverage, correspondence and
   representative adequacy are different obligations. The printed-rule questions
   R1/R2 in the semantic contract still require author review.
5. **Observation/reset adequacy.** State which database facts are represented by
   gates, which are abstracted away, and which initialization conditions the reset
   actually restores. Synchronous calls and no interleavings are model assumptions,
   not properties inferred from passing sequential tests.

No theorem, coverage status or thesis interpretation is changed by this matrix.
The 100-pair support is a bounded implementation capability, not resolution of
these proof obligations.

## Negative and inconclusive results that belong in the paper

- Exponential region growth and pairwise overlap work remain after optimizations.
- Uniformity is not established by one passing representative; the boundary fault
  provides explicit within-region contrasts.
- Terminal refusals miss persisted writes; a finite probe family still misses
  changes outside its observation projection.
- Finite traces cannot generally settle branching properties. An inconclusive
  HML record must not be counted as satisfaction or mutant detection.
- The earlier repeated unmutated HR campaign encountered SQLite corruption.
  Its failed evidence was retained. Temporary live databases, atomic reports and
  integrity checks provide containment; the precise cause remains unresolved.
- Default sequence-length, node, time and explicit HML-depth limits are distinct
  boundaries. Raising one must not be reported as eliminating the others.

## Evidence inventory and reconstruction

| Experiment | Design/results record | Retained evidence |
| --- | --- | --- |
| Generic/indexed HR | Increments 44–45; `INDEX_RESULTS.md` | `index-comparison.json`, `index-summary.json`, original frozen suites in `generic-evidence.zip` |
| ADT depth/feasibility | Increments 46–47; `DEPTH_RESULTS.md`, `SCALE_RESULTS.md` | `depth-*.json`, `scale-*.json`, independent audit scripts |
| Representative sensitivity | Increment 48; `EFFECTIVENESS_RESULTS.md` | `effectiveness-manifest.json`, summary, baseline repeats and preflight findings |
| Scoped refusals | Increment 49; `NEGATIVE_RESULTS.md` | `negative-manifest.json`, summary and concrete finite classification audit |
| Observations after refusal | Increment 50; `POST_REFUSAL_RESULTS.md` | `post-refusal-manifest.json`, summary and first trace counterexamples |
| Interaction length | Increment 51; `SEQUENCE_RESULTS.md` | `sequence-manifest.json`, summary, preflight record and frozen-suite verification |

These evidence files are under `experiments/hr-management-sut/results/`. Restore
scripts verify hashes and reconstruct frozen stimuli without selecting new
representatives. Generation scripts deliberately create new manifests and require
new baseline/target runs. Raw local campaign logs can be regenerated; compact
committed summaries retain membership checks, counts and first counterexamples.

For publication, choose and name a new implementation baseline for the reviewed
methods/gates engine, pin its commit and manifests, and retain B0 as historical.
The next writing step is to turn the precise claims above into the evaluation
section while resolving or explicitly excluding the open correspondence claims.
Additional application features are not needed to establish these distinctions.
