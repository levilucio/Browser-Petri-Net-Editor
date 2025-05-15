// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Undo/Redo Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
  });

  test('should undo and redo place creation', async ({ page }) => {
    // Find the place button in the toolbar
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    
    // Switch to place mode
    await placeButton.click();
    await page.waitForTimeout(300);
    
    // Click on the canvas to add a place
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Verify that a place was added
    let placesCount = await page.evaluate(() => {
      return window.__PETRI_NET_STATE__?.places?.length || 0;
    });
    expect(placesCount).toBe(1);
    
    // Find the undo button
    const undoButton = page.locator('button[title="Undo (Ctrl+Z)"]');
    await expect(undoButton).toBeVisible();
    
    // Click undo button
    await undoButton.click();
    await page.waitForTimeout(300);
    
    // Verify that the place was removed
    placesCount = await page.evaluate(() => {
      return window.__PETRI_NET_STATE__?.places?.length || 0;
    });
    expect(placesCount).toBe(0);
    
    // Find the redo button
    const redoButton = page.locator('button[title="Redo (Ctrl+Y)"]');
    await expect(redoButton).toBeVisible();
    
    // Click redo button
    await redoButton.click();
    await page.waitForTimeout(300);
    
    // Verify that the place was added back
    placesCount = await page.evaluate(() => {
      return window.__PETRI_NET_STATE__?.places?.length || 0;
    });
    expect(placesCount).toBe(1);
  });

  test('should undo and redo using keyboard shortcuts', async ({ page }) => {
    // Find the transition button in the toolbar
    const transitionButton = page.locator('button:has-text("Transition")');
    await expect(transitionButton).toBeVisible();
    
    // Switch to transition mode
    await transitionButton.click();
    await page.waitForTimeout(300);
    
    // Click on the canvas to add a transition
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);
    
    // Verify that a transition was added
    let transitionsCount = await page.evaluate(() => {
      return window.__PETRI_NET_STATE__?.transitions?.length || 0;
    });
    expect(transitionsCount).toBe(1);
    
    // Use keyboard shortcut Ctrl+Z to undo
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    
    // Verify that the transition was removed
    transitionsCount = await page.evaluate(() => {
      return window.__PETRI_NET_STATE__?.transitions?.length || 0;
    });
    expect(transitionsCount).toBe(0);
    
    // Use keyboard shortcut Ctrl+Y to redo
    await page.keyboard.press('Control+y');
    await page.waitForTimeout(300);
    
    // Verify that the transition was added back
    transitionsCount = await page.evaluate(() => {
      return window.__PETRI_NET_STATE__?.transitions?.length || 0;
    });
    expect(transitionsCount).toBe(1);
  });

  test('should undo and redo multiple actions in sequence', async ({ page }) => {
    // Add a place
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await placeButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Add a transition
    const transitionButton = page.locator('button:has-text("Transition")');
    await transitionButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);
    
    // Create an arc
    const arcButton = page.locator('button:has-text("Arc")');
    await arcButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200); // Click on place
    await page.waitForTimeout(300);
    await page.mouse.click(300, 200); // Click on transition
    await page.waitForTimeout(500);
    
    // Verify we have 1 place, 1 transition, and 1 arc
    let state = await page.evaluate(() => {
      return {
        places: window.__PETRI_NET_STATE__?.places?.length || 0,
        transitions: window.__PETRI_NET_STATE__?.transitions?.length || 0,
        arcs: window.__PETRI_NET_STATE__?.arcs?.length || 0
      };
    });
    
    expect(state.places).toBe(1);
    expect(state.transitions).toBe(1);
    expect(state.arcs).toBe(1);
    
    // Undo three times to remove all elements
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+z');
      await page.waitForTimeout(300);
    }
    
    // Verify all elements are gone
    state = await page.evaluate(() => {
      return {
        places: window.__PETRI_NET_STATE__?.places?.length || 0,
        transitions: window.__PETRI_NET_STATE__?.transitions?.length || 0,
        arcs: window.__PETRI_NET_STATE__?.arcs?.length || 0
      };
    });
    
    expect(state.places).toBe(0);
    expect(state.transitions).toBe(0);
    expect(state.arcs).toBe(0);
    
    // Redo three times to add all elements back
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('Control+y');
      await page.waitForTimeout(300);
    }
    
    // Verify all elements are back
    state = await page.evaluate(() => {
      return {
        places: window.__PETRI_NET_STATE__?.places?.length || 0,
        transitions: window.__PETRI_NET_STATE__?.transitions?.length || 0,
        arcs: window.__PETRI_NET_STATE__?.arcs?.length || 0
      };
    });
    
    expect(state.places).toBe(1);
    expect(state.transitions).toBe(1);
    expect(state.arcs).toBe(1);
  });

  test('should disable undo button when no actions to undo', async ({ page }) => {
    // Initially, the undo button should be disabled
    const undoButton = page.locator('button[title="Undo (Ctrl+Z)"]');
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
    await expect(redoButton).toBeDisabled();
    
    // Add a place and then undo
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await placeButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
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
