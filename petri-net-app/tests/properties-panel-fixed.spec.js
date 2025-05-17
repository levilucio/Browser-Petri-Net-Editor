// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Helper function to get the Petri net state with retries
 * @param {import('@playwright/test').Page} page - The Playwright page object
 * @param {number} retries - Number of retries (default: 5)
 * @param {number} delay - Delay between retries in ms (default: 300)
 * @returns {Promise<{places: any[], transitions: any[], arcs: any[]}>} - The Petri net state
 */
async function getPetriNetState(page, retries = 5, delay = 300) {
  let attempt = 0;
  while (attempt < retries) {
    const state = await page.evaluate(() => {
      return window['__PETRI_NET_STATE__'] || null;
    });
    
    if (state && 
        Array.isArray(state.places) && 
        Array.isArray(state.transitions) && 
        Array.isArray(state.arcs)) {
      return state;
    }
    
    // Wait before trying again
    await page.waitForTimeout(delay);
    attempt++;
  }
  
  // If we get here, we couldn't get the state after all retries
  console.error('Failed to get Petri net state after', retries, 'attempts');
  return { places: [], transitions: [], arcs: [] };
}

test.describe('Properties Panel Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
    
    // Wait for the application to fully load
    await page.waitForSelector('[data-testid="toolbar-place"]', { state: 'visible' });
  });

  test('should edit place name and token count', async ({ page }) => {
    // Add a place to the canvas
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(500);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(500);

    // Select the place
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);

    // Find the properties panel
    const propertiesPanel = page.locator('.properties-panel');
    await expect(propertiesPanel).toBeVisible();

    // Edit the place name
    const nameInput = propertiesPanel.locator('div:has-text("Name") input[type="text"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('MyPlace');
    
    // Edit the token count
    const tokensInput = propertiesPanel.locator('div:has-text("Tokens (0-20)") input[type="number"]');
    await expect(tokensInput).toBeVisible();
    await tokensInput.fill('10');

    // Verify the changes in the UI
    const placeName = await propertiesPanel.locator('div:has-text("Name") input[type="text"]').inputValue();
    const placeTokens = await propertiesPanel.locator('div:has-text("Tokens (0-20)") input[type="number"]').inputValue();
    
    expect(placeName).toBe('MyPlace');
    expect(placeTokens).toBe('10');

    // Verify the place name and tokens are actually changed in the state
    const state = await getPetriNetState(page);
    expect(state.places[0].name).toBe('MyPlace');
    expect(state.places[0].tokens).toBe(10);
  });

  test('should edit transition name', async ({ page }) => {
    // Add a transition to the canvas
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(500);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(500);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(500);

    // Select the transition
    await page.mouse.click(300, 200);
    await page.waitForTimeout(500);

    // Find the properties panel
    const propertiesPanel = page.locator('.properties-panel');
    await expect(propertiesPanel).toBeVisible();

    // Edit the transition name
    const nameInput = propertiesPanel.locator('div:has-text("Name") input[type="text"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('MyTransition');

    // Verify the changes in the UI
    const transitionName = await propertiesPanel.locator('div:has-text("Name") input[type="text"]').inputValue();
    expect(transitionName).toBe('MyTransition');
    
    // Verify the transition name is actually changed in the state
    const state = await getPetriNetState(page);
    expect(state.transitions[0].name).toBe('MyTransition');
  });

  test('should edit arc weight and name', async ({ page }) => {
    // Add a place to the canvas
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(500);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);

    // Add a transition to the canvas
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(500);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(500);

    // Create an arc from place to transition
    const arcButton = page.locator('[data-testid="toolbar-arc"]');
    await expect(arcButton).toBeVisible();
    await arcButton.click();
    await page.waitForTimeout(500);
    
    // Click on the place to start the arc
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);
    
    // Click on the transition to complete the arc
    await page.mouse.click(300, 200);
    await page.waitForTimeout(800);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(500);

    // Click on the arc to select it
    // We need to click somewhere along the arc path
    await page.mouse.click(250, 200);
    await page.waitForTimeout(500);

    // Find the properties panel
    const propertiesPanel = page.locator('.properties-panel');
    await expect(propertiesPanel).toBeVisible();

    // Edit the arc name
    const nameInput = propertiesPanel.locator('div:has-text("Name") input[type="text"]');
    await expect(nameInput).toBeVisible();
    await nameInput.fill('MyArc');
    
    // Edit the arc weight
    const weightInput = propertiesPanel.locator('div:has-text("Weight (1-20)") input[type="number"]');
    await expect(weightInput).toBeVisible();
    await weightInput.fill('5');

    // Verify the changes in the UI
    const arcName = await propertiesPanel.locator('div:has-text("Name") input[type="text"]').inputValue();
    const arcWeight = await propertiesPanel.locator('div:has-text("Weight (1-20)") input[type="number"]').inputValue();
    
    expect(arcName).toBe('MyArc');
    expect(arcWeight).toBe('5');
    
    // Verify the arc name and weight are actually changed in the state
    const state = await getPetriNetState(page);
    expect(state.arcs[0].name).toBe('MyArc');
    expect(state.arcs[0].weight).toBe(5); // Note: weight is stored as a number, not a string
  });

  test('should validate token count within range (0-20)', async ({ page }) => {
    // Add a place to the canvas
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(500);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(500);

    // Select the place
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);

    // Find the properties panel
    const propertiesPanel = page.locator('.properties-panel');
    await expect(propertiesPanel).toBeVisible();

    // Try to set token count above maximum
    const tokensInput = propertiesPanel.locator('div:has-text("Tokens (0-20)") input[type="number"]');
    await expect(tokensInput).toBeVisible();
    await page.waitForTimeout(500);
    await tokensInput.fill('');
    await page.waitForTimeout(500);
    await tokensInput.fill('25');
    
    // Click elsewhere to trigger blur event
    await page.mouse.click(100, 100);
    await page.waitForTimeout(500);

    // Verify the token count is capped at 20
    const state = await getPetriNetState(page);
    expect(state.places[0].tokens).toBe(20);
  });

  test('should validate arc weight within range (1-20)', async ({ page }) => {
    // Add a place to the canvas
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(500);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);

    // Add a transition to the canvas
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(500);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(500);

    // Create an arc from place to transition
    const arcButton = page.locator('[data-testid="toolbar-arc"]');
    await expect(arcButton).toBeVisible();
    await arcButton.click();
    await page.waitForTimeout(500);
    
    // Click on the place to start the arc
    await page.mouse.click(200, 200);
    await page.waitForTimeout(500);
    
    // Click on the transition to complete the arc
    await page.mouse.click(300, 200);
    await page.waitForTimeout(800);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(500);

    // Click on the arc to select it
    await page.mouse.click(250, 200);
    await page.waitForTimeout(500);

    // Find the properties panel
    const propertiesPanel = page.locator('.properties-panel');
    await expect(propertiesPanel).toBeVisible();

    // Try to set weight below minimum
    const weightInput = propertiesPanel.locator('div:has-text("Weight (1-20)") input[type="number"]');
    await expect(weightInput).toBeVisible();
    await page.waitForTimeout(500);
    await weightInput.fill('');
    await page.waitForTimeout(500);
    await weightInput.fill('0');
    
    // Click elsewhere to trigger blur event
    await page.mouse.click(100, 100);
    await page.waitForTimeout(500);

    // Verify the weight is set to minimum 1
    const state = await getPetriNetState(page);
    expect(state.arcs[0].weight).toBe(1);
  });
});
