// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';

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

    // Simulation manager should be present
    await expect(page.getByTestId('simulation-manager')).toBeVisible();

    // Open the Enabled Transitions panel
    const toggle = page.getByTestId('show-enabled-transitions');
    if (await toggle.count()) {
      await toggle.click();
    }

    // Wait until either Step is enabled or the panel lists at least one enabled transition
    await page.waitForFunction(() => {
      const step = document.querySelector('[data-testid="sim-step"]');
      const stepEnabled = step && !step.hasAttribute('disabled');
      const panel = document.querySelector('[data-testid="enabled-transitions"]');
      const buttons = panel ? panel.querySelectorAll('button').length : 0;
      return stepEnabled || buttons > 0;
    }, { timeout: 20000 });

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

    // Open file chooser and load PNML
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net1.pnml');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Load' }).click(),
    ]);
    await fileChooser.setFiles(pnmlPath);

    // Wait for simulator panel and for Step to become enabled
    await expect(page.getByTestId('simulation-manager')).toBeVisible();
    await page.waitForFunction(() => {
      const step = document.querySelector('[data-testid="sim-step"]');
      return !!(step && !step.hasAttribute('disabled'));
    }, { timeout: 60000 });

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
    await page.waitForTimeout(500);
    const after1 = await readTokens();
    expect(after1.ptop + after1.pbottom).toBe(1);
    expect(after1.pout).toBe(1);

    // Step 2: the other transition fires
    await page.getByTestId('sim-step').click();
    await page.waitForTimeout(500);
    const after2 = await readTokens();
    expect(after2.ptop + after2.pbottom).toBe(0);
    expect(after2.pout).toBe(2);
  });

  test('fires both transitions simultaneously in maximal mode via Load', async ({ page }) => {
    await page.goto('/');

    // Load the same PN via the app's Load button
    const pnmlPath = path.resolve(process.cwd(), 'tests', 'test-inputs', 'petri-net1.pnml');
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: 'Load' }).click(),
    ]);
    await fileChooser.setFiles(pnmlPath);

    // Helper to ensure Maximal Concurrent mode is selected and saved
    async function ensureMaximalMode() {
      await page.getByTestId('toolbar-settings').click();
      const dlg = page.locator('.fixed.inset-0');
      await expect(dlg.getByText('Simulation Settings')).toBeVisible({ timeout: 20000 });
      const radio = dlg.locator('input[type="radio"][value="maximal"]');
      // Try clicking radio, then label if needed
      await radio.click({ trial: true }).catch(() => {});
      await radio.click().catch(async () => {
        await dlg.getByText('Maximal Concurrent').click();
      });
      // Give controlled state time to update
      await page.waitForTimeout(400);
      // Save
      await dlg.getByRole('button', { name: 'Save' }).click();
      await expect(dlg).toBeHidden({ timeout: 20000 });
      // Reopen to verify
      await page.waitForTimeout(400);
      await page.getByTestId('toolbar-settings').click();
      await expect(dlg.getByText('Simulation Settings')).toBeVisible({ timeout: 20000 });
      const isChecked = await radio.isChecked().catch(() => false);
      // If still not checked, click label and save again
      if (!isChecked) {
        await dlg.getByText('Maximal Concurrent').click();
        await page.waitForTimeout(400);
        await dlg.getByRole('button', { name: 'Save' }).click();
        await expect(dlg).toBeHidden({ timeout: 20000 });
        await page.waitForTimeout(400);
      } else {
        // Close dialog if still open
        await dlg.getByRole('button', { name: 'Save' }).click().catch(() => {});
        await expect(dlg).toBeHidden({ timeout: 20000 }).catch(() => {});
      }
    }

    await ensureMaximalMode();

    // Wait for simulator ready and Step enabled
    await expect(page.getByTestId('simulation-manager')).toBeVisible();
    await page.waitForFunction(() => {
      const step = document.querySelector('[data-testid="sim-step"]');
      return !!(step && !step.hasAttribute('disabled'));
    }, { timeout: 60000 });

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

    // One Step in maximal mode should fire both non-conflicting transitions at once
    await page.getByTestId('sim-step').click();
    // Wait until both inputs are consumed and output increments by 2
    await page.waitForFunction(() => {
      const s = window.__PETRI_NET_STATE__;
      if (!s) return false;
      const find = (x, y) => (s?.places?.find(p => Math.abs(p.x - x) < 2 && Math.abs(p.y - y) < 2) || { tokens: 0 }).tokens;
      const ptop = find(400, 140);
      const pbottom = find(400, 360);
      const pout = find(800, 260);
      return (ptop + pbottom) === 0 && pout === 2;
    }, { timeout: 5000 });
  });
});


