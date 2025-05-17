// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Properties Panel Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the app before each test
    await page.goto('/');
  });

  test('should edit place name and token count', async ({ page }) => {
    // Add a place to the canvas
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(300);

    // Select the place
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);

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


  });

  test('should edit transition name', async ({ page }) => {
    // Add a transition to the canvas
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(300);

    // Select the transition
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);

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
    const transitionState = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      const transition = window.__PETRI_NET_STATE__?.transitions[0];
      return {
        name: transition?.name
      };
    });
    
    expect(transitionState.name).toBe('MyTransition');

  });

  test('should edit arc weight and name', async ({ page }) => {
    // Add a place to the canvas
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);

    // Add a transition to the canvas
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);

    // Create an arc from place to transition
    const arcButton = page.locator('[data-testid="toolbar-arc"]');
    await expect(arcButton).toBeVisible();
    await arcButton.click();
    await page.waitForTimeout(300);
    
    // Click on the place to start the arc
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Click on the transition to complete the arc
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(300);

    // Click on the arc to select it
    // We need to click somewhere along the arc path
    await page.mouse.click(250, 200);
    await page.waitForTimeout(300);

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
    const arcState = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      const arc = window.__PETRI_NET_STATE__?.arcs[0];
      return {
        name: arc?.name,
        weight: arc?.weight
      };
    });
    
    expect(arcState.name).toBe('MyArc');
    expect(arcState.weight).toBe(5); // Note: weight is stored as a number, not a string

  });

  test('should validate token count within range (0-20)', async ({ page }) => {
    // Add a place to the canvas
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(300);

    // Select the place
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);

    // Find the properties panel
    const propertiesPanel = page.locator('.properties-panel');
    await expect(propertiesPanel).toBeVisible();

    // Try to set token count above maximum
    const tokensInput = propertiesPanel.locator('label:has-text("Tokens") + input');
    await expect(tokensInput).toBeVisible();
    await tokensInput.fill('');
    await tokensInput.fill('25');
    
    // Click elsewhere to trigger blur event
    await page.mouse.click(100, 100);
    await page.waitForTimeout(300);

    // Verify the token count is capped at 20
    const placeState = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      const place = window.__PETRI_NET_STATE__?.places[0];
      return {
        tokens: place?.tokens
      };
    });

    expect(placeState.tokens).toBe(20);
  });

  test('should validate arc weight within range (1-20)', async ({ page }) => {
    // Add a place to the canvas
    const placeButton = page.locator('[data-testid="toolbar-place"]');
    await expect(placeButton).toBeVisible();
    await placeButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);

    // Add a transition to the canvas
    const transitionButton = page.locator('[data-testid="toolbar-transition"]');
    await expect(transitionButton).toBeVisible();
    await transitionButton.click();
    await page.waitForTimeout(300);
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);

    // Create an arc from place to transition
    const arcButton = page.locator('[data-testid="toolbar-arc"]');
    await expect(arcButton).toBeVisible();
    await arcButton.click();
    await page.waitForTimeout(300);
    
    // Click on the place to start the arc
    await page.mouse.click(200, 200);
    await page.waitForTimeout(300);
    
    // Click on the transition to complete the arc
    await page.mouse.click(300, 200);
    await page.waitForTimeout(300);

    // Switch back to select mode
    const selectButton = page.locator('[data-testid="toolbar-select"]');
    await expect(selectButton).toBeVisible();
    await selectButton.click();
    await page.waitForTimeout(300);

    // Click on the arc to select it
    await page.mouse.click(250, 200);
    await page.waitForTimeout(300);

    // Find the properties panel
    const propertiesPanel = page.locator('.properties-panel');
    await expect(propertiesPanel).toBeVisible();

    // Try to set weight below minimum
    const weightInput = propertiesPanel.locator('label:has-text("Weight") + input');
    await expect(weightInput).toBeVisible();
    await weightInput.fill('');
    await weightInput.fill('0');
    
    // Click elsewhere to trigger blur event
    await page.mouse.click(100, 100);
    await page.waitForTimeout(300);

    // Verify the weight is set to minimum 1
    const arcState = await page.evaluate(() => {
      // @ts-ignore - Custom property added for testing
      const arc = window.__PETRI_NET_STATE__?.arcs[0];
      return {
        weight: arc?.weight
      };
    });

    expect(arcState.weight).toBe(1);
  });
});
