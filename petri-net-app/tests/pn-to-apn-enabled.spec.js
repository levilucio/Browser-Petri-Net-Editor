// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady } from './helpers.js';

async function triggerLoadWithFile(page, absolutePath) {
  // Click the Load button which opens a hidden <input type="file"> programmatically
  // Then set the file on the newly created input element
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: 'Load' }).click(),
  ]);
  await fileChooser.setFiles(absolutePath);
}

test.describe('PN -> APN switching preserves enabled transitions UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('loading PN then APN shows enabled transitions for APN', async ({ page }) => {
    // Load a plain P/T net first
    await triggerLoadWithFile(page, 'tests/test-inputs/petri-net4.pnml');

    // Open Enabled Transitions panel
    await page.getByTestId('show-enabled-transitions').click();

    // Expect some enabled transitions to be listed for the PT net (can be zero if model has none)
    // We at least ensure the panel rendered.
    await expect(page.getByTestId('enabled-transitions')).toBeVisible();

    // Immediately load the APN
    await triggerLoadWithFile(page, 'tests/test-inputs/petri-net5.pnml');

    // Panel remains visible and should reflect APN enabled transitions state after load
    await expect(page.getByTestId('enabled-transitions')).toBeVisible();

    // Wait until enabled transitions reflect APN state
    // We expose enabled transition ids on window for test reliability
    const enabledAfterApn = await page.waitForFunction(() => {
      // @ts-ignore
      const ids = (window.__ENABLED_TRANSITIONS__ || []);
      return Array.isArray(ids) && ids.length > 0 ? ids : null;
    }, { timeout: 7000 });

    const ids = await enabledAfterApn.jsonValue();
    expect(Array.isArray(ids)).toBeTruthy();
    expect(ids.length).toBeGreaterThan(0);
  });
});


