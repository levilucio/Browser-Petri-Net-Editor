// @ts-check
import { test, expect } from '@playwright/test';

// Add TypeScript declaration for the custom window property
/**
 * @typedef {Object} PetriNetState
 * @property {Array<Object>} places - Array of place objects
 * @property {Array<Object>} transitions - Array of transition objects
 * @property {Array<Object>} arcs - Array of arc objects
 */

/**
 * @typedef {Object} Window
 * @property {PetriNetState} [__PETRI_NET_STATE__] - Custom property added for testing
 */

test.describe('Arc Cancellation Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
  });

  test('should cancel arc creation when clicking on empty canvas', async ({ page }) => {
    // Step 1: Create a place
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(300);
    
    // Click on the canvas to add a place
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Step 2: Create a transition
    const transitionButton = page.locator('button:has-text("Transition")');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(300);
    
    // Click on the canvas to add a transition
    await page.mouse.click(400, 200);
    await page.waitForTimeout(300);
    
    // Verify we have 1 place and 1 transition
    const initialState = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      const state = window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
      return {
        places: state.places?.length || 0,
        transitions: state.transitions?.length || 0,
        arcs: state.arcs?.length || 0
      };
    });
    
    expect(initialState.places).toBe(1);
    expect(initialState.transitions).toBe(1);
    expect(initialState.arcs).toBe(0);
    
    // Step 3: Start creating an arc
    const arcButton = page.locator('button:has-text("Arc")');
    await expect(arcButton).toBeVisible();
    await arcButton.click();
    await page.waitForTimeout(300);
    
    // Click on the place to start the arc
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Step 4: Cancel arc creation by clicking on empty canvas
    // Click on an empty area of the canvas (away from both place and transition)
    await page.mouse.click(300, 300);
    await page.waitForTimeout(500);
    
    // Step 5: Verify no arc was created
    const finalState = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      const state = window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
      return {
        places: state.places?.length || 0,
        transitions: state.transitions?.length || 0,
        arcs: state.arcs?.length || 0
      };
    });
    
    // The state should remain unchanged - still 1 place, 1 transition, and 0 arcs
    expect(finalState.places).toBe(1);
    expect(finalState.transitions).toBe(1);
    expect(finalState.arcs).toBe(0);
    
    // Step 6: Verify we can start a new arc (arc creation mode was properly cancelled)
    // Click on the place again to start a new arc
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Click on the transition to complete the arc
    await page.mouse.click(400, 200);
    await page.waitForTimeout(500);
    
    // Verify the arc was created this time
    const finalStateWithArc = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      const state = window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
      return {
        places: state.places?.length || 0,
        transitions: state.transitions?.length || 0,
        arcs: state.arcs?.length || 0
      };
    });
    
    expect(finalStateWithArc.places).toBe(1);
    expect(finalStateWithArc.transitions).toBe(1);
    expect(finalStateWithArc.arcs).toBe(1);
  });
});
