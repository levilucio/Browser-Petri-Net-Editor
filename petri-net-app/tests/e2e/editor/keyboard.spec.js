// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, getPetriNetState, waitForState, clickStage, getVisibleToolbarButton } from '../../helpers.js';

test.describe('Editor keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

test('Ctrl+C / Ctrl+V duplicates selected node; Delete removes it', async ({ page }) => {
    // Add two places
    const placeBtn = await getVisibleToolbarButton(page, 'toolbar-place');
    await placeBtn.click();
    await clickStage(page, { x: 200, y: 200 });
    await clickStage(page, { x: 320, y: 200 });
    await waitForState(page, s => (s.places?.length || 0) >= 2);
    const before = await getPetriNetState(page);
    const beforePlaces = before.places.length || 0;

    // Select one place by click in select mode
    const selectBtn = await getVisibleToolbarButton(page, 'toolbar-select');
    await selectBtn.click();
    await clickStage(page, { x: 200, y: 200 });
    // Allow selection state to propagate before copy
    await page.waitForTimeout(250);
    // Make sure the stage has focus
    await clickStage(page, { x: 205, y: 205 });

    // Copy/Paste
    const isMac = await page.evaluate(() => navigator.platform.toUpperCase().includes('MAC'));
    if (isMac) {
      await page.keyboard.down('Meta');
      await page.keyboard.press('c');
      await page.keyboard.up('Meta');
      await page.waitForTimeout(100);
      await page.keyboard.down('Meta');
      await page.keyboard.press('v');
      await page.keyboard.up('Meta');
    } else {
      await page.keyboard.down('Control');
      await page.keyboard.press('c');
      await page.keyboard.up('Control');
      await page.waitForTimeout(100);
      await page.keyboard.down('Control');
      await page.keyboard.press('v');
      await page.keyboard.up('Control');
    }
    try {
      await waitForState(page, s => (s.places?.length || 0) === beforePlaces + 1);
    } catch (_) {
      // Retry paste once in case the first keypress was swallowed
      if (isMac) {
        await page.keyboard.down('Meta');
        await page.keyboard.press('v');
        await page.keyboard.up('Meta');
      } else {
        await page.keyboard.down('Control');
        await page.keyboard.press('v');
        await page.keyboard.up('Control');
      }
      await waitForState(page, s => (s.places?.length || 0) === beforePlaces + 1);
    }

    // Delete newly pasted selection
    await page.keyboard.press('Delete');
    await waitForState(page, s => (s.places?.length || 0) === beforePlaces);
    const after = await getPetriNetState(page);
    expect(after.places.length).toBe(beforePlaces);
  });

  test('Backspace deletes a single selected node', async ({ page }) => {
    // Add one place
    const placeBtn = await getVisibleToolbarButton(page, 'toolbar-place');
    await placeBtn.click();
    await clickStage(page, { x: 260, y: 240 });
    await waitForState(page, s => (s.places?.length || 0) >= 1);
    const before = await getPetriNetState(page);
    const beforePlaces = before.places.length || 0;

    // Select and delete
    const selectBtn = await getVisibleToolbarButton(page, 'toolbar-select');
    await selectBtn.click();
    await clickStage(page, { x: 260, y: 240 });
    await page.keyboard.press('Backspace');
    await waitForState(page, s => (s.places?.length || 0) === Math.max(0, beforePlaces - 1));
  });
});


