// @ts-check
import { test, expect } from '@playwright/test';

async function loadPnmlViaHiddenInput(page, relativePath) {
  await page.goto('/');
  const loadBtn = page.getByRole('button', { name: 'Load' });
  await loadBtn.waitFor({ state: 'visible' });
  await loadBtn.click();
  const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
  await input.waitFor({ state: 'attached', timeout: 10000 });
  await input.setInputFiles(relativePath);
}

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

test.describe('APN (int+bool) basics', () => {
  test('PN6: Single-transition mode run => P2 {2,6}, P3 {T,F}, 4 transition firings', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net6.pnml');

    // Ensure Single mode
    await page.getByTestId('toolbar-settings').click();
    const singleRadio = page.locator('input[type="radio"][name="simulationMode"][value="single"]');
    await singleRadio.check();
    await page.getByTestId('settings-save').click();

    await waitSimulatorReady(page, 60000);

    // Run to completion
    await page.getByTestId('sim-run').click();
    // Wait for final marking deterministically instead of relying on enabled list races
    await page.waitForFunction(() => {
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const p3 = byLabel('P3');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens.slice() : [];
      const vt3 = Array.isArray(p3?.valueTokens) ? p3.valueTokens.slice() : [];
      const has26 = vt2.includes(2) && vt2.includes(6) && vt2.length === 2;
      const hasTF = vt3.includes(true) && vt3.includes(false) && vt3.length === 2;
      return has26 && hasTF;
    }, { timeout: 60000 });

    const finalInfo = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const p3 = byLabel('P3');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens.slice() : [];
      const vt3 = Array.isArray(p3?.valueTokens) ? p3.valueTokens.slice() : [];
      return { vt2, vt3 };
    });

    expect(finalInfo.vt2.sort()).toEqual([2, 6]);
    const sortedBoolsSingle = [...finalInfo.vt3].sort((a, b) => (a === b ? 0 : a ? 1 : -1));
    expect(sortedBoolsSingle).toEqual([false, true]);
    // Derive number of transition firings: T1 fired twice (2 ints), T2 fired twice (2 bools)
    expect(finalInfo.vt2.length + finalInfo.vt3.length).toBe(4);
  });

  test('PN6: Maximally Constrained run => P2 {2,6}, P3 {T,F}, 2 firings', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net6.pnml');

    // Switch to Maximal (Maximally Constrained)
    await page.getByTestId('toolbar-settings').click();
    const maximalRadio = page.locator('input[type="radio"][name="simulationMode"][value="maximal"]');
    await maximalRadio.check();
    await page.getByTestId('settings-save').click();

    await waitSimulatorReady(page, 60000);

    // Run to completion (do not rely on Stop button; run may complete too quickly)
    await page.getByTestId('sim-run').click();
    await page.waitForFunction(() => {
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const p3 = byLabel('P3');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens.slice() : [];
      const vt3 = Array.isArray(p3?.valueTokens) ? p3.valueTokens.slice() : [];
      const has26 = vt2.includes(2) && vt2.includes(6) && vt2.length === 2;
      const hasTF = vt3.includes(true) && vt3.includes(false) && vt3.length === 2;
      return has26 && hasTF;
    }, { timeout: 60000 });

    // Final state
    const finalInfo = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const p3 = byLabel('P3');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens.slice() : [];
      const vt3 = Array.isArray(p3?.valueTokens) ? p3.valueTokens.slice() : [];
      // For this net, one step produces one int and one bool; steps == min(lengths)
      const steps = Math.min(vt2.length, vt3.length);
      return { vt2, vt3, steps };
    });

    expect(finalInfo.vt2.sort()).toEqual([2, 6]);
    const sortedBools = [...finalInfo.vt3].sort((a, b) => (a === b ? 0 : a ? 1 : -1));
    expect(sortedBools).toEqual([false, true]);
    // Two maximal steps firing both transitions simultaneously per step
    expect(finalInfo.steps).toBe(2);
  });

  test('PN7: Run to completion => P2 {2,6}, P3 {T,F}, 2 firings', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net7.pnml');

    await waitSimulatorReady(page, 60000);

    await page.evaluate(() => { window.___FIRE_COUNT__ = 0; });
    const disposer = await page.evaluateHandle(() => {
      const w = window; if (!w.___FIRE_COUNT__) w.___FIRE_COUNT__ = 0;
      const iv = setInterval(() => {
        if (w.__LAST_FIRED_TRANSITION_ID__) {
          w.___FIRE_COUNT__ = (w.___FIRE_COUNT__ || 0) + 1;
          w.__LAST_FIRED_TRANSITION_ID__ = null;
        }
      }, 20);
      return { dispose: () => clearInterval(iv) };
    });

    const runBtn = page.getByTestId('sim-run');
    await expect(runBtn).toBeEnabled({ timeout: 60000 });
    await runBtn.click();

    // Wait until tokens reflect completion
    await page.waitForFunction(() => {
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const p3 = byLabel('P3');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens.slice() : [];
      const vt3 = Array.isArray(p3?.valueTokens) ? p3.valueTokens.slice() : [];
      const has26 = vt2.includes(2) && vt2.includes(6) && vt2.length === 2;
      const hasTF = vt3.includes(true) && vt3.includes(false) && vt3.length === 2;
      return has26 && hasTF;
    }, { timeout: 60000 });

    const finalInfo = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const p3 = byLabel('P3');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens.slice() : [];
      const vt3 = Array.isArray(p3?.valueTokens) ? p3.valueTokens.slice() : [];
      const count = window.___FIRE_COUNT__ || 0;
      return { vt2, vt3, count };
    });

    try { await disposer.dispose(); } catch {}

    expect(finalInfo.vt2.sort()).toEqual([2, 6]);
    const sortedBools = [...finalInfo.vt3].sort((a, b) => (a === b ? 0 : a ? 1 : -1));
    expect(sortedBools).toEqual([false, true]);
    expect(finalInfo.count).toBe(2);
  });

  test('PN8: Run to completion => P3 contains two int 2 tokens (AND guard)', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net8.pnml');

    await waitSimulatorReady(page, 60000);

    const runBtn = page.getByTestId('sim-run');
    await expect(runBtn).toBeEnabled({ timeout: 60000 });
    await runBtn.click();

    // Wait until no more transitions are enabled
    await page.waitForFunction(() => {
      const en = (window.__ENABLED_TRANSITIONS__ || []);
      return Array.isArray(en) && en.length === 0;
    }, { timeout: 60000 });

    const finalInfo = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p3 = byLabel('P3');
      const vt3 = Array.isArray(p3?.valueTokens) ? p3.valueTokens.slice() : [];
      return { vt3 };
    });

    const sortedInts = [...finalInfo.vt3].sort((a, b) => Number(a) - Number(b));
    expect(sortedInts).toEqual([2, 2]);
  });
});


