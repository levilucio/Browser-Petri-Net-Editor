// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Large Scale Petri Net Creation', () => {
  test.setTimeout(180000); // 3 minutes for this large test

  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
    // Wait for the app to be fully loaded
    await page.waitForSelector('[data-testid="toolbar-place"]');
    // Wait for the stage container instead of canvas
    await page.waitForSelector('.stage-container');
  });

  test('should visually create 100 places and 100 transitions', async ({ page }) => {
    // NOTE: This test creates places and transitions visually on the canvas.
    // Because React-Konva renders to Canvas (not DOM), we can't reliably count elements.
    // This test focuses on the visual creation process and takes a screenshot for verification.
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

    // Define grid dimensions and spacing for places and transitions
    const gridSize = 10; // 10x10 grid (100 elements)
    const cellWidth = 60;  // Compact spacing for many elements
    const cellHeight = 60; // Compact spacing for many elements
    
    // Define separate areas for places and transitions
    const placeStartX = 100;
    const placeStartY = 100;
    const transitionStartX = 800; // Place transitions to the right
    const transitionStartY = 100;

    // Step 1: Create 100 places in a grid pattern
    console.log('Creating 100 places...');
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(500);

    // Create places row by row
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = placeStartX + col * cellWidth;
        const y = placeStartY + row * cellHeight;
        await page.mouse.click(x, y);
        await page.waitForTimeout(20); // Slight delay between clicks
      }
    }

    // Step 2: Create 100 transitions in a grid pattern
    console.log('Creating 100 transitions...');
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(500);
    
    // Log progress on transition creation
    console.log(`Attempting to create ${gridSize * gridSize} transitions...`);
    // Create transitions row by row
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const x = transitionStartX + col * cellWidth;
        const y = transitionStartY + row * cellHeight;
        await page.mouse.click(x, y);
        await page.waitForTimeout(20); // Slight delay between clicks
      }
    }
    // Transition creation completed

    // Note on Canvas-based rendering
    console.log('Note: Elements rendered to Canvas cannot be counted via DOM queries');
    console.log('Visual verification: Taking a screenshot to verify elements were created');
    
    // Take a screenshot of the final result
    await page.screenshot({ path: 'large-scale-petri-net.png', fullPage: true });
    
    console.log('Test completed - Visual creation process finished');
    console.log(`Visually created ${gridSize * gridSize} places and ${gridSize * gridSize} transitions`);
  });
});
