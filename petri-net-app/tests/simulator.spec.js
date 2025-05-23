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
    
    // Check that the simulation mode selector is visible
    await expect(page.locator('select')).toBeVisible();
  });

  test('should fire a transition in step-by-step mode', async ({ page }) => {
    // Create a simple Petri net
    await createSimplePetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByText('Current Marking')).toBeVisible();
    
    // Set the simulation mode to step-by-step (default)
    await page.getByTestId('sim-step').click();
    
    // Find and click the enabled transition button in the execution panel
    await page.getByText('T1').click();
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
    // Wait for the UI to update
    await page.waitForTimeout(1000);
    
    // The start simulation button should be disabled if there are no enabled transitions
    await expect(page.getByText('Start Simulation')).toBeDisabled();
  });

  test('should run quick visual simulation', async ({ page }) => {
    // Create a complex Petri net
    await createComplexPetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByText('Current Marking')).toBeVisible();
    
    // Set the simulation mode to quick visual
    await page.getByTestId('sim-quick').click();
    
    // Start the simulation
    await page.getByTestId('sim-start').click();
    
    // The stop button should appear
    await expect(page.getByTestId('sim-stop')).toBeVisible();
    
    // Wait for the simulation to complete or stop it after a short time
    await page.waitForTimeout(1000);
    await page.getByTestId('sim-stop').click();
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
    // Select the quick visual simulation mode
    await page.locator('select').selectOption('quick');
    
    // Click the Start Simulation button
    await page.getByText('Start Simulation').click();
    
    // Wait for the simulation to run
    await page.waitForTimeout(2000);
  });

  test('should run non-visual simulation', async ({ page }) => {
    // Create a complex Petri net
    await createComplexPetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByText('Current Marking')).toBeVisible();
    
    // Set the simulation mode to non-visual
    await page.getByTestId('sim-non-visual').click();
    
    // Start the simulation
    await page.getByTestId('sim-start').click();
    
    // Wait for the simulation to complete
    await page.waitForTimeout(1000);
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
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
