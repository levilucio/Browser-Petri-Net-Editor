// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, clickStage, getVisibleToolbarButton, openMobileMenuIfNeeded } from '../../helpers.js';

test.describe('PNML - Save fallback when File System Access API fails', () => {
  test('save completes when showSaveFilePicker unavailable (fallback flow)', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    // Create a minimal net
    const placeButton = await getVisibleToolbarButton(page, 'toolbar-place');
    await placeButton.click();
    await clickStage(page, { x: 200, y: 200 });

    // Remove showSaveFilePicker API to force fallback blob download
    await page.evaluate(() => {
      delete window.showSaveFilePicker;
    });

    // Trigger Save; in Playwright's context it won't actually download but won't error either
    await openMobileMenuIfNeeded(page);
    const saveButton = page.getByRole('button', { name: 'Save', exact: true });
    const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobile) {
      // On mobile, the Save button is in the drawer - use evaluate click to bypass viewport issues
      await saveButton.evaluate(node => node.click());
    } else {
      await saveButton.click();
    }
    
    // Wait a bit and verify no error appeared
    await page.waitForTimeout(1500);
    const errorMsg = page.getByText('Error saving', { exact: false });
    await expect(errorMsg).not.toBeVisible();
  });
});

