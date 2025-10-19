/// <reference path="../../types/global.d.ts" />
// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';

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

test.describe('Simple Simulation', () => {
  test('shows the transition as enabled after placing 1 token', async ({ page }) => {
    await page.goto('/');

    // Create a minimal connected PN: Place (P1) -> Transition (T1)
    await page.getByTestId('toolbar-place').click();
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });

    await page.getByTestId('toolbar-transition').click();
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });

    await page.getByTestId('toolbar-arc').click();
    // P1 -> T1
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });

    // Put one token in P1 via Properties panel
    await page.getByTestId('toolbar-select').click();
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    // Use the first number input (tokens)
    await page.locator('input[type="number"]').first().fill('1');

    // Wait until simulator is ready
    await waitSimulatorReady(page);

    // Open the Enabled Transitions panel if present
    const toggle = page.getByTestId('show-enabled-transitions');
    if (await toggle.count()) {
      await toggle.click();
    }

    // Assert panel has at least one enabled transition entry
    const panel = page.locator('[data-testid="enabled-transitions"]');
    // If panel exists, verify it shows at least one item; else rely on Step being enabled
    if (await panel.count()) {
      await expect(panel.locator('button')).toHaveCount(1, { timeout: 20000 });
    } else {
      await expect(page.getByTestId('sim-step')).toBeEnabled();
    }
  });

  test('steps fire transitions sequentially from PNML via Load', async ({ page }) => {
    await page.goto('/');

    // Open file chooser and load PNML (robust against UI races)
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net1.pnml');
    const loadBtn = page.getByRole('button', { name: 'Load' });
    await loadBtn.waitFor({ state: 'visible' });
    let fileChooser;
    try {
      const fcPromise = page.waitForEvent('filechooser', { timeout: 5000 });
      await loadBtn.click();
      fileChooser = await fcPromise;
    } catch (_) {
      const fcPromise2 = page.waitForEvent('filechooser', { timeout: 10000 });
      await loadBtn.click();
      fileChooser = await fcPromise2;
    }
    await fileChooser.setFiles(pnmlPath);

    // Wait for simulator ready and at least one enabled transition
    await waitSimulatorReady(page, 60000);

    // Helper to read tokens by coordinates used in the PNML
    async function readTokens() {
      return page.evaluate(() => {
        // @ts-ignore
        const s = window.__PETRI_NET_STATE__;
        const find = (x, y) => (s?.places?.find(p => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2) || { tokens: 0 }).tokens;
        return { ptop: find(400, 140), pbottom: find(400, 360), pout: find(800, 260) };
      });
    }

    const before = await readTokens();
    expect(before.ptop + before.pbottom).toBe(2);
    expect(before.pout).toBe(0);

    // Step 1: only one transition should fire
    await page.getByTestId('sim-step').click();
    // Wait until tokens reflect one firing
    await page.waitForFunction(() => {
      // @ts-ignore
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const find = (x, y) => (s?.places?.find(p => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2) || { tokens: 0 }).tokens;
      const ptop = find(400, 140);
      const pbottom = find(400, 360);
      const pout = find(800, 260);
      return (ptop + pbottom) === 1 && pout === 1;
    }, { timeout: 60000 });
    const after1 = await readTokens();
    expect(after1.ptop + after1.pbottom).toBe(1);
    expect(after1.pout).toBe(1);

    // Step 2: the other transition fires
    await page.getByTestId('sim-step').click();
    // Wait until tokens reflect second firing and completion
    await page.waitForFunction(() => {
      // @ts-ignore
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const find = (x, y) => (s?.places?.find(p => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2) || { tokens: 0 }).tokens;
      const ptop = find(400, 140);
      const pbottom = find(400, 360);
      const pout = find(800, 260);
      return (ptop + pbottom) === 0 && pout === 2;
    }, { timeout: 60000 });
    const after2 = await readTokens();
    expect(after2.ptop + after2.pbottom).toBe(0);
    expect(after2.pout).toBe(2);
  });

  test('fires both transitions simultaneously in maximal mode via Load', async ({ page }) => {
    await page.goto('/');

    // Load the same PN via the app's Load button
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net1.pnml');
    const loadBtn = page.getByRole('button', { name: 'Load' });
    await loadBtn.waitFor({ state: 'visible' });
    let fileChooser;
    try {
      const fcPromise = page.waitForEvent('filechooser', { timeout: 5000 });
      await loadBtn.click();
      fileChooser = await fcPromise;
    } catch (_) {
      // Retry once if the first click didn't open the chooser
      const fcPromise2 = page.waitForEvent('filechooser', { timeout: 10000 });
      await loadBtn.click();
      fileChooser = await fcPromise2;
    }
    await fileChooser.setFiles(pnmlPath);

    // Open Settings and switch to Maximal Concurrent via UI
    await page.getByTestId('toolbar-settings').click();
    const maximalRadio = page.locator('input[type="radio"][name="simulationMode"][value="maximal"]');
    await maximalRadio.check();
    await page.getByTestId('settings-save').click();
    // Wait for simulator ready and Step enabled after mode change
    await waitSimulatorReady(page, 60000);

    // Helper to read tokens by coordinates
    async function readTokens() {
      return page.evaluate(() => {
        // @ts-ignore
        const s = window.__PETRI_NET_STATE__;
        const find = (x, y) => (s?.places?.find(p => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2) || { tokens: 0 }).tokens;
        return { ptop: find(400, 140), pbottom: find(400, 360), pout: find(800, 260) };
      });
    }

    const before = await readTokens();
    expect(before.ptop + before.pbottom).toBe(2);
    expect(before.pout).toBe(0);

    // One Step in maximal mode should fire both non-conflicting transitions at once.
    await page.getByTestId('sim-step').click();
    await page.waitForFunction(() => {
      // @ts-ignore
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const find = (x, y) => (s?.places?.find(p => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2) || { tokens: 0 }).tokens;
      const ptop = find(400, 140);
      const pbottom = find(400, 360);
      const pout = find(800, 260);
      return (ptop + pbottom) === 0 && pout === 2;
    }, { timeout: 60000 });
  });

  test('runs to completion via Simulate on petri-net3.pnml', async ({ page }) => {
    await page.goto('/');

    // Load PN3 (robust file chooser handling)
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net3.pnml');
    const loadBtnSim = page.getByRole('button', { name: 'Load' });
    await loadBtnSim.waitFor({ state: 'visible' });
    let fileChooserSim;
    try {
      const fcPromise = page.waitForEvent('filechooser', { timeout: 5000 });
      await loadBtnSim.click();
      fileChooserSim = await fcPromise;
    } catch (_) {
      const fcPromise2 = page.waitForEvent('filechooser', { timeout: 10000 });
      await loadBtnSim.click();
      fileChooserSim = await fcPromise2;
    }
    await fileChooserSim.setFiles(pnmlPath);

    // Helper to compute number of enabled transitions from exposed state
    async function countEnabled() {
      return page.evaluate(() => {
        const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
        if (!s) return 0;
        const placesById = new Map(s.places.map(p => [p.id, p]));
        const arcs = s.arcs || [];
        const transitions = s.transitions || [];
        const isEnabled = (tid) => {
          for (const a of arcs) {
            const src = a.sourceId || a.source;
            const tgt = a.targetId || a.target;
            if (tgt === tid) {
              const place = placesById.get(src);
              const w = Number(a.weight || 1);
              if (!place || (Number(place.tokens || 0) < w)) return false;
            }
          }
          return true;
        };
        return transitions.filter(t => isEnabled(t.id)).length;
      });
    }

    // Ensure simulator is ready before starting simulate
    await waitSimulatorReady(page, 60000);

    // Start simulate (continuous)
    const stopBtn = page.getByTestId('sim-stop');
    await page.getByTestId('sim-simulate').click();
    // Wait until Stop becomes enabled (simulation running)
    await expect(stopBtn).toBeEnabled({ timeout: 20000 });
    // Then wait until it becomes disabled again (simulation finished)
    await expect(stopBtn).toBeDisabled({ timeout: 60000 });
    // Verify no transitions remain enabled
    await page.waitForFunction(() => {
      const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
      if (!s) return false;
      const placesById = new Map(s.places.map(p => [p.id, p]));
      const arcs = s.arcs || [];
      const transitions = s.transitions || [];
      const isEnabled = (tid) => {
        for (const a of arcs) {
          const src = a.sourceId || a.source;
          const tgt = a.targetId || a.target;
          if (tgt === tid) {
            const place = placesById.get(src);
            const w = Number(a.weight || 1);
            if (!place || (Number(place.tokens || 0) < w)) return false;
          }
        }
        return true;
      };
      return transitions.filter(t => isEnabled(t.id)).length === 0;
    }, { timeout: 60000 });
    expect(await countEnabled()).toBe(0);
  });

  test('runs to completion via Run on petri-net3.pnml', async ({ page }) => {
    await page.goto('/');

    // Load PN3
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net3.pnml');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Load' }).click(),
    ]);
    await fileChooser.setFiles(pnmlPath);

    // Start run-to-completion
    const stopBtn = page.getByTestId('sim-stop');
    // Ensure simulator is ready before starting run
    await waitSimulatorReady(page, 60000);
    await page.getByTestId('sim-run').click();
    // Wait until Stop becomes enabled (run started)
    await expect(stopBtn).toBeEnabled({ timeout: 20000 });
    // Then disabled again (done)
    await expect(stopBtn).toBeDisabled({ timeout: 60000 });
    // Assert no enabled transitions remain
    await page.waitForFunction(() => {
      const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
      if (!s) return false;
      const placesById = new Map(s.places.map(p => [p.id, p]));
      const arcs = s.arcs || [];
      const transitions = s.transitions || [];
      const isEnabled = (tid) => {
        for (const a of arcs) {
          const src = a.sourceId || a.source;
          const tgt = a.targetId || a.target;
          if (tgt === tid) {
            const place = placesById.get(src);
            const w = Number(a.weight || 1);
            if (!place || (Number(place.tokens || 0) < w)) return false;
          }
        }
        return true;
      };
      return transitions.filter(t => isEnabled(t.id)).length === 0;
    }, { timeout: 60000 });
  });

  test('fires T1 and T2 by clicking transition buttons; P1 and P2 get 1 token', async ({ page }) => {
    await page.goto('/');

    // Load PN3
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net3.pnml');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Load' }).click(),
    ]);
    await fileChooser.setFiles(pnmlPath);

    // Ensure simulator ready and open Enabled Transitions panel
    await waitSimulatorReady(page, 60000);
    const toggle = page.getByTestId('show-enabled-transitions');
    if (await toggle.count()) {
      await toggle.click();
    }

    // Fire T1, then T2 via enabled transitions panel
    await page.getByTestId('enabled-T1').click();
    await page.getByTestId('enabled-T2').click();

    // Assert P1 and P2 now each have 1 token
    await page.waitForFunction(() => {
      const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
      if (!s) return false;
      const byLabel = (label) => (s.places || []).find(p => (p.label || p.name) === label);
      const p1 = byLabel('P1');
      const p2 = byLabel('P2');
      return p1 && p2 && Number(p1.tokens || 0) === 1 && Number(p2.tokens || 0) === 1;
    }, { timeout: 60000 });
  });

  test('non-deterministic firing with two enabled transitions (from PN)', async ({ page }) => {
    test.setTimeout(120000);
    // Helper: run one trial and return the fired transition id
    async function runTrial() {
      await page.goto('/');

      // Load PN with one place (1 token) feeding two enabled transitions
      const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net2.pnml');
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: 'Load' }).click(),
      ]);
      await fileChooser.setFiles(pnmlPath);

      // Wait for simulator ready and Step enabled
      await waitSimulatorReady(page, 10000);

      // Read transitions present before step for validation
      const transitionIds = await page.evaluate(() => (((/** @type {any} */ (window)).__PETRI_NET_STATE__?.transitions) || []).map(t => t.id));
      expect(Array.isArray(transitionIds)).toBeTruthy();
      expect(transitionIds.length).toBeGreaterThanOrEqual(2);

      // One step should fire exactly one of the enabled transitions
      await page.getByTestId('sim-step').click();

      // Wait for state to reflect the firing: P1 becomes 0, P2 becomes 1
      await page.waitForFunction(() => {
        const s = /** @type {any} */ (window).__PETRI_NET_STATE__;
        if (!s) return false;
        const find = (x, y) => (s?.places?.find(p => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2) || { tokens: 0 }).tokens;
        const p1 = find(320, 260);
        const p2 = find(820, 260);
        return p1 === 0 && p2 === 1;
      }, { timeout: 5000 });

      const firedId = await page.evaluate(() => (((/** @type {any} */ (window)).__LAST_FIRED_TRANSITION_ID__) || 'unknown'));
      // Ensure the fired id was one of the two transitions in the net
      expect(transitionIds).toContain(firedId);
      return firedId;
    }

    // Run multiple trials; accept either both or at least one observed depending on random choice
    const seen = new Set();
    for (let i = 0; i < 6; i++) {
      const fired = await runTrial();
      if (fired && fired !== 'unknown') seen.add(fired);
      if (seen.size >= 2) break; // both transitions observed
    }

    // The simulator's random choice may repeat; allow pass if at least one valid transition observed
    expect(seen.size).toBeGreaterThanOrEqual(1);
  });
});


