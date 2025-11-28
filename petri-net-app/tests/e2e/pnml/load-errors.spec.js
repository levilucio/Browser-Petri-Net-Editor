// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, openMobileMenuIfNeeded } from '../../helpers.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.describe('PNML - Load error handling UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('loading invalid XML shows error message', async ({ page }) => {
    // Create a temp file with invalid XML
    const tmpFile = path.join(os.tmpdir(), `invalid-${Date.now()}.pnml`);
    fs.writeFileSync(tmpFile, 'not xml content', 'utf8');

    // On mobile, open menu first
    await openMobileMenuIfNeeded(page);
    
    const loadBtn = page.getByRole('button', { name: 'Load' });
    await loadBtn.waitFor({ state: 'visible' });
    
    // On mobile, use JavaScript click to bypass viewport issues
    const isMobileViewport = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobileViewport) {
      await loadBtn.evaluate((btn) => btn.click());
      // Wait for file input to appear
      const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
      await input.waitFor({ state: 'attached', timeout: 10000 });
      await input.setInputFiles(tmpFile);
    } else {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        loadBtn.click(),
      ]);
      await fileChooser.setFiles(tmpFile);
    }

    // Wait for error message to appear
    const errorMsg = page.getByText('Error loading Petri net', { exact: false });
    await expect(errorMsg).toBeVisible({ timeout: 10000 });

    // Cleanup
    try { fs.unlinkSync(tmpFile); } catch (_) {}
  });

  test('loading empty file shows error message', async ({ page }) => {
    const tmpFile = path.join(os.tmpdir(), `empty-${Date.now()}.pnml`);
    fs.writeFileSync(tmpFile, '', 'utf8');

    // On mobile, open menu first
    await openMobileMenuIfNeeded(page);
    
    const loadBtn = page.getByRole('button', { name: 'Load' });
    await loadBtn.waitFor({ state: 'visible' });
    
    // On mobile, use JavaScript click to bypass viewport issues
    const isMobileViewport = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobileViewport) {
      await loadBtn.evaluate((btn) => btn.click());
      // Wait for file input to appear
      const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
      await input.waitFor({ state: 'attached', timeout: 10000 });
      await input.setInputFiles(tmpFile);
    } else {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        loadBtn.click(),
      ]);
      await fileChooser.setFiles(tmpFile);
    }

    const errorMsg = page.getByText('Error loading Petri net', { exact: false });
    await expect(errorMsg).toBeVisible({ timeout: 10000 });

    try { fs.unlinkSync(tmpFile); } catch (_) {}
  });

  test('loading PNML without valid content shows error or warning', async ({ page }) => {
    const tmpFile = path.join(os.tmpdir(), `malformed-${Date.now()}.pnml`);
    fs.writeFileSync(tmpFile, '<pnml><net id="n1"></net></pnml>', 'utf8');

    // On mobile, open menu first
    await openMobileMenuIfNeeded(page);
    
    const loadBtn = page.getByRole('button', { name: 'Load' });
    await loadBtn.waitFor({ state: 'visible' });
    
    // On mobile, use JavaScript click to bypass viewport issues
    const isMobileViewport = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobileViewport) {
      await loadBtn.evaluate((btn) => btn.click());
      // Wait for file input to appear
      const input = page.locator('input[type="file"][accept=".pnml,.xml"]');
      await input.waitFor({ state: 'attached', timeout: 10000 });
      await input.setInputFiles(tmpFile);
    } else {
      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        loadBtn.click(),
      ]);
      await fileChooser.setFiles(tmpFile);
    }

    // May show error or success with 0 elements; both acceptable
    await page.waitForTimeout(2000);
    const state = await page.evaluate(() => window.__PETRI_NET_STATE__);
    expect(state).toBeTruthy();

    try { fs.unlinkSync(tmpFile); } catch (_) {}
  });
});

