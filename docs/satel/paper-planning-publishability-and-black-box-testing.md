# SATEL/APN: publication direction, semantic correspondence, and black-box testing

Discussion record: 18 October 2026 (Europe/Berlin).

This note consolidates the discussion about the publishability of the SATEL/APN
work, its relationship to Levi Lúcio's PhD thesis, and the proposed move from APN
mutants to independently implemented, nondeterministic black-box systems.
It is a paper-planning record, not a completed novelty review or a statement that
the proposed proofs or black-box execution facilities already exist.

Follow-up: the [24 October claim–evidence–assumption matrix](paper-black-box-claim-evidence-assumptions.md)
assesses the subsequent black-box implementation against this plan, reproduces
the campaign verdicts, and distinguishes proved model-level observations from
proposed implementation/thesis theorems. The original discussion below is retained
as the historical planning baseline.

Implementation baseline at the time of discussion: branch
`codex/satel-public-methods`, commit `464d181398b016bce8ccbc077db47bc87cb16664`.
See the [development summary](development-summary-2026-10-16.md),
[joint sequence/HML selection](increment-18-joint-hml-selection.md),
[algebraic HML selection](increment-19-algebraic-hml-selection.md), and
[scalability study](increment-20-scalability.md) for implementation evidence.

## 1. Overall assessment and proposed research question

There is a credible publication opportunity. A working tool provides a foundation;
a precise semantic connection to SATEL, an account of approximation and
observability, and comparative experiments could support a substantial research
paper. Acceptance and originality remain to be established through a detailed
related-work comparison and the actual results.

The strongest proposed research question is:

> Which parts of an idealised algebraic testing theory remain operationally
> meaningful under bounded computation and restricted observation?

Three levels should be connected explicitly:

1. What SATEL's mathematical semantics says a test means.
2. What the bounded symbolic selection algorithm can generate and establish.
3. What executing a test against a partially observable black box can demonstrate.

The contribution would concern the relationships between these levels, including
where guarantees necessarily weaken. Implementing every feature of CO-OPN is not
the objective. A well-defined, useful fragment with strong results is preferable
to an unsupported claim of full equivalence.

A candidate central claim, to be revised after proofs and experiments, is:

> We give an executable, bounded interpretation of a SATEL fragment that combines
> algebraic selection hypotheses with reachable APN behaviour and branching test
> requirements, establish conditions for preserving the reference semantics, and
> characterise the evidence obtainable under specified black-box testing capabilities.

## 2. Established ingredients versus candidate contributions

Algebraic specification testing, testability hypotheses, narrowing with SMT,
symbolic Petri-net analysis, and statistical black-box checking have substantial
prior art. Neither “APNs plus Z3” nor Monte Carlo execution alone is a defensible
novelty claim. Earlier SATEL publications and the thesis are also prior work; the
new paper must identify its contribution beyond them.

| Component | Assessment from the discussion |
| --- | --- |
| Browser-based SATEL/APN tooling | Useful tool contribution; limited novelty by itself |
| Constructor/equation unfolding with SMT | Established ingredients; novelty depends on the algorithm and guarantees |
| Algebraic selection connected to reachable, branching APN executions | Promising; requires comparison with existing symbolic testing |
| Correspondence with a declared SATEL fragment | Potentially strong formal contribution |
| Characterisation of what black-box experiments can establish or refute | Potentially the strongest contribution if made precise |
| End-to-end independent SUT experiments | Important evidence that the formal distinctions matter |

A central difficulty is that a constructor or equation case describes a region
of the data domain, while a useful representative must also satisfy the initial
marking, token availability, guards, earlier firings, and later requirements.
For branching HML properties, one parameter substitution must satisfy obligations
across alternative executions rather than being chosen independently per branch.

Do not identify equation-unfolding cases with the thesis's semantic subuniformity
equivalence classes without proof. Depending on assumptions, the computed cases
could form a refinement, an overlapping cover, a partial cover, or another
approximation. Uniformity within a selected region is a test-selection hypothesis,
not automatically a theorem about every possible implementation.

## 3. Proposed mathematical results

These are proof objectives, not established theorems.

### 3.1 Operational and logical correspondence

Define the supported fragment of the thesis and a mapping to the implemented
APN methods, markings, observation labels, and intentions. Prove the appropriate
relationship between the two semantics.

“Partial equivalence” must be replaced by a precise statement: equivalence on a
restricted fragment, one-directional preservation, or correspondence under
explicit assumptions. A one-way simulation generally does not preserve both
existential and universal modal properties. Choose the relation and formula
fragment together, including any treatment of hidden/internal actions.

Distinguish two independent questions:

- Does our implementation semantics correspond to the thesis semantics?
- Does a particular SUT conform to its specification?

Proving the first does not make the second decidable through finite experiments.

### 3.2 Selection soundness

Show that every returned ground test satisfies its intention and required
property polarity in the reference semantics, under stated assumptions about
equational evaluation, SMT encodings, and completed exploration.

Separate soundness of constraint construction, witness extraction, and concrete
admission. Agreement between components that share a semantic bug is not an
independent correctness argument.

### 3.3 Bounded relative completeness

Investigate whether exhaustive search within declared structural/execution bounds
finds a witness whenever one exists in that bounded domain, assuming the relevant
constraint problems are decided. A wall-clock timeout is not a mathematical
completeness bound. Residual constraints and SMT `unknown` must not become claims
of unsatisfiability, empty classes, or refusal.

### 3.4 Testability under experimental capabilities

Characterise which formula fragments admit sound satisfaction or violation
verdicts with each capability:

| Capability | Potential evidence and important limitation |
| --- | --- |
| Calls and public observations | Finite execution witnesses and observable violations; hidden branching remains unavailable |
| Reset to initial configuration | Repeated experiments; replaying a visible prefix need not reproduce a hidden state |
| Opaque snapshot/restore | Experiments from the same restored state, if all relevant system/environment state is captured |
| Controlled scheduling or fault injection | Directed exploration of admitted scenarios; coverage depends on the controls |
| Exhaustive successor access | Stronger bounded modal conclusions; generally unavailable for a genuine black box |
| Declared probabilistic sampling assumptions | Quantitative claims about the experiment's distribution, not arbitrary schedulers |

Snapshot/restore alone does not establish absence of unobserved successors.
Restoring a pseudorandom generator exactly may also repeat the same outcome;
alternative future schedules/randomness need an explicit experimental contract.

### 3.5 Impossibility and evidence results

Seek examples or theorems showing that systems indistinguishable under the allowed
experiments can be separated by a SATEL/HML property. The trace/branching
distinction is established theory; the contribution would be its specific
consequences for SATEL intentions, observations, and execution protocols.

Give distinct meanings to unresolved results caused by computation budgets,
algebraic residuals, insufficient observability, and sampling uncertainty. They
have different remedies and should not be conflated in the paper or GUI.

## 4. Proposed SUT: independent executable software

Levi proposed that the main experimental SUT should be an independently built,
nondeterministic reactive system, not another APN. The APN remains the specification.
APN mutants remain valuable regressions for the testing engine, but are not the
main evidence of applicability to software implementations.

Nondeterminism can represent environmental failures, resource competition,
interactions with users, worker scheduling, retries, and delays. The SUT exposes
methods and selected observations while keeping its implementation state hidden.

One candidate is an order-fulfilment service:

| Method | Public observations | Possible hidden behaviour |
| --- | --- | --- |
| `reserve(items)` | Acceptance/rejection | Concurrent demand and stock contention |
| `pay(order)` | Payment status | Provider failures |
| `dispatch(order)` | Order status | Worker availability and retries |
| `cancel(order)` | Cancellation/refund status | Races with dispatch |
| `receive(order)` | Delivery receipt | Delivery failures and delays |

An allowed environmental failure is not automatically a conformance fault. Payment
rejection may be legitimate; losing reserved stock without releasing it, or
reporting payment success after rejection, may violate the specification.

An LLM can help build these systems. Independence should come from the development
protocol: give the implementation process behavioural requirements and an API
contract, without the APN execution code or generated test cases. An LLM-built
black box is not automatically independent, correct, or realistic.

Separate the public SUT interface from an experimental control interface for
reset, seeds, scheduling, and fault injection. Controls must not silently let the
test-selection algorithm inspect hidden implementation state or force behaviour
outside the stated model. Record exactly which capabilities each experiment uses.

Start with synchronous calls and nondeterministic internal choices. Background
events, asynchronous observations, deadlines, and quiescence require an explicit
extension of the current stimulation/observation execution contract.

## 5. Repeated execution and oracle tracking

Levi proposed Monte Carlo-style repeated executions to exercise black-box
nondeterminism. A proposed campaign would:

1. Select ground parameter values using the reference APN and intention.
2. Reset the SUT to its declared initial configuration.
3. Execute calls and record observations, following an adaptive test strategy
   where later inputs depend on observed outcomes.
4. Repeat under documented environmental scenarios, seeds, and schedules.
5. Accumulate witnesses, counterexamples, and unresolved obligations.

During each execution, track all specification states compatible with its history.
If two reference firings produce the same public observation, retain both
possibilities. Do not reject the SUT because it followed a permitted alternative
to an arbitrarily chosen reference firing.

If no compatible specification execution remains, the trace provides a mismatch
under the declared observation mapping and sufficiently complete reference
exploration. Exhausted reference search cannot justify that verdict.

This is observable execution compatibility, not by itself full HML satisfaction,
bisimulation, or an already-established implementation of a particular standard
conformance relation such as ioco. The paper must choose and define the relation.

## 6. Why pooling traces cannot reconstruct arbitrary HML branching

Consider:

```text
<open>(<cancel>true AND <finish>true)
```

It requires one `open` successor from which both cancellation and completion are
possible. Now suppose a SUT instead chooses between a cancellation-only state and
a completion-only state. Repeated runs can exhibit both `open; cancel` and
`open; finish`, although the formula is false.

Combining runs merely because they share the same visible prefix would invent
branching capabilities that no single successor has. Snapshot/restore can help
preserve state identity without revealing state contents, but reset and prefix
replay do not suffice in general.

Consequently, the execution layer should distinguish:

| Evidence | Appropriate conclusion |
| --- | --- |
| Observed outcome violates an applicable observable requirement | Concrete counterexample |
| Complete execution witnesses a simple existential sequence | Requirement witnessed |
| Repeated runs exhibit no violation | No violation observed in this campaign |
| Required alternatives/state identity cannot be established | Inconclusive branching obligation |

These are examples, not a complete compositional verdict calculus. For arbitrary
nested HML, the required evidence depends on the formula and polarity. A failed
attempt to execute a continuation is not proof that no successful continuation
exists. Timeouts need explicit deadline or quiescence semantics; they are not
automatically mathematical non-enabledness.

Keep HML's intended semantics separate from statistical evidence. A probabilistic
threshold property would be a separately defined requirement, not an implicit
reinterpretation of an existing universal HML property.

## 7. Statistical claims and assumptions

APN nondeterminism gives possible choices, not probabilities. The campaign's
environment and scheduling policies introduce a sampling distribution. Evidence
under that distribution does not cover all schedulers or behaviours it never
exercises. Rare events may need directed fault campaigns; biased campaigns must
not be reported as estimates of an operational distribution without justification.

For a fixed policy and sample size, with independent identically distributed runs
and a reliably detectable per-run violation event, zero violations in N runs gives
the one-sided exact 95% binomial upper confidence bound:

```text
p_upper = 1 - 0.05^(1/N)
```

For N = 1000 this is approximately 0.003, or 0.3%. This concerns the probability of
the observable violation event under that policy. It is not a 95% probability that
an arbitrary HML formula is universally true. Adaptive stopping, dependence,
multiple comparisons, and changing policies require appropriate statistical
methods. Inconclusive HML evaluations cannot simply be counted as successes.

## 8. Experimental evidence needed for a paper

The existing scalability and mutation studies are a useful baseline, not yet an
independent black-box evaluation. Proposed additions:

- An independently implemented SUT with an explicit abstraction/observation mapping.
- Implementation faults such as missing rollback, duplicate processing, incorrect
  retry handling, and race-dependent violations.
- Ablations comparing static partition representatives followed by rejection with
  whole-sequence constraint solving, and sequence-only with branching selection.
- Scaling along active symbolic parameters, multiset alternatives, branching
  depth, and recursive ADT structure, rather than place count alone.
- Results separated by experimental capability and sampling policy.
- Detection effort, observed/inconclusive verdicts, reproducibility, and surviving
  faults, including their causes.

The stock-leak survivor from the current fulfilment experiments is useful evidence
about observation adequacy and test depth. It suggests depletion/refusal tests or
additional permitted observations. Survivors should be analysed, not hidden.

Large models should not be equated with difficult symbolic workloads: the largest
fulfilment benchmark has many places but limited active symbolic variation. See
the scalability report for measured results and scope restrictions.

## 9. Publication positioning and next steps

The discussion assessed the following as plausible, not promised:

- Tool plus correspondence results: a credible tool or focused methods paper.
- A precise testability characterisation as well: a plausible substantial research paper.
- Independent SUT experiments showing the practical consequences: a stronger submission.

Suggested work order:

1. Freeze and document the implemented semantic fragment and observation contract.
2. Compare its concepts with exact definitions in the thesis and closest related work.
3. State correspondence, soundness, and conditional completeness obligations.
4. Define the black-box experiment interface and evidence/verdict semantics.
5. Build one independent synchronous nondeterministic SUT and reproducible campaigns.
6. Evaluate the distinctions through ablations and implementation faults.
7. Extend to asynchronous environments only after their semantics are explicit.

Possible paper structure: problem and motivating example; SATEL fragment and
reference semantics; executable selection; correspondence results; black-box
capabilities and limitations; implementation and evaluation; related work; threats
to validity and conclusions.

This research can clarify what the thesis supports operationally, what requires
additional hypotheses, and what available observations cannot establish. Failure
to implement the full theory is not itself a mathematical falsification of it.

## 10. Initial related-work leads

These sources were identified in a targeted web check during the discussion.
They are starting points, not a systematic review; full-text theorem comparisons
and a complete review of SATEL/CO-OPN, Marre, Péraire, algebraic testing,
conformance testing, and HML testability remain necessary.

1. Levi Pedro Silva Lúcio. *SATEL — A test intention language for object-oriented
   specifications of reactive systems*. PhD thesis, University of Geneva, 2009.
   https://archive-ouverte.unige.ch/unige:2498
2. Marie-Claude Gaudel and Pascale Le Gall. *Testing data types implementations
   from algebraic specifications*. 2008. Algebraic testing, hypotheses and observation.
   https://arxiv.org/abs/0804.0970
3. Raúl López-Rueda, Santiago Escobar and Julia Sapiña. *An Efficient Canonical
   Narrowing Implementation with Irreducibility and SMT Constraints for Generic
   Symbolic Protocol Analysis*. 2023. https://arxiv.org/abs/2307.06348
4. Jaime Arias, Kyungmin Bae, Carlos Olarte, Peter Csaba Ölveczky and Laure Petrucci.
   *A rewriting-logic-with-SMT-based formal analysis and parameter synthesis
   framework for parametric time Petri nets*. 2024. Semantic correspondence,
   symbolic analysis and evaluation precedent; a different net formalism/problem.
   https://arxiv.org/abs/2401.01884
5. TorXakis project. Symbolic model-based testing with SMT, algebraic datatypes
   and strings. https://github.com/TorXakis/TorXakis
6. *Towards Symbolic Model-Based Mutation Testing*. 2012. Symbolic mutation
   testing and nondeterminism. https://arxiv.org/abs/1202.6123
7. *Statistical Model Checking of Black-Box Probabilistic Systems*. CAV 2004.
   https://osl.cs.illinois.edu/publications/conf/cav/SenVA04.html
8. Håkan L. S. Younes and Reid G. Simmons. *Statistical probabilistic model checking
   with a focus on time-bounded properties*. Information and Computation, 2006.
   https://research.google/pubs/statistical-probabilistic-model-checking-with-a-focus-on-time-bounded-properties/
9. *An efficient statistical model checker for nondeterminism and rare events*.
   STTT, 2020. Scheduler sampling and the limitations of random resolution.
   https://doi.org/10.1007/s10009-020-00563-2

No claim is made here that the proposed combination is the first of its kind.
The paper's novelty claim must be narrowed after these comparisons.
