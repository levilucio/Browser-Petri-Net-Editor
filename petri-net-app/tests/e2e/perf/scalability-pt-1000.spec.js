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

test.describe('Scalability PT 1000x1000', () => {
  test.slow();
  test.setTimeout(120000);

  test('load-to-ready and step budgets enforced', async ({ page }) => {
    // Load PNML and measure load-to-ready
    const startLoad = Date.now();
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net1000-pt.pnml');
    await waitSimulatorReady(page, { p: 1000, t: 1000 }, 600000);
    const loadMs = Date.now() - startLoad;

    // Enforce load budget (<= 10s)
    const PT_LOAD_BUDGET_MS = Number(process.env.PT_LOAD_BUDGET_MS || 10000);
    expect(loadMs).toBeLessThanOrEqual(PT_LOAD_BUDGET_MS);

    // Measure step latencies
    const iterations = Number(process.env.PT_STEP_SAMPLES || 10);
    const timings = [];
    for (let i = 0; i < iterations; i++) {
      const before = await page.evaluate(() => /** @type {any} */(window).__LAST_FIRED_TRANSITION_ID__ || null);
      const t0 = Date.now();
      await page.getByTestId('sim-step').click();
      await page.waitForFunction((prev) => {
        const w = /** @type {any} */ (window);
        return w.__LAST_FIRED_TRANSITION_ID__ && w.__LAST_FIRED_TRANSITION_ID__ !== prev;
      }, before, { timeout: 10000 });
      timings.push(Date.now() - t0);
    }

    const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length);
    const max = Math.max(...timings);

    const PT_STEP_AVG_BUDGET_MS = Number(process.env.PT_STEP_AVG_BUDGET_MS || 100);
    const PT_STEP_MAX_BUDGET_MS = Number(process.env.PT_STEP_MAX_BUDGET_MS || 250);
    expect(avg).toBeLessThanOrEqual(PT_STEP_AVG_BUDGET_MS);
    expect(max).toBeLessThanOrEqual(PT_STEP_MAX_BUDGET_MS);

    // Emit structured metrics
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      kind: 'perf-metrics', netMode: 'pt', places: 1000, transitions: 1000,
      loadMs, stepAvgMs: avg, stepMaxMs: max
    }));
  });
});


