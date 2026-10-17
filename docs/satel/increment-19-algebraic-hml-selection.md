# Increment 19 — Joint HML selection with built-in algebraic values

Implemented 17 October 2026 on `codex/satel-public-methods`, originally committed
locally as `c181c70` after the published increment 18 (`4454954`). Workspace
maintenance subsequently removed that unpushed checkout. The tested source was
recovered from retained compiler source maps and regression-checked before the
scalability experiments. This restored report summarizes the implementation;
it does not claim recovery of the original commit object or byte-identical prose.

Joint sequence/HML selection supports Nat, Int, Bool, String, List and Pair.
One substitution satisfies the protocol and additional property together from
the model's initial marking. Expected-false requirements constrain the negated
property. Concrete reference admission remains mandatory and mutant replay
retains the selected values.

`HmlTerms.js` reads the canonical prepared built-in equations. Constructor tests,
guarded field projections and conditional expressions retain a separate
condition for definedness. Empty-list head and incorrect Any projections cannot
be mistaken for refusals. Boolean and HML short-circuit behavior is preserved.
The existing SMT adapter handles completed constructor, arithmetic and string
constraints. Static subuniformity class derivation is unchanged.

The HML unknown-constructor unfolding allowance defaults to four, configurable
programmatically with `maxHmlUnfoldingDepth` (1–32). Known constructor spines are
bounded by construction work; ground reduction has a 1,000-step cap. Residual
calls do not establish infeasibility when no witness is found. Custom ADTs are
supported in algebraic analysis, but public APN methods still execute built-in
sorts only. Full CO-OPN and unbounded bisimulation are not implemented.

In **Examples**, search **HML ADT selection**. The String label, List queue and
Pair permit references each have an expected-true and an expected-false
intention, plus missing-finish and wrong-value mutants. Generate in **SATEL →
Generated tests**, inspect **Why this test was selected**, then load a matching
mutant and replay the frozen suite. The measured examples selected `"ok"`, `[3]`
and `(3, true)`; exact model choices are not guaranteed.

Prior verification: 371 SATEL tests, six desktop/mobile browser scenarios and
production build passed. The retained [smoke record](performance/hml-adt-selection-2026-10-17.json)
records six generated intentions and twelve mutant replays. Recovery was checked
against the focused scalar/ADT HML and ten-family reference/mutant tests.

See [increment 20](increment-20-scalability.md) for the subsequent scalability
study, realistic workload abstractions, solver diagnostics and measured limits.
