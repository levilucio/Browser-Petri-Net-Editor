// @ts-check
import { test, expect } from '@playwright/test';

async function loadPnmlViaHiddenInput(page, relativePath) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load' }).click();
  const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
  await input.waitFor({ state: 'attached', timeout: 20000 });
  await input.setInputFiles(relativePath);
}

async function waitSimulatorReady(page, expectedCounts, timeout = 600000) {
  await page.waitForSelector('[data-testid="simulation-manager"]', { state: 'visible', timeout });
  await page.waitForFunction(({ p, t }) => {
    const w = /** @type {any} */ (window);
    const s = w.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
    const okCounts = (s.places?.length || 0) >= p && (s.transitions?.length || 0) >= t;
    const enabled = Array.isArray(w.__ENABLED_TRANSITIONS__);
    return okCounts && enabled;
  }, expectedCounts, { timeout });
}

test.describe('Scalability APN 1000x1000', () => {
  test.slow();
  test.setTimeout(300000);

  test('load-to-ready and step budgets enforced', async ({ page }) => {
    // Load PNML and measure load-to-ready
    const startLoad = Date.now();
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net1000-apn.pnml');
    await waitSimulatorReady(page, { p: 1000, t: 1000 }, 600000);
    const loadMs = Date.now() - startLoad;

    const APN_LOAD_BUDGET_MS = Number(process.env.APN_LOAD_BUDGET_MS || 30000);
    expect(loadMs).toBeLessThanOrEqual(APN_LOAD_BUDGET_MS);

    // Measure step latencies (5 steps, each must be <= 10s)
    const iterations = 5;
    const timings = [];
    for (let i = 0; i < iterations; i++) {
      const before = await page.evaluate(() => /** @type {any} */(window).__LAST_FIRED_TRANSITION_ID__ || null);
      const t0 = Date.now();
      await page.getByTestId('sim-step').click();
      await page.waitForFunction((prev) => {
        const w = /** @type {any} */ (window);
        return w.__LAST_FIRED_TRANSITION_ID__ && w.__LAST_FIRED_TRANSITION_ID__ !== prev;
      }, before, { timeout: 10000 });
      const dt = Date.now() - t0;
      timings.push(dt);
      expect(dt).toBeLessThanOrEqual(10000);
    }

    const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
    const max = Math.max(...timings);

    // Emit structured metrics
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      kind: 'perf-metrics', netMode: 'algebraic', places: 1000, transitions: 1000,
      loadMs, stepAvgMs: avg, stepMaxMs: max
    }));
  });
});



