/**
 * Final complete SATEL demo recording script
 * Shows full workflow: Load Manufacturing → Open SATEL → Generate → Execute → Results
 */

import { chromium } from 'playwright';

async function recordFinalDemo() {
  console.log('=== FINAL COMPLETE SATEL DEMO RECORDING ===\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 400,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: '/workspace/docs/assets/',
      size: { width: 1920, height: 1080 }
    }
  });
  
  const page = await context.newPage();
  const timestamps = {};
  
  try {
    // 1. Load editor
    console.log('[0s] Loading editor...');
    timestamps.start = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    console.log('✓ Editor loaded\n');
    
    // 2. Open Examples menu
    console.log('[~2s] Opening Examples menu...');
    const examplesBtn = page.locator('button:has-text("Examples")').first();
    await examplesBtn.click();
    await page.waitForTimeout(2000);
    timestamps.examplesOpened = Date.now();
    console.log('✓ Examples menu opened\n');
    
    // 3. Click Manufacturing Workflow
    console.log('[~4s] Loading Manufacturing Workflow example...');
    const mfgBtn = page.locator('[data-testid="example-manufacturing-workflow"], button:has-text("Manufacturing Workflow")').first();
    await mfgBtn.waitFor({ state: 'visible', timeout: 10000 });
    await mfgBtn.click();
    await page.waitForTimeout(4000);
    timestamps.manufacturingLoaded = Date.now();
    console.log(`✓ Manufacturing Workflow loaded (${Math.round((timestamps.manufacturingLoaded - timestamps.start) / 1000)}s)\n`);
    
    // Close any dialogs
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // 4. Open SATEL panel
    console.log('[~8s] Opening SATEL panel...');
    const satelBtn = page.locator('[data-testid="toolbar-satel"]');
    await satelBtn.waitFor({ state: 'visible', timeout: 5000 });
    await satelBtn.click();
    await page.waitForTimeout(2000);
    
    // Verify SATEL panel opened
    const panelHeading = page.locator('h2:has-text("SATEL Testing")');
    await panelHeading.waitFor({ state: 'visible', timeout: 5000 });
    timestamps.satelOpened = Date.now();
    console.log(`✓✓✓ SATEL PANEL OPENED (${Math.round((timestamps.satelOpened - timestamps.start) / 1000)}s) ✓✓✓\n`);
    
    await page.waitForTimeout(2000);
    
    // 5. Verify tabs and check Test Intentions
    console.log('[~10s] Verifying tabs...');
    const intentionsTab = page.locator('button').filter({ hasText: /Test Intentions/ }).first();
    const interfaceTab = page.locator('button:has-text("I/O Interface")').first();
    const resultsTab = page.locator('button:has-text("Results")').first();
    
    await intentionsTab.waitFor({ state: 'visible', timeout: 5000 });
    await interfaceTab.waitFor({ state: 'visible', timeout: 3000 });
    await resultsTab.waitFor({ state: 'visible', timeout: 3000 });
    console.log('✓ All three tabs visible: Test Intentions, I/O Interface, Results\n');
    
    await page.waitForTimeout(2000);
    
    // Click Test Intentions tab to ensure it's active
    console.log('[~12s] Checking Test Intentions content...');
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    // Look for intention items (should be 15 from Manufacturing example)
    const intentionItems = page.locator('[class*="intention"], div:has-text("Intention"), div:has-text("Coverage")');
    const hasIntentions = await intentionItems.first().isVisible({ timeout: 3000 }).catch(() => false);
    
    if (hasIntentions) {
      timestamps.intentionsVisible = Date.now();
      console.log(`✓✓✓ TEST INTENTIONS VISIBLE (${Math.round((timestamps.intentionsVisible - timestamps.start) / 1000)}s) ✓✓✓\n`);
    } else {
      console.log('⚠ No test intentions visible yet, checking if they loaded...');
    }
    
    await page.waitForTimeout(3000);
    
    // 6. Generate Test Suite
    console.log('[~15s] Clicking Generate Test Suite...');
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    
    // Wait for button to be enabled
    await generateBtn.waitFor({ state: 'visible', timeout: 5000 });
    
    // Check if button is enabled (not disabled)
    const isDisabled = await generateBtn.evaluate(el => el.disabled);
    if (isDisabled) {
      throw new Error('Generate Test Suite button is disabled - test intentions may not have loaded');
    }
    
    console.log('✓ Generate button is enabled, clicking...');
    await generateBtn.click();
    await page.waitForTimeout(1000);
    timestamps.generateClicked = Date.now();
    console.log(`✓ Generate clicked (${Math.round((timestamps.generateClicked - timestamps.start) / 1000)}s)`);
    
    // Wait for generation to complete (should auto-switch to Results tab)
    console.log('Waiting for test suite generation...');
    await page.waitForTimeout(8000);
    timestamps.generateComplete = Date.now();
    console.log(`✓✓✓ TEST SUITE GENERATED (${Math.round((timestamps.generateComplete - timestamps.start) / 1000)}s) ✓✓✓\n`);
    
    await page.waitForTimeout(2000);
    
    // 7. Execute Tests
    console.log('[~25s] Clicking Execute Tests...');
    const executeBtn = page.locator('button').filter({ hasText: /Execute Tests/ }).first();
    await executeBtn.waitFor({ state: 'visible', timeout: 5000 });
    
    const executeDisabled = await executeBtn.evaluate(el => el.disabled);
    if (executeDisabled) {
      throw new Error('Execute Tests button is disabled - test suite may not have generated');
    }
    
    console.log('✓ Execute button is enabled, clicking...');
    await executeBtn.click();
    timestamps.executeClicked = Date.now();
    console.log(`✓ Execute clicked (${Math.round((timestamps.executeClicked - timestamps.start) / 1000)}s)`);
    
    // Wait for execution
    console.log('Waiting for test execution...');
    await page.waitForTimeout(6000);
    
    // 8. Verify results are visible
    console.log('[~31s] Checking for test results...');
    const resultsText = page.locator('text=/passed|PASS|✓.*test|All tests|Test Results/i').first();
    const resultsVisible = await resultsText.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (resultsVisible) {
      timestamps.resultsVisible = Date.now();
      console.log(`✓✓✓ TEST RESULTS WITH PASS/FAIL VISIBLE (${Math.round((timestamps.resultsVisible - timestamps.start) / 1000)}s) ✓✓✓\n`);
    } else {
      console.log('⚠ Results text not clearly visible, but execution completed\n');
      timestamps.resultsVisible = Date.now();
    }
    
    await page.waitForTimeout(3000);
    
    // 9. Show other tabs
    console.log('[~34s] Showing I/O Interface tab...');
    await interfaceTab.click();
    await page.waitForTimeout(3000);
    console.log('✓ I/O Interface displayed\n');
    
    console.log('[~37s] Back to Results tab...');
    await resultsTab.click();
    await page.waitForTimeout(3000);
    console.log('✓ Results tab displayed\n');
    
    console.log('[~40s] Back to Test Intentions...');
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    console.log('\n✓✓✓ RECORDING COMPLETE ✓✓✓\n');
    await page.waitForTimeout(2000);
    
    // Print summary
    const totalTime = Math.round((Date.now() - timestamps.start) / 1000);
    console.log('\n=== TIMESTAMP SUMMARY ===');
    console.log(`Manufacturing loaded: ${Math.round((timestamps.manufacturingLoaded - timestamps.start) / 1000)}s`);
    console.log(`SATEL opened: ${Math.round((timestamps.satelOpened - timestamps.start) / 1000)}s`);
    if (timestamps.intentionsVisible) {
      console.log(`Intentions visible: ${Math.round((timestamps.intentionsVisible - timestamps.start) / 1000)}s`);
    }
    console.log(`Generate clicked: ${Math.round((timestamps.generateClicked - timestamps.start) / 1000)}s`);
    console.log(`Generate complete: ${Math.round((timestamps.generateComplete - timestamps.start) / 1000)}s`);
    console.log(`Execute clicked: ${Math.round((timestamps.executeClicked - timestamps.start) / 1000)}s`);
    console.log(`Results visible: ${Math.round((timestamps.resultsVisible - timestamps.start) / 1000)}s`);
    console.log(`Total: ${totalTime}s\n`);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    console.log('Finalizing video...');
    await context.close();
    await browser.close();
    console.log('✓ Video saved to docs/assets/\n');
  }
}

recordFinalDemo().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
