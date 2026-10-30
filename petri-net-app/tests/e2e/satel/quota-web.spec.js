import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

async function openQuotaSuite(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Examples', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find an example' }).fill('Methods & gates');
  await page.getByTestId('example-gates-exercise-quota-reference').click();
  await page.getByTestId('toolbar-satel').click();
  await page.getByRole('button', { name: 'Generated tests', exact: true }).click();
  await page.getByRole('button', { name: 'Generate tests', exact: true }).click();
  await expect(page.getByText('3/3 tests passed the reference oracle')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Black-box runs', exact: true }).click();
  await page.getByLabel('Black-box repetitions', { exact: true }).selectOption('1');
}

test('generated quota suite drives the real web UI and exposes three implementation faults', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openQuotaSuite(page);
  const evidence = [];
  for (const [variant, step] of [['reference', null], ['wrong-reservation', 2], ['lost-release', 4], ['wrong-audit', 2]]) {
    await page.getByLabel('Black-box system', { exact: true }).selectOption(`quota-web-${variant}`);
    if (variant === 'reference') {
      await expect(page.frameLocator('iframe[title="Quota web SUT"]').getByRole('button', { name: 'Audit', exact: true })).toBeEnabled();
      await page.getByTitle('Quota web SUT').scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('quota-web-app.png') });
    }
    await page.getByRole('button', { name: 'Run black-box campaign' }).click();
    const summary = page.getByTestId('black-box-summary');
    await expect(summary).toContainText(variant === 'reference' ? '3 compatible executions · 0 observable mismatches' : '0 compatible executions · 3 observable mismatches', { timeout: 30000 });
    await expect(summary).toContainText('0 incomplete executions · 0 errors');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download campaign evidence' }).click();
    const download = await downloadPromise;
    const saved = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    expect(saved.tests).toHaveLength(3);
    expect(saved.report.runs).toHaveLength(3);
    for (const run of saved.report.runs) {
      if (variant === 'reference') {
        expect(run.events).toHaveLength(16);
        expect(run.events.at(-1).response.outputs).toEqual({ eligible: [], ack: [], free: [10], reserved: [0] });
      } else {
        expect(run.step).toBe(step); expect(run.reasonCode).toBe('unexpected-output');
        expect(run.events.at(-1).stimulation.method).toBe('audit');
      }
      expect(run.events.every(event => !('marking' in event) && !('transitionId' in event))).toBe(true);
    }
    evidence.push({ variant, ...saved });
    if (variant === 'lost-release') {
      await summary.scrollIntoViewIfNeeded();
      await page.screenshot({ path: info.outputPath('quota-web-mismatch.png') });
    }
  }
  expect(errors).toEqual([]);
  await fs.writeFile(info.outputPath('quota-web-campaigns.json'), JSON.stringify(evidence, null, 2));
});

test('browser completion, refusal, serialization, timeout and cancellation respect the adapter contract', async ({ page }) => {
  await page.goto('/tests/e2e/satel/fixtures/lifecycle.html');
  await page.waitForFunction(() => window.quotaBrowserHarness);
  const result = await page.evaluate(async () => {
    const h = window.quotaBrowserHarness;
    const frame = document.createElement('iframe'); document.body.append(frame);
    const baseURL = new URL('/', location.href).href;
    const create = variant => h.createQuotaBrowserSystem({ frame, variant, baseURL });
    const sut = create('reference');
    await sut.reset();
    const call = (method, args = {}) => ({ method, arguments: args });
    const pending = sut.invoke(call('reserve', { n: 4 }));
    const concurrent = await sut.invoke(call('audit')).then(() => null, e => e.code);
    const reserved = await pending;
    const audit = await sut.invoke(call('audit'));
    const refused = await sut.invoke(call('release', { n: 5 }));
    const unchanged = await sut.invoke(call('audit'));
    await sut.reset();
    const reset = await sut.invoke(call('audit'));
    const timeout = await h.runBlackBoxExperiment({ referenceNet: h.reference(), calls: [call('audit')], createSut: () => create('timeout') }, { callTimeoutMs: 300 });
    const controller = new AbortController(), hanging = create('timeout');
    await hanging.reset();
    const wait = hanging.invoke(call('audit'), { signal: controller.signal });
    controller.abort();
    const cancelled = await wait.then(() => null, e => e.code);
    const stale = await hanging.invoke(call('audit')).then(() => null, e => e.code);
    const fresh = create('reference'); await fresh.reset();
    const recovered = await fresh.invoke(call('audit'));
    // Malformed public response is an adapter error, not a conformance failure.
    frame.contentDocument.getElementById('audit').addEventListener('click', () => {
      const root = frame.contentDocument.getElementById('response');
      root.replaceChildren(); root.dataset.state = 'accepted';
    });
    const malformed = await fresh.invoke(call('audit')).then(() => null, e => e.code);
    return { concurrent, reserved, audit, refused, unchanged, reset, timeout, cancelled, stale, recovered, malformed };
  });
  expect(result.concurrent).toBe('adapter-error');
  expect(result.reserved).toMatchObject({ status: 'accepted', outputs: { eligible: [false] } });
  expect(result.audit.outputs).toEqual({ eligible: [], ack: [], free: [6], reserved: [4] });
  expect(result.refused).toEqual({ status: 'refused', outputs: { eligible: [], ack: [], free: [], reserved: [] } });
  expect(result.unchanged).toEqual(result.audit);
  expect(result.reset.outputs).toEqual({ eligible: [], ack: [], free: [10], reserved: [0] });
  expect(result.timeout).toMatchObject({ verdict: 'inconclusive', diagnostic: { code: 'adapter-timeout' }, events: [] });
  expect(result.cancelled).toBe('cancelled'); expect(result.stale).toBe('adapter-error');
  expect(result.recovered).toEqual(result.reset); expect(result.malformed).toBe('adapter-error');
});


test('UI timeout remains incomplete and a cancelled browser campaign can restart', async ({ page }, info) => {
  await openQuotaSuite(page);
  await page.getByLabel('Black-box system', { exact: true }).selectOption('quota-web-timeout');
  await page.getByRole('button', { name: 'Run black-box campaign' }).click();
  await expect(page.frameLocator('iframe[title="Quota web SUT"]').locator('#response')).toHaveAttribute('data-state', 'pending');
  await page.getByRole('button', { name: 'Cancel campaign' }).click();
  await expect(page.getByRole('button', { name: 'Run black-box campaign' })).toBeEnabled();
  await expect(page.getByTestId('black-box-summary')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run black-box campaign' }).click();
  await expect(page.getByTestId('black-box-summary')).toContainText('0 compatible executions · 0 observable mismatches · 3 incomplete executions · 0 errors', { timeout: 15000 });
  await expect(page.getByLabel('Observed black-box execution')).toContainText('timed out');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download campaign evidence' }).click();
  await (await downloadPromise).saveAs(info.outputPath('quota-web-timeout.json'));
  await page.getByLabel('Black-box system', { exact: true }).selectOption('quota-web-reference');
  await page.getByRole('button', { name: 'Run black-box campaign' }).click();
  await expect(page.getByTestId('black-box-summary')).toContainText('3 compatible executions · 0 observable mismatches', { timeout: 15000 });
});
