# Increment 43: HR management, two transports and recursive ADT stress

Historical expanded-model experiment. [Increment 44](increment-44-generic-hr.md)
replaces the default HR reference with generic employee/record bindings and retains
this model as a benchmark. The old measurements are in
[EXPANDED_RESULTS.md](../../experiments/hr-management-sut/EXPANDED_RESULTS.md).

Branch: `codex/satel-hr-stress`, based on `codex/satel-methods-gates`.

The [standalone HR SUT](../../experiments/hr-management-sut/README.md) implements
employee work records, five work types, manager approvals/declines, vacation
balances, HR corrections and audit history across two companies. A real Python
HTTP backend stores all state in SQLite and serves an independent browser UI.
The deterministic seed contains 256 staff, 7,680 time records and 512 historical
vacation requests. The SUT itself has no editor or SATEL dependency.

The [HR model builder](../../petri-net-app/src/satel/examples/hr/editor.js) creates
72 places, 432 transitions, 1,872 arcs, 12 methods and six gates. It retains the
synchronous input/output convention and thesis graphical syntax. The bounded
marking represents 12 staff and two records of each kind per person in November;
it does not unfold every historical database row into the APN.

Open **Examples → HR management — Reference** and **SATEL → APN source** to inspect
the class syntax. **Generated tests** admits 25/25 tests for the initial recursive
work-log intention. Eight further intentions cover vacation workflows, role and
company restrictions, and the modeled employee roster. A [concrete source
snapshot](../../experiments/hr-management-sut/specification/hr.copn) is included.

Nine intentions generate 64 admitted tests. Negative formulas also exercise
positive prefixes, producing 82 experimental executions per transport. API and
Playwright adapters independently implement the same public contract; the browser
adapter signs in and interacts with actual frontend controls for every test step.
Only fixture reset uses a test-only API. Each campaign owns a separate database.

The unmutated baseline passed 82/82 REST and 82/82 UI executions. Seven backend
mutants were then tested with frozen suites, totaling 1,148 executions. All seven
produce mismatches through both transports; all recorded verdicts and events
agree. Double charging also produces one Nat-contract error per transport when a
long vacation yields a negative balance. It remains an error in the evidence.

The larger model exposed a selection-budget bottleneck. Conservative ground-false
method-guard pruning and skipping empty-bag matches reduce the work-log search to
5,723 visits within the default 10,000 limit. Symbolic uncertainty and negative
refusal obligations remain. Gate-edge routing now avoids redundant corridor and
endpoint work, preserving the existing presentation.

Recursive WorkLog unfolding resolves known lengths one and two into 5 and 25
classes. Lengths three through five and unknown-shape recursion retain unresolved
branches under the five-second soft budget; larger known-shape cases accumulate
thousands of unproved overlap checks. All 769 emitted witnesses pass an independent
calculation. Partial outputs do not establish disjoint partitions or coverage.

See the complete [results and limitations](../../experiments/hr-management-sut/RESULTS.md)
for mutation counts, the ten-configuration/twenty-trial stress table, remaining
budget-accounting issues, authoring/harness fixes and validation. The independent
SUT can be copied to `C:\Users\levil\cursor\hr-management-sut`; the downloadable
package also contains a preloaded DB and full frozen suites/replay traces.

Validation: 9 Python tests, 1,015 targeted editor/SATEL tests in 95 suites, both
Vite builds, and 6 built-editor Playwright tests. Five layout unit tests were
rerun after the routing optimization. These are bounded empirical checks, not a
general equivalence or coverage proof.
