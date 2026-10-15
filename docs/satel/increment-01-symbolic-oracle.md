> Historical increment: per-step injection/draining and GUI version labels described below have been superseded by [continuous initial-marking execution](increment-03-initial-marking.md).

# Increment 1: symbolic subuniformity and oracle-validated tests

This is the first reviewable implementation slice: unfold ADT operation equations,
choose a witness per symbolic subdomain, validate the resulting tests against the
reference APN, and replay those fixed tests on mutated APNs.

The entry point is a CLI and an exported API. The existing SATEL browser panel
still uses the legacy generator. This increment does not claim to repair that
pipeline or to implement full CO-OPN.

## Run and review

From the repository root:

```sh
cd petri-net-app
npm ci
npm run satel:oracle-example
npm test -- --runInBand --runTestsByPath src/__tests__/satel/symbolic-oracle-increment.test.js
```

For machine-readable evidence (including source equations, constraints, witnesses,
expected observations, reference traces, and mutation mismatches):

```sh
node tools/node/run-satel-oracle-example.js --json > satel-oracle-results.json
```

Review the model in `src/satel/examples/oracle-account/algebra.js` first, then the
APN in `net.js`, and finally the reported concrete tests. The useful review
questions are whether the symbolic decomposition is appropriate, whether the
public observations express the intended account behavior, and whether the
supported subset is a suitable base for the next increment.

## The example and its symbolic decomposition

The request ADT has two constructors:

```text
Request = All | Amount(Nat)
Reply = Paid(Nat) | Refused(Nat)
WithdrawalResult = Result(Nat, Reply)
```

The symbolic operation definitions are:

```text
affordable(n, b) = true   if n < b
affordable(n, b) = true   if n = b
affordable(n, b) = false  if n > b

withdraw(b, All)       = Result(0, Paid(b))
withdraw(b, Amount(n)) = Result(b - n, Paid(n))
                         if affordable(n, b) = true
withdraw(b, Amount(n)) = Result(b, Refused(n))
                         if affordable(n, b) = false
```

For the fixed sequence **deposit 10; withdraw request; query balance**, the
symbolic goal is `withdraw(10, request)`. Constructor-pattern unification and
unfolding `affordable` yield the following subdomains before any APN execution:

| Symbolic request | Constraint | Chosen witness | Withdrawal observation | Final balance |
|---|---|---|---|---:|
| `All` | true | `All` | paid 10 | 0 |
| `Amount(n)` | `0 <= n < 10` | `Amount(1)` | paid 1 | 9 |
| `Amount(n)` | `n = 10` | `Amount(10)` | paid 10 | 0 |
| `Amount(n)` | `10 < n <= 2147483647` | `Amount(11)` | refused | 10 |

The arithmetic ceiling is the current simulator's supported integer
representation. No values or reachable states are enumerated to discover these
subdomains. The implementation also decomposes a balance of one billion directly
in its regression checks.

Subdomains retain constructor patterns, residual constraints, equation IDs,
symbolic results, and concrete witnesses. Witness selection prefers Nat 1 when
feasible, otherwise the least admissible lower bound. This policy is separate
from decomposition. Contradictory branches are recorded as infeasible.

The less-than and equality tests fire the **same APN transition sequence**. Their
distinct subdomains come from the operation equations. This is the key difference
from grouping executions by their transitions or path lengths.

## How oracle admission works

1. Derive symbolic subdomains from the constructor signatures and equations.
2. Solve each supported constraint system and instantiate its equation result.
3. Encode the constructor witness as public APN requests, and the equation result
   as expected public observations.
4. Execute the requests against a fresh reference APN. Reject blocked candidates.
5. Replay the test with its expected observations on another fresh reference APN.
   Admit it only if every observation matches. Any failure stops suite generation;
   candidates are not silently discarded.
6. Freeze the admitted stimuli, expected observations and provenance. Run precisely
   those tests against each mutant, without regenerating expectations.

Expected observations for the selected tests come from the symbolic equations,
not from accepting whatever the APN happened to produce. An incorrect equation
result or a mismatch between the equations and the APN fails admission. The
tests also pin account behavior independently at zero, equality, refusal and All.

The adapter encodes `Amount(n)` as a withdrawal request carrying `n`, and `All`
as a separate public request. `Paid(n)` is observed through acknowledgment 1 and
the paid amount; refusal through acknowledgment 0 and no payment. A subsequent
query observes the resulting balance. Deposit acknowledgment is checked too.
Every step checks every declared output, including expected empty outputs.

Tests inject tokens only into public input places. They do not overwrite internal
balance or prescribe which transition should fire. Outputs are observed and
drained after each step, so repeated acknowledgments are distinct events.
Internal transition IDs are diagnostic evidence and are not verdict criteria.

## Mutation results

The same reference APN is used for both decompositions. A coarser, semantically
equivalent definition of `affordable` uses just `n <= b` and `n > b`, yielding
three representatives: All, Amount(1), and Amount(11).

| Mutation | Refined equations: 4 tests | Coarse equations: 3 tests | Audit: Amount(0..12) |
|---|---|---|---|
| Accepted withdrawal does not debit balance | Killed at balance query | Killed | Killed |
| Refused withdrawal resets balance | Killed at balance query | Killed | Killed |
| Exact-balance withdrawal is refused | Killed at withdrawal | Survived | Killed |

All four refined tests and all three coarse tests pass reference validation.
The finite audit sample is an additional diagnostic experiment, not a source of
symbolic subdomains. It has its own reference validation.

The equality refinement detects a fault missed by the coarse uniformity
hypothesis. Passing representatives still does not establish correctness for
every member of a subdomain or for an arbitrary implementation. These three
mutants are examples, not a complete fault model.

Verdicts distinguish `pass`, observable `fail`, and execution/model `error`.
A blocked request on a well-formed supported target is a failure. A malformed
model, unsupported construct or nondeterminism is an error. A mutant with any
execution errors is reported as `error`, never counted as killed.

## Supported subset and remaining work

| Area | This increment | Deliberately outstanding |
|---|---|---|
| Algebra input | Explicit structured constructor signatures and typed operation equations | Importing the editor's ADT/axiom syntax and SATEL intentions |
| Symbolic analysis | Constructor-pattern unification, substitutions, conditional operation unfolding, equation provenance | General conditional narrowing, arbitrary operation composition and recursive ADT completion |
| Constraints | Conjunctions of unary Nat intervals/equalities and ground Bool comparisons | General multivariable/nonlinear constraints and residual solver goals |
| Unfolding limits | Explicit maximum depth; exhaustion raises an error | Retaining partially unfolded goals with a richer constraint solver |
| Specification conditions | Ill-sorted/free variables and overlapping feasible subdomains rejected | A general proof of constructor completeness, termination or confluence |
| Execution | Existing AlgebraicSimulator, synchronous numeric APN, at most one token per place and one enabled rule per request | Nondeterminism, concurrent bindings, silent transitions, multisets and recursive ADT tokens |
| Test shape | Fixed setup/withdraw/query; supplied public adapter; positive observation tests | Symbolic propagation across arbitrary event sequences, negative HML tests, recursive intentions |
| Product integration | CLI, reusable core exports, detailed JSON evidence | Browser-panel wiring and replacement of legacy generation/execution |

The source equations are assumed to describe the intended operation completely.
The account example's cases exhaust its two constructors and numeric comparison
cases, but the engine does not establish general specification completeness.
Overlapping definitions currently cause rejection rather than nondeterministic
oracle construction. Constructor symbols are treated as free and distinct;
quotient equations between constructors are unsupported.

The symbolic goal's balance 10 is explicitly tied to the deposit-10 setup by the
example adapter. There is no claim that this increment automatically extracts
that relationship from an arbitrary sequence. The equations and numeric APN are
separate representations: the admission checks verify agreement on selected
witnesses, not a general refinement theorem.

The numeric adapter explicitly validates its small arithmetic fragment and
cross-checks enabled transitions and resulting markings with the simulator.
This prevents legacy simulator fallbacks from silently turning unsupported
expressions into passing tests. It does not establish correctness of the whole
simulator. Nat is restricted to 0..2147483647 to avoid its integer coercion;
overflow and subtraction outside that domain are errors.

## Reading that informed the design

- Cécile Péraire, *Formal Testing of Object-Oriented Software: From the Method to
  the Tool*, EPFL thesis 1904 (1998), §§5.4.1–5.4.4, especially pp. 116–118.
  Her construction separates constraint-system derivation, solving and
  instantiation. The comparison example explains why unfolding can distinguish
  equality from strict inequality even when both satisfy a condition.
  [Official record](https://doi.org/10.5075/epfl-thesis-1904);
  [author-uploaded full text consulted](https://www.researchgate.net/publication/36374045_Formal_testing_of_object-oriented_software_from_the_method_to_the_tool).
- Bruno Marre, *LOFT: A Tool for Assisting Selection of Test Data Sets from
  Algebraic Specifications* (1995), pp. 799–800. Its controlled unfolding returns
  substitutions and residual constraints before representative selection.
  [DOI](https://doi.org/10.1007/3-540-59293-8_240);
  [author-uploaded paper consulted](https://www.researchgate.net/publication/220917230_LOFT_A_Tool_for_Assisting_Selection_of_Test_Data_Sets_from_Algebraic_Specifications).
- Marre's 1991 thesis, *Une méthode et un outil d'assistance à la sélection de jeux
  de tests à partir de spécifications algébriques*, was identified in the
  [thesis catalogue](https://theses.fr/1991PA112052). Its full text was not obtained;
  the implementation is not presented as a reproduction of that thesis or LOFT.

These sources motivate the direction. The restricted algorithm and all engineering
choices described here are this increment's implementation choices.

## Verification

Verified on Node 24.19.0 against SATEL base commit
`50ec61d7a8ed49c8f8a9e0a8b23c7fb1b7def771`:

- The executable example produces the four reference passes and mutation matrix
  above, including the coarse decomposition's boundary survivor.
- All 15 new focused tests pass.
- Production build passes.
- Full Jest run: 597 passed, 9 failed, 606 total; 151 of 155 suites pass.
  The same nine failures in the same four legacy suites occur on the base
  (582 passed, 9 failed, 591 total). There are no new failures. Those baseline
  suites are `all-fixes`, `path-subuniformity`, `manufacturing-v2`, and
  `manufacturing-mutations`.

## Suggested next review boundary

After this slice is reviewed, connect constructor/operation definitions from the
editor to this representation and expose the symbolic subdomains and oracle
admission results in the SATEL panel. Keep the same account example as an end-to-end
regression. Broader constraint solving and symbolic propagation through multiple
events can then be separate increments. Full CO-OPN is not a prerequisite.
