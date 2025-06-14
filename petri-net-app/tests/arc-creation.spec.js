// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Arc Creation Test', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
    // Wait for the app to be fully loaded
    await page.waitForSelector('[data-testid="toolbar-place"]');
    await page.waitForSelector('.stage-container');
  });

  test('should create a simple Petri net with arcs', async ({ page }) => {
    // We'll start with a fresh canvas since we're at the beginning of the test
    // No need to clear it explicitly
    await page.waitForTimeout(500);

    // Expose a helper function to check the state
    await page.evaluate(() => {
      // @ts-ignore - Adding custom function to window
      window.getNetState = () => {
        // @ts-ignore - Custom property added for testing
        return window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
      };
    });

    // Creating a simple Petri net with arcs

    // Step 1: Create a place
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(500);

    // Add a place at position (200, 200)
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);

    // Step 2: Create a transition
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(500);

    // Add a transition at position (300, 200)
    await page.mouse.click(300, 200);
    await page.waitForTimeout(500);

    // Verify place and transition were created
    const elements = await page.evaluate(() => {
      // @ts-ignore - Custom function added to window
      return window.getNetState();
    });
    
    // Created places and transitions
    expect(elements.places.length).toBe(1);
    expect(elements.transitions.length).toBe(1);

    // Step 3: Create an arc from place to transition
    // Creating an arc from place to transition
    const arcButton = page.locator('[data-testid="toolbar-arc"]');
    await expect(arcButton).toBeVisible();
    await arcButton.click();
    await page.waitForTimeout(1000);

    // Click on the place first
    await page.mouse.move(200, 200);
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(1000);

    // Then click on the transition
    await page.mouse.move(300, 200);
    await page.waitForTimeout(300);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(1000);

    // Verify arc was created
    const finalState = await page.evaluate(() => {
      // @ts-ignore - Custom function added to window
      return window.getNetState();
    });

    // Final state includes places, transitions, and arcs
    
    // Take a screenshot of the result
    await page.screenshot({ path: 'simple-petri-net.png' });
    
    // Verify the arc was created
    expect(finalState.arcs.length).toBe(1);
  });
});
