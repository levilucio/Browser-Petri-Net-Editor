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

async function loadNet(page, filename, { requireEnabled = true } = {}) {
  await page.goto('/');
  await waitForAppReady(page);
  await loadPNML(page, filename);
  if (requireEnabled) {
    await waitSimulatorReady(page);
  } else {
    await waitSimulatorInitialized(page);
  }
}

test.describe('Algebraic operator coverage', () => {
  test('int operators produce expected values in P2 and comparisons in P3', async ({ page }) => {
    await loadNet(page, 'petri-net-algebraic-int-ops.pnml');
    await page.getByTestId('sim-step').click();

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

    expect(p2Tokens).toEqual([5, 4, 3]);
    expect(p3Tokens).toEqual([false, true, true, true, true, true]);
  });

  test('bool operators resolve logical constructs', async ({ page }) => {
    await loadNet(page, 'petri-net-algebraic-bool-ops.pnml');
    await page.getByTestId('sim-step').click();

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

  test('pair operators expose components and comparisons', async ({ page }) => {
    await loadNet(page, 'petri-net-algebraic-pair-ops.pnml');
    await page.getByTestId('sim-step').click();

    await page.waitForFunction(() => {
      const state = /** @type {any} */ (window).__PETRI_NET_STATE__;
      const find = (name) => state?.places?.find((p) => (p.label || p.name) === name);
      const p2 = find('P2');
      const p3 = find('P3');
      return Array.isArray(p2?.valueTokens) && p2.valueTokens.length === 4
        && Array.isArray(p3?.valueTokens) && p3.valueTokens.length === 2;
    }, { timeout: 15000 });

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');

    expect(p2Tokens).toEqual(['key', 5, 'key', 8]);
    expect(p3Tokens).toEqual([false, true]);
  });

  test('string operators cover concat/substring/length predicates', async ({ page }) => {
    await loadNet(page, 'petri-net-algebraic-string-ops.pnml');
    await page.getByTestId('sim-step').click();

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

    expect(p2Tokens).toEqual(['prefix', 'fix', 6]);
    expect(p3Tokens).toEqual([true, true, true]);
  });

  test('list operators evaluate structural functions and predicates', async ({ page }) => {
    await loadNet(page, 'petri-net-algebraic-list-ops.pnml');
    await page.getByTestId('sim-step').click();

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
      [1, 2, 3, 4, 5],
      [1, 2, 3, 4],
      [5],
    ]);
    expect(p3Tokens).toEqual([
      [2, 3, 4],
      true,
      false,
      true,
      3,
    ]);
  });
});

test.describe('Algebraic error handling scenarios', () => {
  test('invalid binding pattern prevents any enabled transitions', async ({ page }) => {
    await loadNet(page, 'petri-net-algebraic-invalid-binding.pnml', { requireEnabled: false });

    // Confirm simulator exposes no enabled transitions
    const stepButton = page.getByTestId('sim-step');
    await expect(stepButton).toBeDisabled();

    const toggle = page.getByTestId('show-enabled-transitions');
    if (await toggle.count()) {
      await toggle.click();
      const panel = page.getByTestId('enabled-transitions');
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('No enabled transitions');
    }

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');
    expect(p2Tokens).toEqual([]);
    expect(p3Tokens).toEqual([]);

    const errorMessage = await page.evaluate(async () => {
      const core = window.__PETRI_NET_SIM_CORE__;
      try {
        await core.fireTransition('t1');
        return null;
      } catch (err) {
        return err?.message || String(err);
      }
    });
    expect(errorMessage).toContain('not enabled');
  });

  test('unsatisfied guard leaves output places empty', async ({ page }) => {
    await loadNet(page, 'petri-net-algebraic-guard-unsat.pnml', { requireEnabled: false });

    await expect(page.getByTestId('sim-step')).toBeDisabled();

    const toggle = page.getByTestId('show-enabled-transitions');
    if (await toggle.count()) {
      await toggle.click();
      const panel = page.getByTestId('enabled-transitions');
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('No enabled transitions');
    }

    const p2Tokens = await readPlaceTokens(page, 'P2');
    const p3Tokens = await readPlaceTokens(page, 'P3');
    expect(p2Tokens).toEqual([]);
    expect(p3Tokens).toEqual([]);

    const fireResult = await page.evaluate(async () => {
      const core = window.__PETRI_NET_SIM_CORE__;
      try {
        await core.fireTransition('t1');
        return null;
      } catch (err) {
        return err?.message || String(err);
      }
    });
    expect(fireResult).toContain('not enabled');
  });
});

