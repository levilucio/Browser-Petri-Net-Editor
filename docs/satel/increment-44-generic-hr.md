# Increment 44: generic HR employee and record bindings

The HR reference now uses **four shared places and 21 transitions**, replacing
72 places and 432 employee/slot-specific transitions. Employee identity, company,
manager, role and record references live in tokens. The same transition structure
supports different employee IDs, roster sizes and reserved-record counts.

Open **Examples → HR management — Reference** for the generic APN, and **HR
management — Expanded benchmark** for the retained comparison. Both preserve the
12-method/six-gate contract and synchronous thesis graphical notation.

The [model builder](../../petri-net-app/src/satel/examples/hr/editor.js) constructs
the generic reference. The [shared intentions](../../petri-net-app/src/satel/examples/hr/intentions.js)
are identical for both representations. The executable tokens use supported
nested Pair values; the custom WorkLog ADT remains in symbolic derivation.

All nine intentions reproduce the original 64 frozen tests exactly. Admission
passes, as do 82 REST and 82 Playwright baseline executions. All seven mutants are
detected through both transports across 1,148 executions, with exactly the earlier
verdict counts and agreeing API/UI events. The two negative-Nat contract errors
remain explicit. A differential test compares both references across 282 calls
with interleaved employees and all correction contribution combinations.

Generic binding required early guard checks, typed constructor-field reduction
and propagation of scalar equalities already entailed by the selected algebraic
class. No unconstrained variable is fixed merely to avoid search. Ground-false
binding prefixes can be excluded from universal refusal constraints, with their
counts shown separately. Regression checks cover wrong Any casts, partial field
computations, pruning-disabled comparisons and the existing symbolic/HML cases.

The isolated benchmark varies markings while keeping the same 21 transitions.
With two slots per record kind, selection completes all 25 work-log classes at
12, 48 and 120 employees. At 256 employees it selects 23 before the 60-second
budget; with eight slots it selects eight. Remaining classes are unresolved,
not infeasible. Algebraic decomposition completes in all configurations. This
benchmark is selection-only; enlarged markings were not subjected to full SUT
campaigns. The expanded model is faster at the small bound on the current engine,
so a smaller graph should not be equated with lower execution cost.

See [full results](../../experiments/hr-management-sut/RESULTS.md), the
[concrete generic source](../../experiments/hr-management-sut/specification/hr.copn),
and the [standalone SUT guide](../../experiments/hr-management-sut/README.md).
The checked evidence ZIP is stored alongside compact result files in the SUT
project. Historical expanded-model results remain clearly separated.

Validation: 1,019 targeted regression tests in 95 suites; seven built-editor
Playwright tests; both Vite builds; targeted refusal UI checks after the explanatory
text update. These are bounded empirical checks, not a universal equivalence proof.
