// @ts-check
import { test, expect } from '@playwright/test';
import { waitForAppReady, getPetriNetState, waitForState, clickStage, getVisibleToolbarButton } from '../../helpers.js';

test.describe('Petri Net Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('should add a place to the canvas', async ({ page }) => {
    // Find the place button in the toolbar
    const placeButton = await getVisibleToolbarButton(page, 'toolbar-place');

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
    // Skip on mobile as grid snap toggle is hidden
    const isMobile = await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    if (isMobile) {
      test.skip();
      return;
    }
    
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

  test('Save as button is disabled before first save', async ({ page }) => {
    await page.goto('/');
    // locate Save and Save as by their button text
    const saveButton = page.getByRole('button', { name: /^Save$/ });
    const saveAsButton = page.getByRole('button', { name: /^Save as$/ });
    await expect(saveButton).toBeEnabled();
    await expect(saveAsButton).toBeDisabled();
  });

  test('should create place, transition, arc and then delete the arc', async ({ page }) => {
    // Step 1: Add a place
    const placeButton = await getVisibleToolbarButton(page, 'toolbar-place');
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
    const transitionButton = await getVisibleToolbarButton(page, 'toolbar-transition');
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
    const arcButton = await getVisibleToolbarButton(page, 'toolbar-arc');
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
    const selectButton = await getVisibleToolbarButton(page, 'toolbar-select');
    await selectButton.click();
    await page.waitForTimeout(300);
    
    // Compute arc midpoint from actual element positions and click to select the arc
    const { midX, midY } = await page.evaluate(() => {
      // @ts-ignore - test hook
      const s = window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
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

  test('should select all elements with Ctrl+A', async ({ page }) => {
    // Create a place
    const placeButton = await getVisibleToolbarButton(page, 'toolbar-place');
    await placeButton.click();
    await clickStage(page, { x: 100, y: 100 });
    await page.waitForTimeout(300);

    // Create a transition
    const transitionButton = await getVisibleToolbarButton(page, 'toolbar-transition');
    await transitionButton.click();
    await clickStage(page, { x: 200, y: 100 });
    await page.waitForTimeout(300);

    // Create an arc
    const arcButton = await getVisibleToolbarButton(page, 'toolbar-arc');
    await arcButton.click();
    await clickStage(page, { x: 100, y: 100 }); // from place
    await clickStage(page, { x: 200, y: 100 }); // to transition
    await page.waitForTimeout(300);

    // Switch to select mode and press Ctrl+A
    const selectButton = await getVisibleToolbarButton(page, 'toolbar-select');
    await selectButton.click();
    await page.waitForTimeout(200);

    // Press Ctrl+A to select all
    const isMac = await page.evaluate(() => navigator.platform.toUpperCase().includes('MAC'));
    if (isMac) {
      await page.keyboard.down('Meta');
      await page.keyboard.press('a');
      await page.keyboard.up('Meta');
    } else {
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
    }
    await page.waitForTimeout(300);

    // Verify all elements are selected
    const selectedCount = await page.evaluate(() => {
      return window.__PETRI_NET_STATE__?.selectedElements?.length || 0;
    });
    expect(selectedCount).toBe(3); // 1 place + 1 transition + 1 arc
  });

  test('should create a transition with two places and delete the transition with its arcs', async ({ page, browserName }) => {
    // On Mobile Safari (webkit), creating elements in rapid succession can be unreliable
    // due to touch event handling differences. Add extra waits.
    const isMobileSafari = browserName === 'webkit' && await page.evaluate(() => window.matchMedia('(max-width: 1023px)').matches);
    
    // Skip on Mobile Safari - this test is unreliable due to webkit touch event handling
    if (isMobileSafari) {
      test.skip();
      return;
    }
    
    // Step 1: Add a transition in the middle
    const transitionButton = await getVisibleToolbarButton(page, 'toolbar-transition');
    await transitionButton.click();
    await waitForState(page, (s) => true); // ensure state is readable
    
    // Click to add a transition at position (300, 200)
    await clickStage(page, { x: 300, y: 200 });
    await waitForState(page, (s) => (s.transitions?.length || 0) === 1);
    
    // Step 2: Add first place on the left
    const placeButton = await getVisibleToolbarButton(page, 'toolbar-place');
    await placeButton.click();
    await waitForState(page, (s) => true);
    
    // Click to add a place at position (200, 150)
    await clickStage(page, { x: 200, y: 150 });
    await waitForState(page, (s) => (s.places?.length || 0) >= 1);
    
    // Step 3: Add second place on the right
    // Still in place mode, add another place
    await clickStage(page, { x: 400, y: 250 });
    await waitForState(page, (s) => (s.places?.length || 0) === 2);
    
    // Verify we have 2 places and 1 transition
    const { places: curPlaces, transitions: curTransitions } = await getPetriNetState(page);
    const placesCount2 = curPlaces.length || 0;
    const transitionsCount2 = curTransitions.length || 0;
    
    expect(placesCount2).toBe(2);
    expect(transitionsCount2).toBe(1);
    
    // Step 4: Create an arc from transition to first place
    const arcButton = await getVisibleToolbarButton(page, 'toolbar-arc');
    await arcButton.click();
    await waitForState(page, (s) => true);
    
    // Click on the transition to start the arc
    await clickStage(page, { x: 300, y: 200 });
    await waitForState(page, (s) => true);
    
    // Click on the first place to complete the arc
    await clickStage(page, { x: 200, y: 150 });
    await waitForState(page, (s) => (s.arcs?.length || 0) >= 1);
    
    // Step 5: Create an arc from transition to second place
    // Still in arc mode
    // Click on the transition to start the arc
    await clickStage(page, { x: 300, y: 200 });
    await waitForState(page, (s) => true);
    
    // Click on the second place to complete the arc
    await clickStage(page, { x: 400, y: 250 });
    await waitForState(page, (s) => (s.arcs?.length || 0) === 2);
    
    // Verify we have 2 arcs
    const { arcs } = await getPetriNetState(page);
    const arcsCount2 = arcs.length || 0;
    expect(arcsCount2).toBe(2);
    
    // Step 6: Select and delete the transition
    const selectButton = await getVisibleToolbarButton(page, 'toolbar-select');
    await selectButton.click();
    await waitForState(page, (s) => true);
    
    // Click on the transition to select it
    await clickStage(page, { x: 300, y: 200 });
    await waitForState(page, (s) => true);
    
    // Press Delete key to remove the transition
    await page.keyboard.press('Delete');
    await waitForState(page, (s) => (s.transitions?.length || 0) === 0 && (s.arcs?.length || 0) === 0);
    
    // Verify transition was deleted
    const { transitions: finalTransitions } = await getPetriNetState(page);
    const finalTransitionsCount = finalTransitions.length || 0;
    expect(finalTransitionsCount).toBe(0);
    
    // Verify arcs were also deleted
    const { arcs: finalArcs } = await getPetriNetState(page);
    const finalArcsCount2 = finalArcs.length || 0;
    expect(finalArcsCount2).toBe(0);
    
    // Remove remaining isolated places to keep the PN fully connected (empty)
    // Delete place at (200, 150)
    await clickStage(page, { x: 200, y: 150 });
    await page.keyboard.press('Delete');
    await waitForState(page, (s) => (s.places?.length || 0) === 1);
    // Delete place at (400, 250)
    await clickStage(page, { x: 400, y: 250 });
    await page.keyboard.press('Delete');
    await waitForState(page, (s) => (s.places?.length || 0) === 0);

    const { places: finalPlaces } = await getPetriNetState(page);
    const finalPlacesCount2 = finalPlaces.length || 0;
    expect(finalPlacesCount2).toBe(0);
  });
});


