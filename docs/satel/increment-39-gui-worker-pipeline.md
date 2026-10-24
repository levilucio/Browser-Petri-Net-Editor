# Increment 39 — GUI generation, admission and replay in a worker

Date: 24 October 2026.

## User-visible change

The SATEL panel now runs test generation, concrete reference admission, bounded
negative-companion selection and frozen-suite replay in a dedicated worker when
the browser supports workers. The existing buttons and intention syntax are
unchanged. CPU-heavy selection and replay no longer execute on the editor's main
thread, although preparing messages and rendering reports still do.

The worker is created lazily, reused across successful runs and tab changes, and
released when the SATEL panel closes. Closing or cancelling an active job stops
it. Reopening preserves the saved session, including the frozen reference suite,
and creates a new worker only when another operation is requested.

The solver default is still shared context/full preamble. This increment enables
background execution in the GUI; it does not enable SMT declaration projection
or change solver budgets.

## One semantic pipeline across execution locations

`useOracleSession` uses `createSatelClient` rather than calling core functions
directly. The client sends data snapshots and serializable options to the worker.
Signals and callbacks remain in the caller and are represented by protocol
messages. The worker delegates to the same existing core functions:

| Request | Core operation | Result |
|---|---|---|
| `GENERATE_INTENTION` | `generateIntention` | Selection report and, after successful admission, the validated suite |
| `REPLAY` | `evaluateOracleSuite` | Verdicts/counterexamples against the saved expectations |
| `GENERATE` | `generateTestSuite` | Existing candidate-only envelope, explicitly unvalidated |

The last operation remains compatible with the standalone worker API. The GUI
uses the first two. There is no separate worker implementation of ADT unfolding,
whole-sequence constraint solving, negative selection, HML evaluation or oracle
admission.

`createSatelJobHandler` supplies the shared single-job protocol. Phase, selection,
validation and ordinary progress messages carry the request ID. Selection reports
are cloned at publication time, including intermediate reference-validation
results. When admission fails, the already published report remains inspectable;
a SUCCESS message containing a validated suite is never synthesized by the
transport layer. Class-only generation still returns a report without a suite.

Structured clone removes frozen property descriptors. The client recursively
freezes each returned suite again, including its saved reference net, selected
tests and observations. Target replay receives the saved tests/interface and a
snapshot of the currently loaded target. Loading a mutant never regenerates the
reference expectations.

## Cancellation and ownership

The GUI client owns one worker and one active request. Cancel or close terminates
the worker, detaches its handlers, rejects the active request with the domain's
`cancelled` code, and clears the active slot immediately. The next run can start
with a fresh worker without waiting for a solver check or synchronous JavaScript
search in the old runtime. Old messages are rejected by both worker identity and
request ID; the hook also retains its existing active-job publication checks.

This is deliberately different from the standalone worker's cooperative CANCEL
message, which still waits for its operation to settle before acknowledging
cancellation. The GUI destroys the entire execution environment: it does not
release a native context while a solver thread could still access it. Browser
worker teardown owns disposal of that environment. These tests do not measure
when browser process RSS or WASM backing-store capacity is reclaimed.

The panel previously remained mounted while visually closed. It now passes its
open state to the session hook so closing actually disposes the client. Saved
session state remains in the parent panel and is not cleared by disposal.

If no browser Worker API is available, the client uses the same core functions
locally, with the existing cooperative signal checks. Startup, message-cloning,
worker-crash and response-decoding failures are surfaced as errors. They do not
trigger an automatic local retry, produce a test verdict, or count as a detected
mutant. A subsequent user-requested run can create a fresh worker.

The Jest factory guard also avoids confusing Z3's Node `worker_threads` global
with the browser Worker API. This was found by the GUI unit regressions after
Z3 initialization followed by panel close/reopen. The real browser path remains
covered by Playwright.

## Validation

The new browser checks compare direct and worker results for the existing String
label, List queue and Pair permit examples, a finite explicit List intention,
and thermostat negative companions. They compare admitted tests, class
patterns/conditions/rule paths and negative-selection evidence; every remote
suite is also replayed on its reference. They verify recursively frozen suites,
phase/selection delivery, class-only results, a blocked admission with its partial
report, a bounded unresolved decomposition, and successful recovery on the same
worker.

A GUI lifecycle test deliberately holds a real worker's WASM initialization
request, cancels through the Cancel button, and then releases the held request.
It checks that the abandoned worker publishes no SUCCESS, a new worker generates
the admitted suite, replay reuses that worker, closing terminates it, and reopening
can replay the retained suite. This is a controlled cancellation test, not a
measurement of native solver interrupt latency.

Another browser check blocks the worker script itself. The GUI must show an error
and no reference-admission claim, then recover on an explicit retry. Unit tests
add transport/decode failures, duplicate requests, already-cancelled signals,
disposal, stale messages, fallback callbacks and nested suite immutability.

The full GUI corpus retains the existing APNs and mutants, including the ten
exercise models with sequences from 2 to 20 pairs, compound guards, custom ADT
frontiers, HML truth/falsity, nondeterministic alternatives, refusal companions,
black-box observability limits and editable intentions. Increment 38's eight
lifecycle cases also run against the updated protocol.

All **750 unit/integration tests in 84 suites** passed (72.98 seconds). All
**46 browser tests passed in development and all 46 passed in the bundled build**,
without retries: 35 existing GUI regressions, eight lifecycle checks and three new
worker-session checks in each mode. The normal production build passed in 7.91
seconds, and the separate bundled harness build passed in 8.29 seconds, with the
existing dependency, sourcemap and bundle-size warnings.

These runs used Chromium 143.0.7499.0 on Linux x64, Node v24.22.1 and Z3 4.15.3.
They do not establish Firefox/WebKit or mobile coverage. Acceptance jobs ran
concurrently; their durations are not controlled performance comparisons.

- [Development results](performance/increment-39-worker-session-dev.json)
- [Bundled results](performance/increment-39-worker-session-built.json)

The reports retain every test status, the structured browser attachments for
lifecycle/pipeline comparisons, and a fingerprint of the source and test files.


## Reproduction and laptop review

From `petri-net-app`:

```sh
npm test -- --runInBand src/__tests__/satel src/__tests__/workers src/__tests__/utils/z3 src/__tests__/utils/z3-arith.test.js src/__tests__/features/algebraic-simulator.test.js src/__tests__/features/simulator-core.test.js
npx playwright test --config playwright.satel.config.js
npx vite build --config vite.satel-test.config.js
SATEL_BUILT=1 npx playwright test --config playwright.satel.config.js
npm run build
```

The bundled command uses POSIX environment syntax. In PowerShell, set
`$env:SATEL_BUILT = '1'` before the Playwright command and remove it afterwards
with `Remove-Item Env:SATEL_BUILT`. `SATEL_CHROMIUM` can optionally name an installed
Chromium executable. The test harness stays in the separate ignored
`dist-satel-test` output; the ordinary production build contains the real SATEL
worker and no diagnostic harness.

For manual review, pull `codex/satel-public-methods`, run `npm ci` and `npm run dev`,
then load **SATEL Account — Reference** and generate tests. Cancel/restart a run,
switch to Replay results, or close/reopen SATEL and load its exact-balance mutant.
The saved reference suite should survive and report the existing mutant failure.
Use the **Sensor journal** exercise for a 20-pair sequence and the **HML ADT
selection** examples for branching properties. No new editor option is required.

## Limits and next step

Moving execution to a worker preserves the semantic core; it is not a proof that
bounded searches always choose identical witnesses or finish with identical
outcomes under time limits. Runtime history, startup cost and scheduling can
still affect Z3's heuristics. Existing independent witness validation and
reference admission remain mandatory, and unresolved searches remain visible.

Full selection reports are currently cloned on each published validation update.
That preserves the existing report semantics but may become expensive for very
large suites. The next useful measurement is end-to-end GUI responsiveness and
report-transfer volume on the larger APNs, followed by coalescing or incremental
report updates if those measurements justify it. Keep final admission and error
reports lossless. Broader browser coverage and a separate default-policy decision
remain appropriate before enabling owned/projected queries globally.
