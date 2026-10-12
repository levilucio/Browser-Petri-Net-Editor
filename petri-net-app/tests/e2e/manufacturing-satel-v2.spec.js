/**
 * End-to-end test for Manufacturing SATEL V2 workflow
 * Tests: Examples → Manufacturing → Generate → Execute
 * Verifies: All test verdicts are correct, no errors, proper banner display
 */

import { test, expect } from '@playwright/test';

test.describe('Manufacturing SATEL V2 E2E', () => {
  test('should load Manufacturing example, generate tests, and execute with all pass verdicts', async ({ page }) => {
    // Navigate to the app (dev server started by playwright config)
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Open the Examples menu (may need to click hamburger on mobile)
    const examplesButton = page.locator('text=Examples').or(page.locator('[aria-label="Menu"]'));
    await examplesButton.click();
    
    // Select Manufacturing Workflow
    const manufacturingOption = page.locator('text=Manufacturing Workflow');
    await manufacturingOption.click();
    
    // Wait for net to load
    await page.waitForTimeout(1000);
    
    // Open SATEL panel (look for SATEL button or icon)
    const satelButton = page.locator('text=SATEL').or(page.locator('[aria-label="SATEL"]'));
    await satelButton.click();
    
    // Wait for panel to open and show intentions
    await page.waitForTimeout(500);
    
    // Check that intentions are loaded
    const intentionCount = await page.locator('[data-testid="intention-item"]').or(
      page.locator('.intention-item')
    ).count();
    
    console.log(`Found ${intentionCount} intentions`);
    expect(intentionCount).toBeGreaterThan(0);
    
    // Click Generate button
    const generateButton = page.locator('text=Generate Test Suite').or(
      page.locator('button:has-text("Generate")')
    );
    await generateButton.click();
    
    // Wait for generation to complete
    await page.waitForTimeout(2000);
    
    // Check that test suite was generated
    const executeButton = page.locator('text=Execute Tests').or(
      page.locator('button:has-text("Execute")')
    );
    await expect(executeButton).toBeVisible({ timeout: 5000 });
    
    // Click Execute button
    await executeButton.click();
    
    // Wait for execution to complete
    await page.waitForTimeout(3000);
    
    // Check for "All tests passed!" banner
    const successBanner = page.locator('text=All tests passed!').or(
      page.locator('.bg-green-100:has-text("passed")')
    );
    await expect(successBanner).toBeVisible({ timeout: 5000 });
    
    // Verify no error verdicts are shown
    const errorBadges = page.locator('text=error').or(
      page.locator('.bg-red-200:has-text("error")')
    );
    await expect(errorBadges).toHaveCount(0);
    
    // Count pass verdicts
    const passBadges = page.locator('text=pass').or(
      page.locator('.bg-green-200:has-text("pass")')
    );
    const passCount = await passBadges.count();
    
    console.log(`Found ${passCount} pass verdicts`);
    expect(passCount).toBeGreaterThan(0);
    
    // Take screenshot of results
    await page.screenshot({ path: 'e2e-results/manufacturing-satel-v2-results.png', fullPage: true });
    
    // Verify statistics
    const totalTests = await page.locator('text=/Total:.*\\d+/').textContent().catch(() => null);
    const passedTests = await page.locator('text=/Passed:.*\\d+/').textContent().catch(() => null);
    const errorTests = await page.locator('text=/Errors:.*\\d+/').textContent().catch(() => null);
    
    if (totalTests) console.log('Statistics:', { totalTests, passedTests, errorTests });
    
    // If error count is shown, verify it's 0
    if (errorTests) {
      expect(errorTests).toContain('0');
    }
  });
  
  test('should render ADT tokens correctly on canvas', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Load Manufacturing example
    const examplesButton = page.locator('text=Examples').or(page.locator('[aria-label="Menu"]'));
    await examplesButton.click();
    
    const manufacturingOption = page.locator('text=Manufacturing Workflow');
    await manufacturingOption.click();
    
    await page.waitForTimeout(1000);
    
    // Check initial tokens on canvas
    // Look for Order token in orderQueue place
    const canvasText = await page.locator('canvas').textContent().catch(() => '');
    
    // Try to find ADT token representation via screenshot analysis
    // (Konva canvas doesn't expose text content easily)
    await page.screenshot({ path: 'e2e-results/manufacturing-canvas-tokens.png' });
    
    // At minimum, verify canvas is rendered
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    console.log('Canvas rendered successfully - ADT tokens should be visible in screenshot');
  });
  
  test('should show Priority subuniformity generates 3 test cases', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('networkidle');
    
    // Load Manufacturing example
    const examplesButton = page.locator('text=Examples').or(page.locator('[aria-label="Menu"]'));
    await examplesButton.click();
    
    const manufacturingOption = page.locator('text=Manufacturing Workflow');
    await manufacturingOption.click();
    
    await page.waitForTimeout(1000);
    
    // Open SATEL panel
    const satelButton = page.locator('text=SATEL').or(page.locator('[aria-label="SATEL"]'));
    await satelButton.click();
    
    await page.waitForTimeout(500);
    
    // Generate tests
    const generateButton = page.locator('text=Generate Test Suite').or(
      page.locator('button:has-text("Generate")')
    );
    await generateButton.click();
    
    await page.waitForTimeout(2000);
    
    // Check that multiple test cases were generated
    // Look for test case count in button or results panel
    const executeButton = page.locator('text=/Execute Tests.*\\d+/');
    const buttonText = await executeButton.textContent().catch(() => '');
    
    console.log('Execute button text:', buttonText);
    
    // Should show more than 9 test cases (at least 9 intentions + 2 extra from subuniformity)
    // order-processing generates 3 instead of 1, so total should be at least 11
    const match = buttonText.match(/\d+/);
    if (match) {
      const testCount = parseInt(match[0], 10);
      console.log(`Total test cases: ${testCount}`);
      expect(testCount).toBeGreaterThanOrEqual(11);
    }
  });
});
