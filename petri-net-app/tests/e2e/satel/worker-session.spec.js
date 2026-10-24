import { test, expect } from '@playwright/test';
const harness = '/tests/e2e/satel/fixtures/lifecycle.html';

async function traceWorkers(page) {
  await page.addInitScript(() => {
    window.satelWorkerTrace = [];
    const OriginalWorker = window.Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes('satel-generator.worker')) {
          this.record = { terminated: false, events: [], requests: [] };
          window.satelWorkerTrace.push(this.record);
          this.addEventListener('message', ({ data }) => this.record.events.push({ type: data.type, requestId: data.requestId, admitted: data.payload?.suite?.oracleValidated }));
        }
      }
      postMessage(data, ...rest) { this.record?.requests.push(data.type); return super.postMessage(data, ...rest); }
      terminate() { if (this.record) this.record.terminated = true; return super.terminate(); }
    };
  });
}
async function loadAccount(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find an example' }).fill('SATEL Account');
  await page.getByTestId('example-oracle-account-reference').click();
  await page.getByTestId('toolbar-satel').click();
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
}

test('full worker pipeline agrees with direct generation and preserves frozen suites and negative companions', async ({ page }, info) => {
  await traceWorkers(page);
  await page.goto(harness); await page.waitForFunction(() => window.satelLifecycle);
  const result = await page.evaluate(async () => {
    const h = window.satelLifecycle, client = h.client(), rows = [];
    const summary = result => ({
      validation: result.suite.validation,
      tests: result.suite.selectedTests.map(t => ({ id: t.id, pairs: t.pairs, formula: t.formula, expectedTruth: t.expectedTruth })),
      domains: result.report.decomposition?.domains.map(d => ({ id: d.id, patterns: d.patterns, conditions: d.conditions, rules: d.rules })),
      negatives: result.suite.negativeSelection
    });
    try {
      for (const kind of ['string', 'list', 'pair', 'negative', 'explicit']) {
        const net = kind === 'negative' ? h.exercise('exercise-thermostat-reference') : h.example(`hml-adt-${kind === 'explicit' ? 'list' : kind}-reference`);
        let intention = net.testIntentions[0];
        if (kind === 'explicit') intention = { id: 'explicit-open', name: 'Explicit list', testType: 'positive', variables: [], pairs: [{ stimulation: { method: 'open', arguments: { x: [3] } }, observation: { outputs: { ack: [true] } } }] };
        const phases = [], reports = [], options = { includeNegative: kind === 'negative' };
        const local = await h.generateIntention(intention, net, options);
        const remote = await client.generate(intention, net, { ...options, onPhase: p => phases.push(p), onSelection: r => reports.push(r) });
        const replay = await client.replay(remote.suite.selectedTests, net, remote.suite.interface);
        rows.push({ kind, local: summary(local), remote: summary(remote), phases, reportCount: reports.length,
          frozen: Object.isFrozen(remote.suite) && Object.isFrozen(remote.suite.referenceNet.places) && Object.isFrozen(remote.suite.selectedTests[0]), replay: replay.counts });
      }
      const net = h.account('oracle-account-reference'), reports = [];
      const classes = await client.generate(net.testIntentions[0], net, { classesOnly: true });
      // Ordinary semantic admission failure, not a transport failure. Keep the report.
      const broken = structuredClone(net); Object.assign(broken.places.find(p => p.id === 'balance'), { valueTokens: [], tokens: 0 });
      let error;
      try { await client.generate(broken.testIntentions[0], broken, { onSelection: r => reports.push(r) }); }
      catch (e) { error = { code: e.code, message: e.message }; }
      let unresolvedError, unresolvedReport;
      try { await client.generate(net.testIntentions[0], net, { maxBranches: 1, onSelection: r => { unresolvedReport = r; } }); }
      catch (e) { unresolvedError = e.message; }
      const recovery = await client.generate(net.testIntentions[0], net);
      return { rows, classesOnly: !classes.suite && !!classes.report.decomposition, failure: { error, reports: reports.length }, unresolved: { error: unresolvedError, branches: unresolvedReport?.decomposition?.unresolved?.length }, recovered: recovery.suite.validation };
    } finally { client.dispose(); }
  });
  for (const row of result.rows) {
    expect(row.remote).toEqual(row.local);
    expect(row.frozen).toBe(true); expect(row.reportCount).toBeGreaterThan(0);
    expect(row.replay.error).toBe(0); expect(row.replay.fail).toBe(0);
    expect(row.phases).toContain('Validating every candidate from the reference initial marking…');
  }
  expect(result.rows.find(r => r.kind === 'negative').remote.negatives.candidates.length).toBeGreaterThan(0);
  expect(result.classesOnly).toBe(true); expect(result.failure.error.message).toContain('Reference validation failed');
  expect(result.unresolved.branches).toBeGreaterThan(0); expect(result.unresolved.error).toMatch(/unresolved/i);
  expect(result.failure.reports).toBeGreaterThan(0); expect(result.recovered.referencePassed).toBe(4);
  const trace = await page.evaluate(() => window.satelWorkerTrace);
  expect(trace).toHaveLength(1); expect(trace[0].terminated).toBe(true);
  await info.attach('full-worker-pipeline', { body: JSON.stringify({ result, trace }), contentType: 'application/json' });
});

test('GUI cancels an initializing worker, restarts, reuses it, and releases it on close', async ({ page }, info) => {
  await traceWorkers(page); await loadAccount(page);
  let release, started;
  const held = new Promise(resolve => { release = resolve; });
  const loading = new Promise(resolve => { started = resolve; });
  await page.route('**/z3-built.wasm', async route => { started(); await held; await route.continue().catch(() => {}); });
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await loading; // A real worker is initializing its native runtime.
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => window.satelWorkerTrace[0].terminated)).toBe(true);
  release(); await page.unroute('**/z3-built.wasm');
  await expect(page.getByRole('button', { name: 'Generate tests', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible({ timeout: 45000 });
  await page.getByRole('button', { name: 'Replay results', exact: true }).click();
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect(page.getByTestId('oracle-target-results')).toContainText('4 passed · 0 failed · 0 errors');
  let trace = await page.evaluate(() => window.satelWorkerTrace);
  expect(trace).toHaveLength(2);
  expect(trace[0].events.some(e => e.type === 'SUCCESS')).toBe(false);
  expect(trace[1].requests).toEqual(['GENERATE_INTENTION', 'REPLAY']);
  expect(trace[1].events.some(e => e.type === 'SELECTION')).toBe(true);
  expect(trace[1].events.some(e => e.admitted === true)).toBe(true);
  await page.getByLabel('Close SATEL').click();
  expect(await page.evaluate(() => window.satelWorkerTrace[1].terminated)).toBe(true);
  await page.getByTestId('toolbar-satel').click();
  await expect(page.getByText(/4 frozen tests from/)).toBeVisible();
  await page.getByRole('button', { name: 'Replay frozen suite on loaded APN' }).click();
  await expect.poll(() => page.evaluate(() => window.satelWorkerTrace.length)).toBe(3);
  await expect(page.getByTestId('oracle-target-results')).toContainText('4 passed · 0 failed · 0 errors');
  trace = await page.evaluate(() => window.satelWorkerTrace);
  await info.attach('gui-worker-lifecycle', { body: JSON.stringify(trace), contentType: 'application/json' });
});

test('GUI surfaces worker startup failure and permits a fresh retry without claiming a test failure', async ({ page }) => {
  await traceWorkers(page); await loadAccount(page);
  const workerScript = /satel-generator\.worker.*\.js/;
  await page.route(workerScript, route => route.abort());
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/worker/i);
  await expect(page.getByText(/tests passed the reference oracle/)).toHaveCount(0);
  expect(await page.evaluate(() => window.satelWorkerTrace.length)).toBe(1);
  await page.unroute(workerScript);
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('4/4 tests passed the reference oracle')).toBeVisible({ timeout: 45000 });
  expect(await page.evaluate(() => window.satelWorkerTrace.length)).toBe(2);
});
