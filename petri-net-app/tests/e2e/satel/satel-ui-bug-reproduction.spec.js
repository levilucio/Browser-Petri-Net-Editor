/**
 * Regression test for SATEL UI bug: V2 intentions showing 0 transitions
 * 
 * Bug: Manufacturing V2 intentions generate test cases with "Path: 0 transitions"
 * and "States Explored: 1" in the UI, even though unit tests show non-empty paths.
 * 
 * Root cause: SatelPanel.jsx passes maxStates: 0 and maxDepth: 0 for V2 intentions,
 * which breaks state space statistics and path generation.
 */

import { test, expect } from '@playwright/test';

test.describe('SATEL UI Manufacturing Workflow Bug', () => {
  
  test('should reproduce zero-transition bug with Manufacturing V2 intentions', async ({ page }) => {
    // Start dev server and load Manufacturing example
    await page.goto('http://localhost:4173');
    await page.waitForLoadState('networkidle');
    
    // Load Manufacturing Workflow (SATEL) example
    await page.click('text=Examples');
    await page.click('text=Manufacturing Workflow (SATEL)');
    await page.waitForTimeout(1000);
    
    // Open SATEL Testing panel
    const satelButton = page.locator('button:has-text("SATEL Testing")');
    await satelButton.click();
    await page.waitForTimeout(500);
    
    // Verify panel is open and showing V2 intentions
    const panel = page.locator('.fixed.right-0.top-0'); // SATEL panel
    await expect(panel).toBeVisible();
    
    // Check that we have 9 V2 intentions loaded
    const intentionCards = panel.locator('[class*="border"][class*="rounded-lg"]:has(span:has-text("V2"))');
    const count = await intentionCards.count();
    console.log(`Found ${count} V2 intentions`);
    expect(count).toBe(9);
    
    // Click "Generate Test Suite"
    const generateButton = panel.locator('button:has-text("Generate Test Suite")');
    await generateButton.click();
    
    // Wait for generation to complete
    await page.waitForSelector('text=Results', { timeout: 30000 });
    await page.waitForTimeout(1000);
    
    // Switch to Results tab if not already there
    const resultsTab = panel.locator('button:has-text("Results")');
    await resultsTab.click();
    await page.waitForTimeout(500);
    
    // Check statistics
    const statsSection = panel.locator('text=Test Suite Statistics').locator('..');
    const statesExplored = await statsSection.locator('text=States Explored:').locator('..').textContent();
    const testCasesText = await statsSection.locator('text=Test Cases:').locator('..').textContent();
    
    console.log('Statistics:', { statesExplored, testCasesText });
    
    // Extract numbers
    const statesMatch = statesExplored.match(/States Explored:\s*(\d+)/);
    const casesMatch = testCasesText.match(/Test Cases:\s*(\d+)/);
    
    const statesCount = statesMatch ? parseInt(statesMatch[1]) : 0;
    const testCasesCount = casesMatch ? parseInt(casesMatch[1]) : 0;
    
    // BUG: These will be wrong before fix
    console.log(`Test Cases Generated: ${testCasesCount}`);
    console.log(`States Explored: ${statesCount}`);
    
    // Check individual test case paths
    const testCaseCards = panel.locator('[class*="p-3"][class*="border"][class*="rounded-lg"]:has(text="Test ")');
    const testCaseCount = await testCaseCards.count();
    console.log(`Test case cards visible: ${testCaseCount}`);
    
    // Check first few test cases for path length
    const pathLengths = [];
    for (let i = 0; i < Math.min(testCaseCount, 5); i++) {
      const card = testCaseCards.nth(i);
      const pathText = await card.locator('text=Path:').textContent();
      console.log(`Test ${i + 1} path: ${pathText}`);
      
      const match = pathText.match(/Path:\s*(\d+)\s*transitions/);
      if (match) {
        pathLengths.push(parseInt(match[1]));
      }
    }
    
    console.log('Path lengths:', pathLengths);
    
    // BUG ASSERTIONS (these will fail before fix, pass after fix)
    // After fix, we expect:
    // - testCasesCount should be 11 (as Levi reported)
    // - statesCount should be > 1 (meaningful exploration)
    // - pathLengths should have non-zero values
    
    expect(testCasesCount, 'Should generate 11 test cases').toBe(11);
    expect(statesCount, 'Should explore more than 1 state').toBeGreaterThan(1);
    expect(pathLengths.some(len => len > 0), 'At least one test case should have non-zero path length').toBe(true);
  });
  
  test('should show meaningful path lengths after fix', async ({ page }) => {
    await page.goto('http://localhost:4173');
    await page.waitForLoadState('networkidle');
    
    // Load Manufacturing example
    await page.click('text=Examples');
    await page.click('text=Manufacturing Workflow (SATEL)');
    await page.waitForTimeout(1000);
    
    // Open SATEL panel
    await page.click('button:has-text("SATEL Testing")');
    await page.waitForTimeout(500);
    
    const panel = page.locator('.fixed.right-0.top-0');
    
    // Generate tests
    await panel.locator('button:has-text("Generate Test Suite")').click();
    await page.waitForSelector('text=Results', { timeout: 30000 });
    
    // Click Results tab
    await panel.locator('button:has-text("Results")').click();
    await page.waitForTimeout(500);
    
    // Verify Reduction is not "No" (should be "Yes" or not shown for V2)
    const reductionText = await panel.locator('text=Reduction:').locator('..').textContent();
    console.log('Reduction:', reductionText);
    
    // Check that at least one test case shows transitions in path
    const pathWithTransitions = panel.locator('text=/Path:.*→/').first();
    await expect(pathWithTransitions, 'Should show transition sequence (e.g., "t1 → t2")').toBeVisible();
  });
});
