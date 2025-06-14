// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Helper function to get the Petri net state with retries
 * @param {import('@playwright/test').Page} page - The Playwright page object
 * @param {number} retries - Number of retries (default: 5)
 * @param {number} delay - Delay between retries in ms (default: 300)
 * @returns {Promise<{places: any[], transitions: any[], arcs: any[]}>} - The Petri net state
 */
async function getPetriNetState(page, retries = 10, delay = 500) {
  let attempt = 0;
  while (attempt < retries) {
    const state = await page.evaluate(() => {
      return window['__PETRI_NET_STATE__'] || null;
    });
    
    if (state && 
        Array.isArray(state.places) && 
        Array.isArray(state.transitions) && 
        Array.isArray(state.arcs)) {
      return state;
    }
    
    // Wait before trying again
    await page.waitForTimeout(delay);
    attempt++;
  }
  
  // If we get here, we couldn't get the state after all retries
  console.error('Failed to get Petri net state after', retries, 'attempts');
  throw new Error(`Failed to get Petri net state after ${retries} attempts`);
}

test.describe('Undo/Redo Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
    
    // Wait for the application to fully load
    await page.waitForSelector('[data-testid="toolbar-place"]', { state: 'visible' });
  });

  test('should undo and redo place creation', async ({ page }) => {
    // Find the place button in the toolbar
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    
    // Switch to place mode
    await placeButton.click();
    await page.waitForTimeout(1000);
    
    // Click on the canvas to add a place
    await page.mouse.click(200, 200);
    await page.waitForTimeout(1000);
    
    // Verify that a place was added
    const state = await getPetriNetState(page);
    expect(state.places.length).toBe(1);
    
    // Find the undo button
    const undoButton = page.locator('button[title="Undo (Ctrl+Z)"]');
    await expect(undoButton).toBeVisible();
    await expect(undoButton).toBeEnabled();
    
    // Click undo button
    await undoButton.click();
    await page.waitForTimeout(1000);
    
    // Verify that the place was removed
    const stateAfterUndo = await getPetriNetState(page);
    expect(stateAfterUndo.places.length).toBe(0);
    
    // Find the redo button
    const redoButton = page.locator('button[title="Redo (Ctrl+Y)"]');
    await expect(redoButton).toBeVisible();
    await expect(redoButton).toBeEnabled();
    
    // Click redo button
    await redoButton.click();
    await page.waitForTimeout(1000);
    
    // Verify that the place was added back
    const stateAfterRedo = await getPetriNetState(page);
    expect(stateAfterRedo.places.length).toBe(1);
  });

  test('should undo and redo using keyboard shortcuts', async ({ page }) => {
    // Find the transition button in the toolbar
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    
    // Switch to transition mode
    await transitionButton.click();
    await page.waitForTimeout(1000);
    
    // Click on the canvas to add a transition
    await page.mouse.click(300, 200);
    await page.waitForTimeout(1000);
    
    // Verify that a transition was added
    const state = await getPetriNetState(page);
    expect(state.transitions.length).toBe(1);
    
    // Use keyboard shortcut Ctrl+Z to undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);
    
    // Verify that the transition was removed
    const stateAfterUndo = await getPetriNetState(page);
    expect(stateAfterUndo.transitions.length).toBe(0);
    
    // Use keyboard shortcut Ctrl+Y to redo
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(1000);
    
    // Verify that the transition was added back
    const stateAfterRedo = await getPetriNetState(page);
    expect(stateAfterRedo.transitions.length).toBe(1);
  });

  test('should undo and redo multiple actions in sequence', async ({ page }) => {
    // Add a place
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await placeButton.click();
    await page.waitForTimeout(1000);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(1000);
    
    // Add a transition
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await transitionButton.click();
    await page.waitForTimeout(1000);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(1000);
    
    // Create an arc
    const arcButton = page.locator('[data-testid="toolbar-arc"]');
    await arcButton.click();
    await page.waitForTimeout(1000);
    await page.mouse.click(200, 200); // Click on place
    await page.waitForTimeout(1000);
    await page.mouse.click(300, 200); // Click on transition
    await page.waitForTimeout(1500);
    
    // Verify we have 1 place, 1 transition, and 1 arc
    const state = await getPetriNetState(page);
    
    expect(state.places.length).toBe(1);
    expect(state.transitions.length).toBe(1);
    expect(state.arcs.length).toBe(1);
    
    // Undo three times to remove all elements
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(1000);
    }
    
    // Verify all elements are gone
    const stateAfterUndo = await getPetriNetState(page);
    
    expect(stateAfterUndo.places.length).toBe(0);
    expect(stateAfterUndo.transitions.length).toBe(0);
    expect(stateAfterUndo.arcs.length).toBe(0);
    
    // Redo three times to add all elements back
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+y');
      await page.waitForTimeout(1000);
    }
    
    // Verify all elements are back
    const stateAfterRedo = await getPetriNetState(page);
    
    expect(stateAfterRedo.places.length).toBe(1);
    expect(stateAfterRedo.transitions.length).toBe(1);
    expect(stateAfterRedo.arcs.length).toBe(1);
  });

  test('should disable undo button when no actions to undo', async ({ page }) => {
    // Initially, the undo button should be disabled
    const undoButton = page.locator('button[title="Undo (Ctrl+Z)"]');
    await page.waitForSelector('button[title="Undo (Ctrl+Z)"]', { state: 'visible' });
    await expect(undoButton).toBeDisabled();
    
    // Add a place
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await placeButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Now the undo button should be enabled
    await expect(undoButton).toBeEnabled();
    
    // Undo the action
    await undoButton.click();
    await page.waitForTimeout(300);
    
    // Now the undo button should be disabled again
    await expect(undoButton).toBeDisabled();
  });

  test('should disable redo button when no actions to redo', async ({ page }) => {
    // Initially, the redo button should be disabled
    const redoButton = page.locator('button[title="Redo (Ctrl+Y)"]');
    await page.waitForSelector('button[title="Redo (Ctrl+Y)"]', { state: 'visible' });
    await expect(redoButton).toBeDisabled();
    
    // Add a place and then undo
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await placeButton.click();
    await page.waitForTimeout(500);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);
    
    const undoButton = page.locator('button[title="Undo (Ctrl+Z)"]');
    await undoButton.click();
    await page.waitForTimeout(300);
    
    // Now the redo button should be enabled
    await expect(redoButton).toBeEnabled();
    
    // Redo the action
    await redoButton.click();
    await page.waitForTimeout(300);
    
    // Now the redo button should be disabled again
    await expect(redoButton).toBeDisabled();
  });
});
