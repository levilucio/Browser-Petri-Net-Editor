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
  // Wait until app exposes state and at least one transition exists
  await page.waitForFunction(() => {
    const s = window.__PETRI_NET_STATE__;
    return !!s && Array.isArray(s.transitions) && s.transitions.length >= 1;
  }, { timeout });
}

test.describe('List ADT - PN12', () => {
  test('petri-net12: consumes two tokens, produces tail(x) of length 3 in P2', async ({ page }) => {
    // Load the PNML file
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net12.pnml');

    // Wait for simulator to be ready
    await waitSimulatorReady(page);

    // Verify initial state using window state
    const initial = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      const p3 = byLabel('P3');
      return {
        p1Tokens: p1?.valueTokens || [],
        p2Tokens: p2?.valueTokens || [],
        p3Tokens: p3?.valueTokens || []
      };
    });

    // P1 has one list token; P3 has ints; P2 empty
    expect(Array.isArray(initial.p1Tokens)).toBeTruthy();
    expect(initial.p1Tokens.length).toBe(1);
    expect(Array.isArray(initial.p1Tokens[0])).toBeTruthy();
    expect(initial.p3Tokens.length).toBeGreaterThanOrEqual(1);
    expect(initial.p2Tokens).toEqual([]);

    // Wait until a step is possible then fire
    await page.waitForFunction(() => {
      const step = document.querySelector('[data-testid="sim-step"]');
      const en = window.__ENABLED_TRANSITIONS__ || [];
      return (step && !step.hasAttribute('disabled')) || (Array.isArray(en) && en.length > 0);
    }, { timeout: 20000 });
    await page.getByTestId('sim-step').click();

    // Wait for the transition to fire and tokens to update
    await page.waitForFunction(() => {
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens : [];
      if (vt2.length !== 1) return false;
      const first = vt2[0];
      return Array.isArray(first) && first.length === 3;
    }, { timeout: 15000 });

    // Verify final state precisely
    const finalState = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      const p3 = byLabel('P3');
      return {
        p1Tokens: p1?.valueTokens || [],
        p2Tokens: p2?.valueTokens || [],
        p3Tokens: p3?.valueTokens || []
      };
    });

    expect(finalState.p2Tokens.length).toBe(1);
    expect(Array.isArray(finalState.p2Tokens[0])).toBeTruthy();
    expect(finalState.p2Tokens[0].length).toBe(3);
    // Optional stronger check: first element of tail(x) should be 2
    expect(finalState.p2Tokens[0][0]).toBe(2);
  });
});


test.describe('List ADT - PN16', () => {
  test('petri-net16: produces [2,3] in P2', async ({ page }) => {
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net16.pnml');

    await waitSimulatorReady(page);

    // Step once
    await page.getByTestId('sim-step').click();

    // Wait until P2 has exactly one list token [2,3]
    await page.waitForFunction(() => {
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens : [];
      return vt2.length === 1 && Array.isArray(vt2[0]) && vt2[0][0] === 2 && vt2[0][1] === 3 && vt2[0].length === 2;
    }, { timeout: 15000 });

    // Final assert with state fetch
    const p2Tokens = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      return p2?.valueTokens || [];
    });
    expect(p2Tokens).toEqual([[2, 3]]);
  });
});


