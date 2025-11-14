// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, loadPNML } from '../../helpers.js';

async function waitSimulatorReady(page, timeout = 60000) {
  await expect(page.getByTestId('simulation-manager')).toBeVisible({ timeout });
  await page.waitForFunction(() => {
    const step = document.querySelector('[data-testid="sim-step"]');
    const run = document.querySelector('[data-testid="sim-run"]');
    const stepEnabled = step && !step.hasAttribute('disabled');
    const runEnabled = run && !run.hasAttribute('disabled');
    const panel = document.querySelector('[data-testid="enabled-transitions"]');
    const buttons = panel ? panel.querySelectorAll('button').length : 0;
    return stepEnabled || runEnabled || buttons > 0;
  }, { timeout });
}

async function waitSimulatorInitialized(page, timeout = 60000) {
  await expect(page.getByTestId('simulation-manager')).toBeVisible({ timeout });
  await page.waitForFunction(() => {
    const state = /** @type {any} */ (window).__PETRI_NET_STATE__;
    const core = /** @type {any} */ (window).__PETRI_NET_SIM_CORE__;
    return state && Array.isArray(state.places) && core && typeof core.fireTransition === 'function';
  }, { timeout });
}

async function readPlaceTokens(page, label) {
  return page.evaluate((name) => {
    const state = /** @type {any} */ (window).__PETRI_NET_STATE__;
    if (!state || !Array.isArray(state.places)) return [];
    const place = state.places.find((p) => (p.label || p.name) === name);
    if (!place) return [];
    if (Array.isArray(place.valueTokens)) return place.valueTokens;
    if (typeof place.tokens === 'number') return new Array(place.tokens).fill(1);
    return [];
  }, label);
}

async function loadSkeletonNet(page, filename, { requireEnabled = true } = {}) {
  await page.goto('/');
  await waitForAppReady(page);
  await loadPNML(page, filename);
  if (requireEnabled) {
    await waitSimulatorReady(page);
  } else {
    await waitSimulatorInitialized(page);
  }
}

async function getEnabledCount(page) {
  return page.evaluate(() => {
    const w = /** @type {any} */ (window);
    const ids = w.__ENABLED_TRANSITIONS__;
    return Array.isArray(ids) ? ids.length : 0;
  });
}

async function runToCompletion(page, maxSteps = 10) {
  for (let i = 0; i < maxSteps; i += 1) {
    const enabled = await getEnabledCount(page);
    if (!enabled) break;
    await page.getByTestId('sim-step').click();
    await page.waitForTimeout(75);
  }
}

test.describe('Algebraic skeleton operator coverage', () => {
  test('int skeleton covers arithmetic and comparisons', async ({ page }) => {
    await loadSkeletonNet(page, 'petri-net-algebraic-int-skeleton.pnml');
    await runToCompletion(page);
    await expect.poll(() => getEnabledCount(page)).toBe(0);

    await page.waitForFunction(() => {
      const state = /** @type {any} */ (window).__PETRI_NET_STATE__;
      const find = (name) => state?.places?.find((p) => (p.label || p.name) === name);
      const p2 = find('P2');
      const p3 = find('P3');
      return Array.isArray(p2?.valueTokens) && p2.valueTokens.length === 3
        && Array.isArray(p3?.valueTokens) && p3.valueTokens.length === 6;
    }, { timeout: 15000 });

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');

    expect(p2Tokens).toEqual([5, 7, 2]);
    expect(p3Tokens).toEqual([false, true, true, true, true, true]);
  });

  test('bool skeleton resolves all logical operators', async ({ page }) => {
    await loadSkeletonNet(page, 'petri-net-algebraic-bool-skeleton.pnml');
    await runToCompletion(page);
    await expect.poll(() => getEnabledCount(page)).toBe(0);

    await page.waitForFunction(() => {
      const state = /** @type {any} */ (window).__PETRI_NET_STATE__;
      const find = (name) => state?.places?.find((p) => (p.label || p.name) === name);
      const p2 = find('P2');
      const p3 = find('P3');
      return Array.isArray(p2?.valueTokens) && p2.valueTokens.length === 3
        && Array.isArray(p3?.valueTokens) && p3.valueTokens.length === 3;
    }, { timeout: 15000 });

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');

    expect(p2Tokens).toEqual([false, true, false]);
    expect(p3Tokens).toEqual([false, true, true]);
  });

  test('string skeleton applies concat, substring, and length', async ({ page }) => {
    await loadSkeletonNet(page, 'petri-net-algebraic-string-skeleton.pnml');
    await runToCompletion(page);
    await expect.poll(() => getEnabledCount(page)).toBe(0);

    await page.waitForFunction(() => {
      const state = /** @type {any} */ (window).__PETRI_NET_STATE__;
      const find = (name) => state?.places?.find((p) => (p.label || p.name) === name);
      const p2 = find('P2');
      const p3 = find('P3');
      return Array.isArray(p2?.valueTokens) && p2.valueTokens.length === 3
        && Array.isArray(p3?.valueTokens) && p3.valueTokens.length === 3;
    }, { timeout: 15000 });

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');

    expect(p2Tokens).toEqual(['prelude', 'pre', 7]);
    expect(p3Tokens).toEqual([true, true, true]);
  });

  test('list skeleton handles structural operators and predicates', async ({ page }) => {
    await loadSkeletonNet(page, 'petri-net-algebraic-list-skeleton.pnml');
    await runToCompletion(page);
    await expect.poll(() => getEnabledCount(page)).toBe(0);

    await page.waitForFunction(() => {
      const state = /** @type {any} */ (window).__PETRI_NET_STATE__;
      const find = (name) => state?.places?.find((p) => (p.label || p.name) === name);
      const p2 = find('P2');
      const p3 = find('P3');
      return Array.isArray(p2?.valueTokens) && p2.valueTokens.length === 3
        && Array.isArray(p3?.valueTokens) && p3.valueTokens.length === 5;
    }, { timeout: 15000 });

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');

    expect(p2Tokens).toEqual([
      [1, 2, 3, 4, 5, 6, 7],
      [1, 2, 3, 4, 5, 6],
      [7],
    ]);
    expect(p3Tokens).toEqual([
      [2, 3, 4, 5],
      true,
      false,
      true,
      5,
    ]);
  });

  test('pair skeleton destructures nested pairs correctly', async ({ page }) => {
    await loadSkeletonNet(page, 'petri-net-algebraic-pair-skeleton.pnml');
    await runToCompletion(page);
    await expect.poll(() => getEnabledCount(page)).toBe(0);

    await page.waitForFunction(() => {
      const state = /** @type {any} */ (window).__PETRI_NET_STATE__;
      const find = (name) => state?.places?.find((p) => (p.label || p.name) === name);
      const p2 = find('P2');
      const p3 = find('P3');
      return Array.isArray(p2?.valueTokens) && p2.valueTokens.length === 5
        && Array.isArray(p3?.valueTokens) && p3.valueTokens.length === 4;
    }, { timeout: 15000 });

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');

    expect(p2Tokens).toEqual([
      'key',
      { __pair__: true, fst: 1, snd: true },
      3,
      false,
      { __pair__: true, fst: 'key', snd: 3 },
    ]);
    expect(p3Tokens).toEqual([false, true, true, true]);
  });
});

test.describe('Algebraic skeleton error handling', () => {
  test('guard-never net exposes no enabled transitions', async ({ page }) => {
    await loadSkeletonNet(page, 'petri-net-algebraic-guard-never.pnml', { requireEnabled: false });

    await expect(page.getByTestId('sim-step')).toBeDisabled();
    expect(await getEnabledCount(page)).toBe(0);

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');
    expect(p2Tokens).toEqual([]);
    expect(p3Tokens).toEqual([]);
  });

  test('binding mismatch net reports not enabled error', async ({ page }) => {
    await loadSkeletonNet(page, 'petri-net-algebraic-binding-mismatch.pnml', { requireEnabled: false });

    await expect(page.getByTestId('sim-step')).toBeDisabled();
    const errorMessage = await page.evaluate(async () => {
      const core = /** @type {any} */ (window).__PETRI_NET_SIM_CORE__;
      try {
        await core.fireTransition('t1');
        return null;
      } catch (err) {
        return err?.message || String(err);
      }
    });
    expect(errorMessage).toContain('not enabled');

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');
    expect(p2Tokens).toEqual([]);
    expect(p3Tokens).toEqual([]);
  });

  test('invalid head usage surfaces descriptive error', async ({ page }) => {
    await loadSkeletonNet(page, 'petri-net-algebraic-invalid-head.pnml', { requireEnabled: false });

    await expect(page.getByTestId('sim-step')).toBeDisabled();

    const fireResult = await page.evaluate(async () => {
      const core = /** @type {any} */ (window).__PETRI_NET_SIM_CORE__;
      try {
        await core.fireTransition('t1');
        return null;
      } catch (err) {
        return err?.message || String(err);
      }
    });
    expect(fireResult).toContain('not enabled');

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');
    expect(p2Tokens).toEqual([]);
    expect(p3Tokens).toEqual([]);
  });
});


