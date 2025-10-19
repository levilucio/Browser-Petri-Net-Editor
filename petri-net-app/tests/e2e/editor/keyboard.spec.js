// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, getPetriNetState, waitForState, clickStage } from '../../helpers.js';

test.describe('Editor keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test.fixme('Ctrl+C / Ctrl+V duplicates selected node; Delete removes it', async ({ page }) => {
    // Add two places
    const placeBtn = page.getByTestId('toolbar-place');
    await placeBtn.click();
    await clickStage(page, { x: 200, y: 200 });
    await clickStage(page, { x: 320, y: 200 });
    await waitForState(page, s => (s.places?.length || 0) >= 2);
    const before = await getPetriNetState(page);
    const beforePlaces = before.places.length || 0;

    // Select one place by click in select mode
    const selectBtn = page.getByTestId('toolbar-select');
    await selectBtn.click();
    await clickStage(page, { x: 200, y: 200 });

    // Copy/Paste
    await page.keyboard.press('Control+C');
    await page.keyboard.press('Control+V');
    await waitForState(page, s => (s.places?.length || 0) === beforePlaces + 1);

    // Delete newly pasted selection
    await page.keyboard.press('Delete');
    await waitForState(page, s => (s.places?.length || 0) === beforePlaces);
    const after = await getPetriNetState(page);
    expect(after.places.length).toBe(beforePlaces);
  });

  test('Backspace deletes a single selected node', async ({ page }) => {
    // Add one place
    const placeBtn = page.getByTestId('toolbar-place');
    await placeBtn.click();
    await clickStage(page, { x: 260, y: 240 });
    await waitForState(page, s => (s.places?.length || 0) >= 1);
    const before = await getPetriNetState(page);
    const beforePlaces = before.places.length || 0;

    // Select and delete
    const selectBtn = page.getByTestId('toolbar-select');
    await selectBtn.click();
    await clickStage(page, { x: 260, y: 240 });
    await page.keyboard.press('Backspace');
    await waitForState(page, s => (s.places?.length || 0) === Math.max(0, beforePlaces - 1));
  });
});


