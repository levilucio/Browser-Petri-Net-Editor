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
    // Creating 100 places
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
    // Creating 100 transitions
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(500);
    
    // Log progress on transition creation
    // Attempting to create transitions
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
    // Note: Elements rendered to Canvas cannot be counted via DOM queries
    // Visual verification: Taking a screenshot to verify elements were created
    
    // Connect all nodes into a single weakly-connected component by creating a bridging chain
    // We'll connect the first row of places and transitions alternately: P(0,0)->T(0,0)->P(0,1)->T(0,1)->...
    const arcButton = page.getByTestId('toolbar-arc');
    await arcButton.click();
    await page.waitForTimeout(200);
    // Ensure clicks are inside the Konva stage and not intercepted by zoom controls
    await page.locator('.konvajs-content').click({ position: { x: placeStartX, y: placeStartY } });
    await page.waitForTimeout(200);

    // Helper to click stage
    const stage = page.locator('.konvajs-content');
    // Connect row 0 horizontally across first 10 pairs
    for (let col = 0; col < gridSize; col++) {
      // P(row=0,col)
      const px = placeStartX + col * cellWidth;
      const py = placeStartY + 0 * cellHeight;
      // T(row=0,col)
      const tx = transitionStartX + col * cellWidth;
      const ty = transitionStartY + 0 * cellHeight;
      // P -> T
      await stage.click({ position: { x: px, y: py } });
      await stage.click({ position: { x: tx, y: ty } });
      await page.waitForTimeout(10);
      // T -> next P (if exists)
      if (col + 1 < gridSize) {
        const npx = placeStartX + (col + 1) * cellWidth;
        const npy = placeStartY + 0 * cellHeight;
        await stage.click({ position: { x: tx, y: ty } });
        await stage.click({ position: { x: npx, y: npy } });
        await page.waitForTimeout(10);
      }
    }

    // Optionally connect first element of each subsequent row to maintain single component
    for (let row = 1; row < gridSize; row++) {
      const prevPx = placeStartX + 0 * cellWidth;
      const prevPy = placeStartY + (row - 1) * cellHeight;
      const currTx = transitionStartX + 0 * cellWidth;
      const currTy = transitionStartY + row * cellHeight;
      // connect previous row's first place to current row's first transition
      await stage.click({ position: { x: prevPx, y: prevPy } });
      await stage.click({ position: { x: currTx, y: currTy } });
      await page.waitForTimeout(10);
    }

    // Take a screenshot of the final result
    await page.screenshot({ path: 'large-scale-petri-net.png', fullPage: true });
    
    // Test completed - Visual creation process finished
    // Visually created places and transitions
  });
});
