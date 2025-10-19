// @ts-check
import { test, expect } from '@playwright/test';

async function getPetriNetState(page, retries = 10, delay = 500) {
  let attempt = 0;
  while (attempt < retries) {
    const state = await page.evaluate(() => {
      return window['__PETRI_NET_STATE__'] || null;
    });
    if (state && Array.isArray(state.places) && Array.isArray(state.transitions) && Array.isArray(state.arcs)) {
      return state;
    }
    await page.waitForTimeout(delay);
    attempt++;
  }
  throw new Error(`Failed to get Petri net state after ${retries} attempts`);
}

test.describe('Undo/Redo Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="toolbar-place"]', { state: 'visible' });
  });

  test('should undo and redo place creation', async ({ page }) => {
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(1000);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(1000);
    const state = await getPetriNetState(page);
    expect(state.places.length).toBe(1);

    const undoButton = page.locator('button[title="Undo (Ctrl+Z)"]');
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toBeEnabled();
    await undoButton.click();
    await page.waitForTimeout(1000);
    const stateAfterUndo = await getPetriNetState(page);
    expect(stateAfterUndo.places.length).toBe(0);

    const redoButton = page.locator('button[title="Redo (Ctrl+Y)"]');
    await expect(redoButton).toBeVisible();
    await expect(redoButton).toBeEnabled();
    await redoButton.click();
    await page.waitForTimeout(1000);
    const stateAfterRedo = await getPetriNetState(page);
    expect(stateAfterRedo.places.length).toBe(1);
  });

  test('should undo and redo using keyboard shortcuts', async ({ page }) => {
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(1000);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(1000);
    const state = await getPetriNetState(page);
    expect(state.transitions.length).toBe(1);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);
    const stateAfterUndo = await getPetriNetState(page);
    expect(stateAfterUndo.transitions.length).toBe(0);
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(1000);
    const stateAfterRedo = await getPetriNetState(page);
    expect(stateAfterRedo.transitions.length).toBe(1);
  });

  test('should undo and redo multiple actions in sequence', async ({ page }) => {
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await placeButton.click();
    await page.waitForTimeout(1000);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(1000);
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await transitionButton.click();
    await page.waitForTimeout(1000);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(1000);
    const arcButton = page.locator('[data-testid="toolbar-arc"]');
    await arcButton.click();
    await page.waitForTimeout(1000);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(1000);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(1500);
    const state = await getPetriNetState(page);
    expect(state.places.length).toBe(1);
    expect(state.transitions.length).toBe(1);
    expect(state.arcs.length).toBe(1);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(1000);
    }
    const stateAfterUndo = await getPetriNetState(page);
    expect(stateAfterUndo.places.length).toBe(0);
    expect(stateAfterUndo.transitions.length).toBe(0);
    expect(stateAfterUndo.arcs.length).toBe(0);
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+y');
      await page.waitForTimeout(1000);
    }
    const stateAfterRedo = await getPetriNetState(page);
    expect(stateAfterRedo.places.length).toBe(1);
    expect(stateAfterRedo.transitions.length).toBe(1);
    expect(stateAfterRedo.arcs.length).toBe(1);
  });

  test('should disable undo button when no actions to undo', async ({ page }) => {
    const undoButton = page.locator('button[title="Undo (Ctrl+Z)"]');
    await page.waitForSelector('button[title="Undo (Ctrl+Z)"]', { state: 'visible' });
    await expect(undoButton).toBeDisabled();
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await placeButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    await expect(undoButton).toBeEnabled();
    await undoButton.click();
    await page.waitForTimeout(300);
    await expect(undoButton).toBeDisabled();
  });

  test('should disable redo button when no actions to redo', async ({ page }) => {
    const redoButton = page.locator('button[title="Redo (Ctrl+Y)"]');
    await page.waitForSelector('button[title="Redo (Ctrl+Y)"]', { state: 'visible' });
    await expect(redoButton).toBeDisabled();
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await placeButton.click();
    await page.waitForTimeout(500);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);
    const undoButton = page.locator('button[title="Undo (Ctrl+Z)"]');
    await undoButton.click();
    await page.waitForTimeout(300);
    await expect(redoButton).toBeEnabled();
    await redoButton.click();
    await page.waitForTimeout(300);
    await expect(redoButton).toBeDisabled();
  });
});


