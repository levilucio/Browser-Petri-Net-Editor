// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';

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
    const stepEnabled = step && !step.hasAttribute('disabled');
    const panel = document.querySelector('[data-testid="enabled-transitions"]');
    const buttons = panel ? panel.querySelectorAll('button').length : 0;
    return stepEnabled || buttons > 0;
  }, { timeout });
}

test.describe('String ADT Tests', () => {
  test('petri-net10: String concatenation with concat function', async ({ page }) => {
    // Load the PNML file
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net10.pnml');

    // Wait for simulator to be ready
    await waitSimulatorReady(page);

    // Verify initial state using window state
    const initialState = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      return {
        p1Tokens: p1?.valueTokens || [],
        p2Tokens: p2?.valueTokens || []
      };
    });

    expect(initialState.p1Tokens).toEqual(['hello']);
    expect(initialState.p2Tokens).toEqual([]);

    // Fire the transition using the Step button
    await page.getByTestId('sim-step').click();

    // Wait for the transition to fire and tokens to update
    await page.waitForFunction(() => {
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens : [];
      return vt2.length > 0 && vt2.includes('helloworld!');
    }, { timeout: 10000 });

    // Verify final state
    const finalState = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      return {
        p1Tokens: p1?.valueTokens || [],
        p2Tokens: p2?.valueTokens || []
      };
    });

    expect(finalState.p1Tokens).toEqual([]);
    expect(finalState.p2Tokens).toEqual(['helloworld!']);
  });

  test('petri-net11: String concatenation with substring guard', async ({ page }) => {
    // Load the PNML file
    await loadPnmlViaHiddenInput(page, 'tests/test-inputs/petri-net11.pnml');

    // Wait for simulator to be ready
    await waitSimulatorReady(page);

    // Verify initial state
    const initialState = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      return {
        p1Tokens: p1?.valueTokens || [],
        p2Tokens: p2?.valueTokens || []
      };
    });

    expect(initialState.p1Tokens).toEqual(['hello']);
    expect(initialState.p2Tokens).toEqual([]);

    // Fire the transition using the Step button
    await page.getByTestId('sim-step').click();

    // Wait for the transition to fire and tokens to update
    await page.waitForFunction(() => {
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p2 = byLabel('P2');
      const vt2 = Array.isArray(p2?.valueTokens) ? p2.valueTokens : [];
      return vt2.length > 0 && vt2.includes('helloworld!');
    }, { timeout: 10000 });

    // Verify final state
    const finalState = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      return {
        p1Tokens: p1?.valueTokens || [],
        p2Tokens: p2?.valueTokens || []
      };
    });

    expect(finalState.p1Tokens).toEqual([]);
    expect(finalState.p2Tokens).toEqual(['helloworld!']);
  });

  test('petri-net11: Transition should not fire with non-matching guard', async ({ page }) => {
    // This test verifies that the guard actually works by loading the net
    // and checking behavior with a non-matching token
    // We'll create a modified version of the net with 'world' instead of 'hello'
    
    await page.goto('/');
    
    // Wait for the app to be ready
    await page.waitForSelector('[data-testid="toolbar-place"]', { state: 'visible' });
    
    // Load and modify the PNML content
    const fs = await import('fs');
    const path = await import('path');
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net11.pnml');
    let pnmlContent = fs.readFileSync(pnmlPath, 'utf-8');
    
    // Replace 'hello' with 'world' - this should make the guard fail
    pnmlContent = pnmlContent.replace("['hello']", "['world']");
    
    // Load via file input
    const loadBtn = page.getByRole('button', { name: 'Load' });
    await loadBtn.waitFor({ state: 'visible' });
    await loadBtn.click();
    
    const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
    await input.waitFor({ state: 'attached', timeout: 10000 });
    
    // Create a temporary file-like object with the modified content
    await input.evaluate((el, content) => {
      const dt = new DataTransfer();
      const file = new File([content], 'petri-net11-modified.pnml', { type: 'application/xml' });
      dt.items.add(file);
      el.files = dt.files;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, pnmlContent);
    
    // Wait for the network to load and simulator to initialize
    await page.waitForTimeout(1000);
    
    // Wait for simulation manager to be visible
    await expect(page.getByTestId('simulation-manager')).toBeVisible({ timeout: 60000 });
    
    // Verify initial state: P1 should have 'world' token
    const initialState = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      return {
        p1Tokens: p1?.valueTokens || [],
        p2Tokens: p2?.valueTokens || []
      };
    });

    expect(initialState.p1Tokens).toEqual(['world']);
    expect(initialState.p2Tokens).toEqual([]);

    // Check that the transition is NOT enabled (guard should fail)
    // substring('world', 0, 2) == 'wo', not 'he'
    const enabledTransitions = await page.evaluate(() => {
      return window.__ENABLED_TRANSITIONS__ || [];
    });

    expect(enabledTransitions.length).toBe(0);

    // Verify the Step button is disabled
    const stepButton = page.getByTestId('sim-step');
    await expect(stepButton).toBeDisabled();

    // Verify P1 still has 'world' and P2 remains empty (no firing occurred)
    const finalState = await page.evaluate(() => {
      const s = window.__PETRI_NET_STATE__;
      const byLabel = (lbl) => (s?.places || []).find(p => (p.label || p.name) === lbl);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      return {
        p1Tokens: p1?.valueTokens || [],
        p2Tokens: p2?.valueTokens || []
      };
    });

    expect(finalState.p1Tokens).toEqual(['world']);
    expect(finalState.p2Tokens).toEqual([]);
  });
});

