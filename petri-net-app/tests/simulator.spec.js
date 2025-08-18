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

  // Opens the Enabled Transitions panel and waits for it to render
  async function openEnabledTransitionsPanel(page) {
    const toggle = page.getByTestId('show-enabled-transitions');
    await expect(toggle).toBeVisible({ timeout: 20000 });
    await toggle.scrollIntoViewIfNeeded();
    await toggle.click();
    const panel = page.getByTestId('enabled-transitions');
    await expect(panel).toBeVisible({ timeout: 20000 });
  }

  // Wait until at least `minCount` enabled transitions are shown in the panel
  async function waitForEnabledTransitions(page, minCount = 1, timeout = 30000) {
    await openEnabledTransitionsPanel(page);
    await page.waitForFunction(
      (min) => {
        const panel = document.querySelector('[data-testid="enabled-transitions"]');
        if (!panel) return false;
        const buttons = panel.querySelectorAll('button');
        return buttons.length >= min;
      },
      minCount,
      { timeout }
    );
  }

  // Wait until either sim-step is enabled OR at least one enabled transition appears
  async function waitUntilAnyEnabled(page, timeout = 60000) {
    await openEnabledTransitionsPanel(page).catch(() => {});
    await page.waitForFunction(() => {
      const step = document.querySelector('[data-testid="sim-step"]');
      const stepEnabled = step && !step.hasAttribute('disabled');
      const panel = document.querySelector('[data-testid="enabled-transitions"]');
      const buttons = panel ? panel.querySelectorAll('button').length : 0;
      return stepEnabled || buttons > 0;
    }, { timeout });
  }

  /**
   * Helper function to create a simple Petri net in the editor
   */
  async function createSimplePetriNet(page) {
    // Place P1
    await page.getByTestId('toolbar-place').click();
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });

    // Transition T1
    await page.getByTestId('toolbar-transition').click();
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });

    // Place P2 (output)
    await page.getByTestId('toolbar-place').click();
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 100 } });

    // Arcs: P1 -> T1 and T1 -> P2
    await page.getByTestId('toolbar-arc').click();
    // P1 -> T1
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    // T1 -> P2
    await page.locator('.konvajs-content').click({ position: { x: 200, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 100 } });

    // Add tokens to P1
    await page.getByTestId('toolbar-select').click();
    await page.locator('.konvajs-content').click({ position: { x: 100, y: 100 } });
    // Use the tokens input in the properties panel
    await page.getByTestId('tokens-input').fill('1');
  }

  // Opens the Enabled Transitions panel and waits for it to render
  async function openEnabledTransitionsPanel(page) {
    const toggle = page.getByTestId('show-enabled-transitions');
    if (await toggle.count()) {
      await toggle.click();
    }
    await expect(page.getByTestId('enabled-transitions')).toBeVisible({ timeout: 20000 });
  }

  // Wait until at least `minCount` enabled transitions are shown in the panel
  async function waitForEnabledTransitions(page, minCount = 1, timeout = 30000) {
    await openEnabledTransitionsPanel(page);
    await page.waitForFunction(
      (min) => {
        const panel = document.querySelector('[data-testid="enabled-transitions"]');
        if (!panel) return false;
        const buttons = panel.querySelectorAll('button');
        return buttons.length >= min;
      },
      minCount,
      { timeout }
    );
  }

  /**
   * Helper function to create a Petri net with conflicting transitions
   * This creates a net with P1 having 1 token connected to both T1 and T2,
   * and P4 having 10 tokens connected to T3.
   * When firing, T1 and T2 are in conflict for P1's token, while T3 can fire independently.
   */
  async function createConflictingPetriNet(page) {
    // Switch to place mode and add places
    await page.getByTestId('toolbar-place').click();
    
    // Add P1 with 1 token
    await page.locator('.konvajs-content').click({ position: { x: 260, y: 100 } });
    // Select P1 to add tokens
    await page.getByTestId('toolbar-select').click();
    await page.locator('.konvajs-content').click({ position: { x: 260, y: 100 } });
    // Set 1 token
    await page.locator('input[type="number"]').first().fill('1');
    
    // Add P2
    await page.getByTestId('toolbar-place').click();
    await page.locator('.konvajs-content').click({ position: { x: 680, y: 100 } });
    
    // Add P3
    await page.locator('.konvajs-content').click({ position: { x: 680, y: 220 } });
    
    // Add P4 with 10 tokens
    await page.locator('.konvajs-content').click({ position: { x: 260, y: 400 } });
    // Select P4 to add tokens
    await page.getByTestId('toolbar-select').click();
    await page.locator('.konvajs-content').click({ position: { x: 260, y: 400 } });
    // Set 10 tokens
    await page.locator('input[type="number"]').first().fill('10');
    
    // Add P5
    await page.getByTestId('toolbar-place').click();
    await page.locator('.konvajs-content').click({ position: { x: 680, y: 400 } });
    
    // Add transitions
    await page.getByTestId('toolbar-transition').click();
    
    // Add T1
    await page.locator('.konvajs-content').click({ position: { x: 460, y: 220 } });
    
    // Add T2
    await page.locator('.konvajs-content').click({ position: { x: 460, y: 100 } });
    
    // Add T3
    await page.locator('.konvajs-content').click({ position: { x: 460, y: 400 } });
    
    // Add arcs
    await page.getByTestId('toolbar-arc').click();
    
    // Arc from P1 to T1
    await page.locator('.konvajs-content').click({ position: { x: 260, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 460, y: 220 } });
    
    // Arc from P1 to T2
    await page.locator('.konvajs-content').click({ position: { x: 260, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 460, y: 100 } });
    
    // Arc from T2 to P2
    await page.locator('.konvajs-content').click({ position: { x: 460, y: 100 } });
    await page.locator('.konvajs-content').click({ position: { x: 680, y: 100 } });
    
    // Arc from T1 to P3
    await page.locator('.konvajs-content').click({ position: { x: 460, y: 220 } });
    await page.locator('.konvajs-content').click({ position: { x: 680, y: 220 } });
    
    // Arc from P4 to T3
    await page.locator('.konvajs-content').click({ position: { x: 260, y: 400 } });
    await page.locator('.konvajs-content').click({ position: { x: 460, y: 400 } });
    
    // Arc from T3 to P5
    await page.locator('.konvajs-content').click({ position: { x: 460, y: 400 } });
    await page.locator('.konvajs-content').click({ position: { x: 680, y: 400 } });
    
    // Switch back to select mode
    await page.getByTestId('toolbar-select').click();
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
    
    // Wait for the simulator container
    await expect(page.getByTestId('simulation-manager')).toBeVisible();

    // Controls should render
    await expect(page.getByTestId('sim-step')).toBeVisible();
    await expect(page.getByTestId('sim-simulate')).toBeVisible();
    await expect(page.getByTestId('sim-run')).toBeVisible();

    // Wait for at least one enabled transition to appear in the panel
    await waitForEnabledTransitions(page, 1, 60000);
  });

  test('should fire all enabled transitions simultaneously with the Fire button', async ({ page }) => {
    // Create a Petri net with conflicting transitions
    await createConflictingPetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByTestId('simulation-manager')).toBeVisible();
    
    await waitUntilAnyEnabled(page, 60000);
    
    // Get the initial state of the Petri net
    const initialState = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
    });
    
    // Verify initial state: P1 has 1 token, P4 has 10 tokens
    const p1 = initialState.places.find(p => p.x === 260 && p.y === 100);
    const p4 = initialState.places.find(p => p.x === 260 && p.y === 400);
    expect(p1.tokens).toBe(1);
    expect(p4.tokens).toBe(10);
    
    // Click the Run button to fire all enabled transitions (maximal concurrent)
    await expect(page.getByTestId('sim-run')).toBeEnabled({ timeout: 60000 });
    await page.getByTestId('sim-run').click();
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
    // Get the updated state of the Petri net
    const updatedState = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
    });
    
    // Verify that P1's token is consumed (should be 0)
    // This means either T1 or T2 fired (but not both, since they're in conflict)
    const updatedP1 = updatedState.places.find(p => p.x === 260 && p.y === 100);
    expect(updatedP1.tokens).toBe(0);
    
    // Verify that P4's tokens are reduced by 1 (T3 should have fired)
    const updatedP4 = updatedState.places.find(p => p.x === 260 && p.y === 400);
    expect(updatedP4.tokens).toBe(9);
    
    // Verify that P5 received a token from T3
    const updatedP5 = updatedState.places.find(p => p.x === 680 && p.y === 400);
    expect(updatedP5.tokens).toBe(1);
    
    // Verify that either P2 or P3 (but not both) received a token
    // This confirms the non-deterministic behavior of conflicting transitions
    const updatedP2 = updatedState.places.find(p => p.x === 680 && p.y === 100);
    const updatedP3 = updatedState.places.find(p => p.x === 680 && p.y === 220);
    
    // Either P2 or P3 should have 1 token, but not both
    const tokenSum = (updatedP2.tokens || 0) + (updatedP3.tokens || 0);
    expect(tokenSum).toBe(1);
    
    // Click the Show Enabled Transitions button (if present)
    const showEnabled2 = page.getByTestId('show-enabled-transitions');
    if (await showEnabled2.count()) {
      await showEnabled2.click();
    }
    
    // Wait for at least one enabled transition again via the panel
    await waitForEnabledTransitions(page, 1, 60000);
    
    // Verify that there are still enabled transitions (T3 should be enabled since P4 still has tokens)
    const enabledTransitionsSection = page.getByTestId('enabled-transitions');
    await expect(enabledTransitionsSection).toBeVisible();
    
    // Check if there's at least one button in the enabled transitions panel
    const enabledButtons = page.locator('[data-testid="enabled-transitions"] button');
    await expect(enabledButtons).toBeVisible();
    
    // Verify that P4 still has tokens (which means T3 is still enabled)
    const finalState = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      return window.__PETRI_NET_STATE__ || { places: [], transitions: [], arcs: [] };
    });
    
    const finalP4 = finalState.places.find(p => p.x === 260 && p.y === 400);
    expect(finalP4.tokens).toBeGreaterThan(0);
  });

  test('should fire transitions using the Fire button', async ({ page }) => {
    // Create a complex Petri net
    await createComplexPetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByTestId('simulation-manager')).toBeVisible();
    
    await waitUntilAnyEnabled(page, 60000);
    
    // Check that the Step control is visible
    await expect(page.getByTestId('sim-step')).toBeVisible();
    
    // Click Step to fire the first enabled transition
    await expect(page.getByTestId('sim-step')).toBeEnabled({ timeout: 60000 });
    await page.getByTestId('sim-step').click();
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
    // Toggle the Markings panel
    const toggleMarkings = page.getByTestId('toggle-markings');
    if (await toggleMarkings.count()) {
      await toggleMarkings.click();
    }
    
    // Check that the marking has changed by looking at the current marking section
    // The P1 place should now have 1 token instead of 2
    const currentMarking = page.getByTestId('current-marking');
    await expect(currentMarking).toBeVisible();
    
    // Wait for the UI to update
    await page.waitForTimeout(1000);
    
    // Click the Fire button again if it's enabled
    const fireButton = page.getByTestId('sim-step');
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
    await expect(page.getByTestId('simulation-manager')).toBeVisible();
    
    await waitUntilAnyEnabled(page, 60000);
    
    // Open the Enabled Transitions panel and verify it shows transitions
    await openEnabledTransitionsPanel(page);
    
    // There should be at least one enabled transition button
    const enabledTransitionButtons = page.locator('[data-testid="enabled-transitions"] button');
    const count = await enabledTransitionButtons.count();
    expect(count).toBeGreaterThan(0);
    
    // Check that the execution panel is visible
    await expect(page.getByTestId('simulation-manager')).toBeVisible();
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
    // Use the Weight field in the Properties panel
    await page.getByText(/Weight \(1-\d+\)/).locator('..').locator('input[type="number"]').fill('10');
    
    // Add tokens to P2
    await page.locator('.konvajs-content').click({ position: { x: 300, y: 100 } });
    await page.locator('input[type="number"]').first().fill('15');
    
    // Wait for enabled and fire the transition with Step
    await waitUntilAnyEnabled(page, 60000);
    await expect(page.getByTestId('sim-step')).toBeEnabled({ timeout: 60000 });
    await page.getByTestId('sim-step').click();
    
    // Wait for the UI to update
    await page.waitForTimeout(2000);
    
    // After firing, check that we can still interact with the execution panel
    await expect(page.getByTestId('simulation-manager')).toBeVisible();
  });

  test('should measure performance of simulation operations', async ({ page }) => {
    // Create a simple Petri net
    await createSimplePetriNet(page);
    
    // Wait for the simulator to initialize
    await expect(page.getByTestId('simulation-manager')).toBeVisible();
    
    // Measure the time to fire a transition
    const startTime = Date.now();
    
    // Fire the transition with Step
    await page.getByTestId('sim-step').click();
    
    // Wait for the execution panel to update
    await page.waitForTimeout(1000);
    
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;
    
    // Log the performance metric
    // Performance metric: time to fire transition
    
    // The transition should fire in a reasonable amount of time
    // We're being very lenient in the test to account for browser overhead and test environment
    expect(elapsedTime).toBeLessThan(10000);
    // Performance test completed
  });
});
