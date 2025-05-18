// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Arc Creation Test', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
    // Wait for the app to be fully loaded
    await page.waitForSelector('button:has-text("Place")');
    await page.waitForSelector('.stage-container');
  });

  test('should create a simple Petri net with arcs', async ({ page }) => {
    // First clear the canvas to ensure a clean state
    const clearButton = page.locator('button:has-text("Clear")');
    await expect(clearButton).toBeVisible();
    await clearButton.click();
    await page.waitForTimeout(1000);

    // Expose a helper function to check the state
    await page.evaluate(() => {
      // @ts-ignore - Adding custom function to window
      window.getNetState = () => {
        // @ts-ignore - Custom property added for testing
        return window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
      };
    });

    console.log('Creating a simple Petri net with arcs...');

    // Step 1: Create a place
    const placeButton = page.locator('button:has-text("Place")');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(500);

    // Add a place at position (200, 200)
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);

    // Step 2: Create a transition
    const transitionButton = page.locator('button:has-text("Transition")');
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
    
    console.log(`Created ${elements.places.length} place and ${elements.transitions.length} transition`);
    expect(elements.places.length).toBe(1);
    expect(elements.transitions.length).toBe(1);

    // Step 3: Create an arc from place to transition
    console.log('Creating an arc from place to transition...');
    const arcButton = page.locator('button:has-text("Arc")');
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

    console.log(`Final state: ${finalState.places.length} place, ${finalState.transitions.length} transition, ${finalState.arcs.length} arc`);
    
    // Take a screenshot of the result
    await page.screenshot({ path: 'simple-petri-net.png' });
    
    // Verify the arc was created
    expect(finalState.arcs.length).toBe(1);
  });
});
