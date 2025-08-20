// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Petri Net Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
  });

  test('should add a place to the canvas', async ({ page }) => {
    // Find the place button in the toolbar
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();

    // Get the canvas element
    const canvas = page.locator('[data-testid="canvas"]');
    
    // Switch to place mode
    await placeButton.click();
    
    // Wait a moment for the mode to change
    await page.waitForTimeout(500);
    
    // Click on the canvas to add a place
    // We need to click on the actual Konva stage which might be inside the canvas container
    await page.mouse.click(200, 200);
    
    // Wait for the place to be rendered
    await page.waitForTimeout(500);
    
    // Verify that a place was added to the canvas by checking the exposed state
    const placesCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.places?.length || 0;
    });
    
    expect(placesCount).toBeGreaterThan(0);
  });

  test('should toggle grid snapping', async ({ page }) => {
    // Find and click the grid snap toggle
    const gridSnapToggle = page.locator('[data-testid="grid-snap-toggle"]');
    await expect(gridSnapToggle).toBeVisible();
    
    // Get the initial checked state
    const initialChecked = await gridSnapToggle.isChecked();
    
    // Click to toggle
    await gridSnapToggle.click();
    
    // Verify the toggle state changed
    if (initialChecked) {
      await expect(gridSnapToggle).not.toBeChecked();
    } else {
      await expect(gridSnapToggle).toBeChecked();
    }
  });

  test('should create place, transition, arc and then delete the arc', async ({ page }) => {
    // Step 1: Add a place
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(300);
    
    // Click to add a place at position (200, 200)
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Verify place was added
    const placesCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.places?.length || 0;
    });
    expect(placesCount).toBeGreaterThan(0);
    
    // Step 2: Add a transition
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(300);
    
    // Click to add a transition at position (300, 200)
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);
    
    // Verify transition was added
    const transitionsCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.transitions?.length || 0;
    });
    expect(transitionsCount).toBeGreaterThan(0);
    
    // Step 3: Create an arc from place to transition
    const arcButton = page.locator('[data-testid="toolbar-arc"]');
    await expect(arcButton).toBeVisible();
    await arcButton.click();
    await page.waitForTimeout(300);
    
    // Click on the place to start the arc
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Click on the transition to complete the arc
    await page.mouse.click(300, 200);
    await page.waitForTimeout(500); // Give more time for arc creation
    
    // Verify arc was created
    const arcsCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.arcs?.length || 0;
    });
    expect(arcsCount).toBeGreaterThan(0);
    
    // Step 4: Select and delete the arc
    // First, switch to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(300);
    
    // Compute arc midpoint from actual element positions and click to select the arc
    const { midX, midY } = await page.evaluate(() => {
      // @ts-ignore - test hook
      const s = window.__PETRI_NET_STATE__;
      const p = s.places[0];
      const t = s.transitions[0];
      return { midX: (p.x + t.x) / 2, midY: (p.y + t.y) / 2 };
    });
    const stage = page.locator('.konvajs-content');
    const delPts = [
      { x: midX, y: midY },
      { x: midX + 3, y: midY + 1 },
      { x: midX - 3, y: midY - 1 },
    ];
    for (const pt of delPts) {
      await stage.click({ position: pt });
      try {
        await page.getByText(/Weight \(1-\d+\)/).waitFor({ timeout: 400 });
        break;
      } catch (_) {}
    }
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    
    // Verify arc was deleted
    const finalArcsCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.arcs?.length || 0;
    });
    expect(finalArcsCount).toBe(0);

    // Ensure PN remains fully connected by removing now-isolated elements
    // Delete the transition
    await page.mouse.click(300, 200);
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    // Delete the place
    await page.mouse.click(200, 200);
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    // Net should now be empty (trivially connected)
    const finalCounts = await page.evaluate(() => {
      // @ts-ignore
      const s = window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
      return { places: s.places.length || 0, transitions: s.transitions.length || 0, arcs: s.arcs.length || 0 };
    });
    expect(finalCounts.places).toBe(0);
    expect(finalCounts.transitions).toBe(0);
    expect(finalCounts.arcs).toBe(0);
  });

  test('should create a transition with two places and delete the transition with its arcs', async ({ page }) => {
    // Step 1: Add a transition in the middle
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(300);
    
    // Click to add a transition at position (300, 200)
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);
    
    // Step 2: Add first place on the left
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(300);
    
    // Click to add a place at position (200, 150)
    await page.mouse.click(200, 150);
    await page.waitForTimeout(300);
    
    // Step 3: Add second place on the right
    // Still in place mode, add another place
    await page.mouse.click(400, 250);
    await page.waitForTimeout(300);
    
    // Verify we have 2 places and 1 transition
    const placesCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.places?.length || 0;
    });
    const transitionsCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.transitions?.length || 0;
    });
    
    expect(placesCount).toBe(2);
    expect(transitionsCount).toBe(1);
    
    // Step 4: Create an arc from transition to first place
    const arcButton = page.getByTestId('toolbar-arc');
    await expect(arcButton).toBeVisible();
    await arcButton.click();
    await page.waitForTimeout(300);
    
    // Click on the transition to start the arc
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);
    
    // Click on the first place to complete the arc
    await page.mouse.click(200, 150);
    await page.waitForTimeout(500);
    
    // Step 5: Create an arc from transition to second place
    // Still in arc mode
    // Click on the transition to start the arc
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);
    
    // Click on the second place to complete the arc
    await page.mouse.click(400, 250);
    await page.waitForTimeout(500);
    
    // Verify we have 2 arcs
    const arcsCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.arcs?.length || 0;
    });
    expect(arcsCount).toBe(2);
    
    // Step 6: Select and delete the transition
    const selectButton = page.getByTestId('toolbar-select');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(300);
    
    // Click on the transition to select it
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);
    
    // Press Delete key to remove the transition
    await page.keyboard.press('Delete');
    await page.waitForTimeout(500);
    
    // Verify transition was deleted
    const finalTransitionsCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.transitions?.length || 0;
    });
    expect(finalTransitionsCount).toBe(0);
    
    // Verify arcs were also deleted
    const finalArcsCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.arcs?.length || 0;
    });
    expect(finalArcsCount).toBe(0);
    
    // Remove remaining isolated places to keep the PN fully connected (empty)
    // Delete place at (200, 150)
    await page.mouse.click(200, 150);
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);
    // Delete place at (400, 250)
    await page.mouse.click(400, 250);
    await page.waitForTimeout(200);
    await page.keyboard.press('Delete');
    await page.waitForTimeout(300);

    const finalPlacesCount = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__?.places?.length || 0;
    });
    expect(finalPlacesCount).toBe(0);
  });
});
