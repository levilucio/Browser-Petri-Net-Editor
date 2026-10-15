# Continuous execution from the initial marking

Tests now declare one initial marking M₀ and follow a continuous sequence of APN firings. Pair inputs constrain tokens consumed from the current marking. They never inject or replace tokens. Outputs describe production by that firing, including self-loops and repeated identical values. Observing outputs does not remove them. Execution stops at the first blocked pair or mismatch.

## GUI review

1. Load **Examples → SATEL Account — Reference** and open **SATEL → Oracle validation**.
2. Generate the refined suite: four reference tests pass.
3. Each test shows its instantiated initial marking and three pairs. Expand **Marking after pair** to inspect the continuous execution.
4. For Amount(10), initial requests are depositRequest=[10], withdrawRequest=[10], queryRequest=[0], allRequest=[]; the reference internal balance is [0]. Balance evolves [0] → [10] → [0] → [0]. After withdrawal, ack contains [1,1]; the query produces no new ack even though those tokens remain.
5. Load the exact-balance mutant and replay: three tests pass and the equality test fails at pair 2. The other two mutants are also detected by the refined suite. Coarse equations still miss the equality fault.
6. Under **intentions**, the editor offers an optional **Initial marking overrides** field. Unlisted places retain the loaded APN marking; `$variable` references use the same substitution as pairs. Generation records the complete instantiated M₀, so replay starts with the same test setup.

All GUI version labels have been removed. Internal serialized `oracle.type: 'v2'` and existing exported function names remain compatibility details; there is only one supported intention editor/executor.

## Contract and limits

- The account fixture supplies request-token initial values explicitly from each symbolic witness. It preserves the loaded reference's internal marking during generation, then freezes the complete initial marking in the test. Target replay uses that fixed test setup, not the target's default token values.
- Loading the account example also provides a runnable default marking for Amount(10). The test harness selects the specified request at each step; other pending requests may also be enabled. This checks the requested execution, not that it is the only possible ordering.
- The strict account adapter supports singleton Nat input/internal places and accumulated output multisets. Multiple enabled rules for the same requested event remain unsupported errors; pending different requests are permitted.
- General intentions constrain a named transition and its consumed tokens. The existing simulator chooses a matching binding; there is no exhaustive search/backtracking over alternative full executions. General nondeterministic HML satisfaction is not claimed.
- `notEnabled` checks the specified transition/input binding against the current marking, including lack of resources. It neither injects nor fires. A blocked ordinary positive pair fails; blocked/mismatching negative sequences pass, while malformed-model/runtime errors remain errors.
- Bundled banking/manufacturing intentions now state their first-step setup explicitly. Later pairs cannot repair their state. Existing manufacturing partition/path expectations remain unfinished work; oracle admission rejects invalid candidates.
- No full CO-OPN context, port/gate synchronization, or arbitrary editor-ADT translation is added.

## Verification

Regression coverage includes missing requests, wrong token values, repeated consumption, non-first-token binding selection, accumulated outputs, self-loop production, shared initial-marking/pair substitution, disabled-event checks without writes, and malformed initial setups. Existing account reference/mutation and simulator tests are rerun, alongside GUI tests, a production build, and desktop/mobile browser checks.

Results: 600/606 Jest tests pass across 151/154 suites. The six remaining failures are existing manufacturing/path-partition expectations (two path-length assertions, the intention-count assertion, a positive manufacturing case, and two all-fixes assertions); no new failing test names. The 50 focused account/GUI/initial-marking/simulator tests pass, as do the four manufacturing mutation tests. Production build and four desktop/mobile browser checks pass.
