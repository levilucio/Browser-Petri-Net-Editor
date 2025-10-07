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

test.describe('Pair token support', () => {
  test('PN9: Pair token (2,(T,3)) enables transition, fires once, then disables', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net9.pnml');

    await waitSimulatorReady(page, 60000);

    // Check that T1 is initially enabled
    const initialEnabled = await page.evaluate(() => {
      return (window.__ENABLED_TRANSITIONS__ || []);
    });
    expect(initialEnabled).toContain('t1');

    // Fire the transition once
    await page.getByTestId('sim-step').click();

    // Wait for the transition to complete
    await page.waitForTimeout(1000);

    // Check final state
    const finalInfo = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      const vt1 = Array.isArray(p1?.valueTokens) ? p1.valueTokens.slice() : [];
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens.slice() : [];
      const enabled = (window.__ENABLED_TRANSITIONS__ || []);
      return { vt1, vt2, enabled };
    });

    // P1 should now contain only (0, (F, 1)) - the (2, (T, 3)) token was consumed
    expect(finalInfo.vt1).toHaveLength(1);
    expect(finalInfo.vt1[0]).toEqual({ __pair__: true, fst: 0, snd: { __pair__: true, fst: false, snd: 1 } });

    // P2 should contain the fired token (2, (T, 3))
    expect(finalInfo.vt2).toHaveLength(1);
    expect(finalInfo.vt2[0]).toEqual({ __pair__: true, fst: 2, snd: { __pair__: true, fst: true, snd: 3 } });

    // T1 should no longer be enabled since the matching token was consumed
    expect(finalInfo.enabled).not.toContain('t1');
  });

  test('PN13: fst(z:Pair) output produces hello in P6', async ({ page }) => {
    // Load APN model that uses fst on output arc
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net13.pnml');

    await waitSimulatorReady(page, 60000);

    // Step once
    await page.getByTestId('sim-step').click();
    await page.waitForTimeout(800);

    // Inspect state and verify P6 contains 'hello'
    const result = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p6 = byLabel('P6');
      const vt6 = Array.isArray(p6?.valueTokens) ? p6.valueTokens.slice() : [];
      return { vt6 };
    });

    expect(result.vt6).toEqual(expect.arrayContaining(['hello']));
  });
});
