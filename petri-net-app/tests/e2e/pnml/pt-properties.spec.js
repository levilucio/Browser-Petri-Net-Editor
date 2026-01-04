// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  waitForAppReady,
  loadPNML,
  getVisibleToolbarButton,
  openMobileMenuIfNeeded,
} from '../../helpers.js';

async function clickToolbarButton(page, testId) {
  const btn = await getVisibleToolbarButton(page, testId);
  const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
  if (isMobile) {
    await btn.evaluate((n) => n.click());
  } else {
    await btn.click();
  }
}

test.describe('PNML + PT Validation (properties)', () => {
  test('loads PNML with embedded <toolspecific> properties and shows them in Validation dialog', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'philosophers-5.pnml');

    await clickToolbarButton(page, 'toolbar-validation');
    await expect(page.getByText('P/T Net Validation')).toBeVisible();

    // Wait for properties to load - philosophers-5 has 4 properties
    await expect(page.getByText(/Properties\s*\(4\)/)).toBeVisible({ timeout: 10000 });

    // sanity: known names from file should be visible - check input values since property names are in text inputs
    await page.waitForTimeout(500); // Give time for properties to render
    const nameInputs = page.locator('input[placeholder="Property name"]');
    await expect(nameInputs).toHaveCount(4, { timeout: 5000 });
    
    // Check that the expected property names are in the inputs (get input values)
    const inputCount = await nameInputs.count();
    const inputValues = [];
    for (let i = 0; i < inputCount; i++) {
      const value = await nameInputs.nth(i).inputValue();
      inputValues.push(value);
    }
    expect(inputValues).toContain('Check for deadlock');
    expect(inputValues).toContain('Some philosopher eating');
    expect(inputValues).toContain('All philosophers eating');
    expect(inputValues.some(v => /Fork conservation/.test(v))).toBeTruthy();
  });

  test.describe('save roundtrip (download fallback)', () => {
    // Download behavior is most reliable on Chromium; avoid running on WebKit/Safari mobile project.
    test.skip(({ browserName }) => browserName !== 'chromium', 'Download assertion is Chromium-only');
    test.use({ acceptDownloads: true });

    test('adds a property, saves PNML, and saved file contains toolspecific properties', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      await loadPNML(page, 'philosophers-5.pnml');

      await clickToolbarButton(page, 'toolbar-validation');
      await expect(page.getByText('P/T Net Validation')).toBeVisible();

      // Add an extra property and name it deterministically
      await page.getByRole('button', { name: /^\+\s*Invariant$/ }).click();
      const newPropName = 'E2E_saved_prop';
      await page.getByPlaceholder('Property name').last().fill(newPropName);

      // Close (should persist into global net state)
      await page.getByRole('button', { name: 'Close', exact: true }).click();

      // Force fallback download mode (no File System Access API)
      await page.evaluate(() => { delete window.showSaveFilePicker; });

      await openMobileMenuIfNeeded(page);

      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await page.getByRole('button', { name: 'Save', exact: true }).click({ force: true });
      const download = await downloadPromise;

      const outPath = path.join(os.tmpdir(), `petri-net-${Date.now()}.pnml`);
      await download.saveAs(outPath);

      const xml = fs.readFileSync(outPath, 'utf8');

      expect(xml).toContain('tool="Browser-Petri-Net-Editor"');
      expect(xml).toContain('<properties');
      expect(xml).toContain(`name="${newPropName}"`);
    });
  });

  test('runs PT validation on philosophers-5 and shows results', async ({ page }) => {
    // Pyodide init can be slow on cold start.
    test.setTimeout(120_000);

    await page.goto('/');
    await waitForAppReady(page);

    await loadPNML(page, 'philosophers-5.pnml');

    await clickToolbarButton(page, 'toolbar-validation');
    await expect(page.getByText('P/T Net Validation')).toBeVisible();

    // Run validation (exact mode is default) - use the Validate button inside the dialog (second one, not toolbar)
    await page.getByRole('button', { name: 'Validate' }).nth(1).click();

    await expect(page.getByText('Results')).toBeVisible({ timeout: 120_000 });
    
    // "Check for deadlock" appears twice (in properties list and results) - use first() to get the results one
    await expect(page.getByText('Check for deadlock').first()).toBeVisible();

    // In exact mode, this net should be able to deadlock -> status should show Witnessed.
    const row = page.locator('div').filter({ hasText: 'Check for deadlock' }).filter({ hasText: 'Witnessed' });
    await expect(row.first()).toBeVisible({ timeout: 120_000 });
  });
});

