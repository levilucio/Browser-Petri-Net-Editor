# Increment 38 — Browser and worker lifecycle validation

Date: 24 October 2026.

## Outcome

Validated increment 37's owned-query contexts in Chromium, both through Vite's
development server and through a separately bundled test application. Repeated
reference generation, frozen mutant replay, concurrent simulator calls and
cancellation all pass. This increment also fixes three lifecycle defects found
while preparing and running those checks.

The default remains **shared context/full preamble**. Setting
`smtPreambleProjection: true` continues to select owned query contexts. This is a
browser integration and cancellation increment, not a change to selection
semantics or a claim that projection is faster on every workload.

## Actual GUI execution path

`useOracleSession` currently calls `generateIntention` on the main thread. The
standalone `satel-generator.worker.js` is not connected to that GUI hook. The
worker returns the existing candidate-suite envelope, with `oracleValidated:
false`; it does not replace reference admission. Removing its unused simulator
instance does not remove any simulation from the selection pipeline.

Consequently, the new harness tests the main-thread path and worker execution
separately. Its repeated-generation probe calls the real `generateIntention`,
including reference admission, and replays the resulting frozen tests on both
mutants. A separate protocol test exercises the actual candidate generator
worker. The ordinary GUI regression suite continues to exercise the shipped
main-thread flow and its existing default.

## Defects fixed

### Worker Z3 asset loading

The development worker tried to fetch Z3 assets relative to `/src/workers/`.
Vite returned the HTML application fallback; evaluating that response failed with
`Unexpected token '<'`. The initial browser reproduction successfully checked a
main-thread solver but failed worker generation with this error.

`browser-assets.js` now resolves public assets from the Z3 module's URL, above
Vite's `/src/` or `/assets/` directory, preserving a deployment prefix. Unit tests
also cover nested prefixes; the browser runs cover root deployment in development
and bundled form. The loader supplies `locateFile` and `mainScriptUrlOrBlob` as
arguments to Emscripten's modular initialization function. The previous temporary
`globalThis.Module` object was not how this SDK factory consumed configuration.

WASM is loaded as a binary asset. The nested pthread gets the classic Z3 script
URL. The loader retains the existing classic-script evaluation approach required
by this SDK in module workers; this is not a new CSP compatibility guarantee.
The browser fixture does not preload Z3, so these checks exercise initialization
rather than merely reusing an already loaded factory.

### Worker cancellation and overlapping requests

The old worker recognized `AbortError`, while SATEL's domain cancellation uses
`code: 'cancelled'`. A second GENERATE request could also overwrite the shared
abort controller, and an older request's finalizer could clear a newer one.

The extracted `createSatelGenerationHandler` permits one active job. An overlapping
request receives an ERROR with code `busy`; it cannot replace the active job.
An optional `requestId` is echoed on progress and terminal messages and can scope
CANCEL to the intended request. Callers without IDs retain the legacy message
shape. Cancellation suppresses subsequent progress and SUCCESS, recognizes both
cancellation error forms, and returns CANCELLED after the generation promise
settles. The worker can then accept another job.

Cancellation does not forcibly interrupt a native Z3 check. The pending check is
allowed to settle and release its resources. Queued owned requests check the
signal before allocating a native context. A busy worker remains busy during
that cleanup; CANCELLED is the terminal acknowledgment.

### Stale GUI progress

Session results already checked job identity. The `onPhase` callback did not:
a cancelled generation could overwrite the progress text of a newer generation.
It now verifies the active signal and cancellation state before publishing a
phase. A hook regression test covers cancel → restart → late old progress.

## Browser acceptance matrix

The existing String label, List queue and Pair permit APNs from
`src/satel/examples/hml-selection/algebraic.js` are the reference/mutant baselines.
No additional APN examples were needed. Each repeated probe runs ten rounds of
all three examples, alternating query order and the positive/negative HML
properties. Every generated reference test must be admitted, and both the
missing-finish and wrong-value mutants must fail semantically without replay
errors.

After generation, the same runtime executes an SDK solver check, 24 SATEL queries
and eight real account simulator deposits concurrently. The final balance must
be 8 and every SATEL witness must match its requested integer. An additional
case runs main-thread and background-worker probes simultaneously, so runtime
isolation and same-runtime serialization are both exercised.

Each build mode runs eight cases three times, without retries:

| Evidence per build mode | Development | Bundled |
|---|---:|---:|
| Browser cases passed | 24 | 24 |
| Reference generations admitted | 414 | 414 |
| Expected mutant failures | 828 | 828 |
| Concurrent SATEL integer queries | 432 | 432 |
| Native contexts created/deleted in repeated probes | 1,458 / 1,458 | 1,458 / 1,458 |
| Requests cancelled in controlled cancellation probes | 72 | 72 |
| Native contexts created/deleted in cancellation probes | 6 / 6 | 6 / 6 |
| Peak live owned contexts per runtime | 1 | 1 |

Across both modes: **828 reference generations, 1,656 expected mutant failures,
864 concurrent integer witnesses, and 2,928 owned contexts created and released**
(including the cancellation probes). None of the 48 cases failed or required a
retry. The separate shared SDK context is initialized before instrumentation and
is intentionally retained; these counts concern owned native query contexts,
not process memory or browser heap reclamation.

The cancellation probe deliberately holds the first native result behind a
scheduling barrier until an external cancellation arrives. It verifies that the
active request and eleven queued requests report cancellation, exactly one
context is allocated/released, and cancellation never becomes SAT/UNSAT/UNKNOWN.
It is **not a measurement of natural cancellation latency**. The real generator
worker additionally handles overlap, cancellation and successful restart through
ordinary browser messages, without that barrier.

Environment: Chromium 143.0.7499.0, Linux x64, Node v24.22.1, installed Z3 SDK
4.15.3. The public JS/WASM assets match the installed SDK by SHA-256. Chromium was
obtained from `@sparticuz/chromium` 143.0.4 as a temporary test-environment binary
because the standard Playwright browser download failed; no browser dependency
was added to the application. This does not establish Firefox/WebKit, mobile,
or multi-hour browser stability.

Development trials took 50.7 seconds; bundled trials took 47.9 seconds. Other
checks ran concurrently, so these are acceptance-run durations, **not paired
performance measurements or evidence of a speedup**. Increment 37 retains the
controlled scale measurements. Each raw report records per-case results,
per-generation evidence, the browser identity and a source fingerprint.

Raw reports:

- [Development browser trials](performance/increment-38-browser-dev.json)
- [Bundled browser trials](performance/increment-38-browser-built.json)
- [Existing GUI regression results](performance/increment-38-gui.json)

## Reproduction

From `petri-net-app`, with dependencies and Playwright Chromium installed:

```sh
node tools/node/benchmarks/run-browser-lifecycle.js
npx vite build --config vite.satel-test.config.js
node tools/node/benchmarks/run-browser-lifecycle.js --built
npm test -- --runInBand src/__tests__/satel src/__tests__/workers/satel-generation-handler.test.js src/__tests__/utils/z3 src/__tests__/utils/z3-arith.test.js src/__tests__/features/algebraic-simulator.test.js src/__tests__/features/simulator-core.test.js
npx playwright test --config playwright.satel.config.js
npm run build
```

`SATEL_CHROMIUM` optionally points to an existing Chromium executable. The focused
Playwright configuration starts its own loopback server and uses one test worker.
The benchmark driver writes the two versioned reports above, exiting nonzero on
any failing browser case. `dist-satel-test` is a separate ignored build output;
the diagnostic harness and workers are not part of the normal production build.

## Validation and next step

All **732 unit/integration tests in 82 suites** passed (67.64 seconds), covering
SATEL, the worker handler, the relevant simulator and Z3 utilities. The normal
production build passed (8.97 seconds), with existing dependency, sourcemap and
bundle-size warnings. The separate bundled harness build also passed. All **35 existing SATEL GUI
regressions** passed in 1.8 minutes, including the ten exercise APNs with sequences
up to 20 pairs, HML truth/falsity, nondeterminism, refusal companions, black-box
limitations, frozen mutant replay and the intention editor.

The solver's assertions, unfolding bounds, oracle admission, negative-test
selection and UNKNOWN handling are unchanged. These lifecycle checks strengthen
runtime evidence; they are not a proof of complete subuniformity decomposition,
bisimulation, or monotonic bug detection under fixed budgets.

The next useful increment is to connect the GUI's admitted generation pipeline
to a worker through a shared job protocol, preserving progress, partial reports,
cancellation and frozen reference suites. The current standalone worker only
returns candidates, so wiring it directly into the GUI would lose admission
information. Default promotion of owned/projected queries can then be assessed
with the same GUI regression corpus and broader browser coverage; no extra
solver options need to appear in the intention editor.
