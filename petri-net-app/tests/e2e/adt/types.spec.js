/// <reference path="../../types/global.d.ts" />
// @ts-check
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

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

test.describe('ADT Types (String/List/Pair)', () => {
  test('petri-net10: String concat produces helloworld! in P2', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net10.pnml');
    await waitSimulatorReady(page);
    await page.getByTestId('sim-step').click();
    await page.waitForFunction(() => {
      const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens : [];
      return vt2.length > 0 && vt2.includes('helloworld!');
    }, { timeout: 10000 });
    const final = await page.evaluate(() => {
      const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      return p2?.valueTokens || [];
    });
    expect(final).toEqual(['helloworld!']);
  });

  test('petri-net11: Transition should not fire with non-matching guard', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="toolbar-place"]', { state: 'visible' });

    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net11.pnml');
    let pnmlContent = fs.readFileSync(pnmlPath, 'utf-8');
    pnmlContent = pnmlContent.replace("['hello']", "['world']");

    const loadBtn = page.getByRole('button', { name: 'Load' });
    await loadBtn.waitFor({ state: 'visible' });
    await loadBtn.click();

    const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
    await input.waitFor({ state: 'attached', timeout: 10000 });

    await input.setInputFiles({
      name: 'petri-net11-modified.pnml',
      mimeType: 'application/xml',
      buffer: Buffer.from(pnmlContent, 'utf-8'),
    });

    await expect(page.getByTestId('simulation-manager')).toBeVisible({ timeout: 60000 });
    const enabled = await page.evaluate(() => { const w = /** @type {any} */ (window); return (w.__ENABLED_TRANSITIONS__ || []).length; });
    expect(enabled).toBe(0);
  });

  test('PN12: tail(x) length 3 in P2', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net12.pnml');
    await waitSimulatorReady(page);
    await page.getByTestId('sim-step').click();
    await page.waitForFunction(() => {
      const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens : [];
      return vt2.length === 1 && Array.isArray(vt2[0]) && vt2[0].length === 3;
    }, { timeout: 15000 });
  });

  test('PN16: produces [2,3] in P2', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net16.pnml');
    await waitSimulatorReady(page);
    await page.getByTestId('sim-step').click();
    const p2Tokens = await page.waitForFunction(() => {
      const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
      if (!s) return null;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens : [];
      return vt2.length ? vt2 : null;
    }, { timeout: 15000 });
    expect(await p2Tokens.jsonValue()).toEqual([[2, 3]]);
  });

  test('PN9: Pair token movement and disabling', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net9.pnml');
    await waitSimulatorReady(page);
    const initialEnabled = await page.evaluate(() => { const w = /** @type {any} */ (window); return (w.__ENABLED_TRANSITIONS__ || []); });
    expect(initialEnabled).toContain('t1');
    await page.getByTestId('sim-step').click();
    await page.waitForTimeout(500);
    const finalInfo = await page.evaluate(() => {
      const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      const vt1 = Array.isArray(p1?.valueTokens) ? p1.valueTokens.slice() : [];
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens.slice() : [];
      const w = /** @type {any} */ (window);
      const enabled = (w.__ENABLED_TRANSITIONS__ || []);
      return { vt1, vt2, enabled };
    });
    expect(finalInfo.vt1).toHaveLength(1);
    expect(finalInfo.vt2).toHaveLength(1);
    expect(finalInfo.enabled).not.toContain('t1');
  });
});


