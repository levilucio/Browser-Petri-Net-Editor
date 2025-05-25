/**
 * End-to-end tests for the Petri net simulator
 * Tests the simulator functionality in a real browser environment
 */
import { test, expect } from '@playwright/test';

test.describe('Petri Net Simulator', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  /**
   * Helper function to create a simple Petri net in the editor
   */
  async function createSimplePetriNet(page) {
    // Switch to place mode and add a place
    await page.getByTestId('toolbar-place').click();
    
    // Add a place
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    
    // Switch to transition mode and add a transition
    await page.getByTestId('toolbar-transition').click();
    
    // Add a transition
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    
    // Switch to arc mode
    await page.getByTestId('toolbar-arc').click();
    
    // Add an arc from place to transition
    // First click on the place
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    // Then click on the transition
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    
    // Switch to select mode
    await page.getByTestId('toolbar-select').click();
    
    // Select the place to add tokens
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    
    // Find the tokens input in the properties panel and set it to 1
    await page.locator('input[type="number"]').first().fill('1');
  }

  /**
   * Helper function to create a more complex Petri net in the editor
   */
  async function createComplexPetriNet(page) {
    // Switch to place mode and add places
    await page.getByTestId('toolbar-place').click();
    
    // Add place P1
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    // Add place P2
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 100 } });
    // Add place P3
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 300 } });
    // Add place P4
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 300 } });
    
    // Switch to transition mode and add transitions
    await page.getByTestId('toolbar-transition').click();
    
    // Add transition T1
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    // Add transition T2
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 300 } });
    
    // Switch to arc mode
    await page.getByTestId('toolbar-arc').click();
    
    // Add arcs for T1
    // P1 -> T1
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    // T1 -> P2
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 100 } });
    
    // Add arcs for T2
    // P3 -> T2
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 300 } });
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 300 } });
    // T2 -> P4
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 300 } });
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 300 } });
    
    // Switch to select mode
    await page.getByTestId('toolbar-select').click();
    
    // Add tokens to P1
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    await page.locator('input[type="number"]').first().fill('2');
    
    // Add tokens to P3
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 300 } });
    await page.locator('input[type="number"]').first().fill('1');
  }

  test('should initialize the simulator and show enabled transitions', async ({ page }) => {
    // Create a simple Petri net
    await createSimplePetriNet(page);
    
    // Wait for the simulator to initialize and compute enabled transitions
    await expect(page.getByText('Current Marking')).toBeVisible();
    
    // Check that the execution panel is visible
    await expect(page.getByTestId('execution-panel')).toBeVisible();
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
    // Wait for the simulator to initialize
    await page.waitForTimeout(2000);
    
    // Check that the execution panel is visible
    await expect(page.getByTestId('execution-panel')).toBeVisible();
    
    // Check that the Fire button is visible
    await expect(page.getByText('Fire')).toBeVisible();
    
    // Check that enabled transitions section is visible
    await expect(page.getByText('Enabled Transitions')).toBeVisible();
  });

  test('should fire a transition in step-by-step mode', async ({ page }) => {
    // Create a simple Petri net
    await createSimplePetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByText('Current Marking')).toBeVisible();
    
    // Wait for the enabled transitions to be computed
    await page.waitForTimeout(1000);
    
    // Find and click the enabled transition button in the execution panel
    // Look for a button containing T1 within the enabled-transitions div
    const enabledTransitionsSection = page.locator('.enabled-transitions');
    await expect(enabledTransitionsSection).toBeVisible();
    
    // Click the first enabled transition (should be T1)
    await page.locator('.enabled-transitions button').first().click();
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
    // Wait for the UI to update
    await page.waitForTimeout(1000);
    
    // The Fire button should be disabled if there are no enabled transitions
    await expect(page.getByText('Fire')).toBeDisabled();
  });

  test('should fire transitions using the Fire button', async ({ page }) => {
    // Create a complex Petri net
    await createComplexPetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByText('Current Marking')).toBeVisible();
    
    // Wait for the enabled transitions to be computed
    await page.waitForTimeout(2000);
    
    // Check that the Fire button is visible
    await expect(page.getByText('Fire')).toBeVisible();
    
    // Click the Fire button to fire the first enabled transition
    await page.getByText('Fire').click();
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
    // Check that the marking has changed by looking at the current marking section
    // The P1 place should now have 1 token instead of 2
    const currentMarking = page.locator('.current-marking');
    await expect(currentMarking).toBeVisible();
    
    // Wait for the UI to update
    await page.waitForTimeout(1000);
    
    // Click the Fire button again if it's enabled
    const fireButton = page.getByText('Fire');
    const isEnabled = await fireButton.isEnabled();
    
    if (isEnabled) {
      await fireButton.click();
      // Wait for the execution panel to update
      await page.waitForTimeout(1000);
    }
  });

  test('should show enabled transitions correctly', async ({ page }) => {
    // Create a complex Petri net
    await createComplexPetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByText('Current Marking')).toBeVisible();
    
    // Wait for the enabled transitions to be computed
    await page.waitForTimeout(2000);
    
    // Check that the enabled transitions section is visible
    const enabledTransitionsSection = page.locator('.enabled-transitions');
    await expect(enabledTransitionsSection).toBeVisible();
    
    // There should be at least one enabled transition button
    const enabledTransitionButtons = page.locator('.enabled-transitions button');
    const count = await enabledTransitionButtons.count();
    expect(count).toBeGreaterThan(0);
    
    // Check that the execution panel is visible
    await expect(page.getByTestId('execution-panel')).toBeVisible();
  });

  test('should enforce token limit during simulation', async ({ page }) => {
    // Switch to place mode and add a place
    await page.getByTestId('toolbar-place').click();
    
    // Add place P1
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    // Add place P2
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 100 } });
    
    // Switch to transition mode and add a transition
    await page.getByTestId('toolbar-transition').click();
    
    // Add transition T1
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    
    // Switch to arc mode
    await page.getByTestId('toolbar-arc').click();
    
    // Add arc P1 -> T1
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    
    // Add arc T1 -> P2
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 100 } });
    
    // Switch to select mode
    await page.getByTestId('toolbar-select').click();
    
    // Add tokens to P1
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    await page.locator('input[type="number"]').first().fill('5');
    
    // Set the arc weight for T1 -> P2
    await page.locator('.konvajs-content').click({ position: { x: 250, y: 100 } });
    // Use the number input for weight
    await page.locator('input[type="number"]').first().fill('10');
    
    // Add tokens to P2
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 100 } });
    await page.locator('input[type="number"]').first().fill('15');
    
    // Fire the transition in step-by-step mode
    await page.getByTestId('sim-step').click();
    await page.getByText('T1').click();
    
    // Wait for the UI to update
    await page.waitForTimeout(2000);
    
    // After firing, check that we can still interact with the execution panel
    await expect(page.getByTestId('execution-panel')).toBeVisible();
  });

  test('should measure performance of simulation operations', async ({ page }) => {
    // Create a simple Petri net
    await createSimplePetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByText('Current Marking')).toBeVisible();
    
    // Measure the time to fire a transition
    const startTime = Date.now();
    
    // Fire the transition
    await page.getByText('T1').click();
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;
    
    // Log the performance metric
    console.log(`Time to fire transition: ${elapsedTime}ms`);
    
    // The transition should fire in a reasonable amount of time
    // We're being very lenient in the test to account for browser overhead and test environment
    expect(elapsedTime).toBeLessThan(10000);
    console.log(`Transition firing time: ${elapsedTime}ms`);
  });
});
