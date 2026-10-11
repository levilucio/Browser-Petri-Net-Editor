/**
 * Final corrected Playwright script for SATEL demo
 * - Loads Manufacturing Workflow example (guaranteed algebraic)
 * - Opens SATEL panel
 * - Shows test intentions, generates and executes tests
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function recordDemo() {
  console.log('=== FINAL CORRECT SATEL Recording ===');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 400,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: path.join(__dirname, '../docs/assets/'),
      size: { width: 1920, height: 1080 }
    }
  });
  
  const page = await context.newPage();
  
  try {
    // 1. Load editor
    console.log('1. Loading editor...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    console.log('✓ Editor loaded');
    
    // 2. Open Examples menu
    console.log('2. Opening Examples menu...');
    const examplesBtn = page.locator('[data-testid="toolbar-examples"]').or(page.locator('button:has-text("Examples")'));
    await examplesBtn.waitFor({ state: 'visible', timeout: 10000 });
    await examplesBtn.click();
    await page.waitForTimeout(2000);
    console.log('✓ Examples menu opened');
    
    // 3. Load Manufacturing Workflow example
    console.log('3. Loading Manufacturing Workflow example...');
    const mfgExample = page.locator('button:has-text("Manufacturing Workflow")').or(page.locator('text=Manufacturing Workflow'));
    await mfgExample.waitFor({ state: 'visible', timeout: 5000 });
    await mfgExample.click();
    await page.waitForTimeout(3000);
    console.log('✓ Manufacturing example loaded (algebraic mode)');
    
    // Close any dialogs
    const closeDialog = page.locator('button:has-text("Close")').first();
    if (await closeDialog.isVisible({ timeout: 1000 })) {
      await closeDialog.click();
      await page.waitForTimeout(1000);
    }
    
    // 4. Click SATEL button
    console.log('4. Opening SATEL panel...');
    const satelButton = page.locator('[data-testid="toolbar-satel"]');
    await satelButton.waitFor({ state: 'visible', timeout: 10000 });
    await satelButton.click();
    await page.waitForTimeout(2500);
    
    // Verify panel heading
    const panelHeading = page.locator('h2:has-text("SATEL Testing")');
    await panelHeading.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓✓✓ SATEL PANEL OPENED ✓✓✓');
    
    await page.waitForTimeout(2000);
    
    // 5. Verify tabs exist
    console.log('5. Verifying tabs...');
    const intentionsTab = page.locator('button').filter({ hasText: /Test Intentions/ }).first();
    const interfaceTab = page.locator('button').filter({ hasText: 'I/O Interface' }).first();
    const resultsTab = page.locator('button').filter({ hasText: 'Results' }).first();
    
    const tabVisible = await intentionsTab.isVisible({ timeout: 3000 });
    if (!tabVisible) {
      throw new Error('Test Intentions tab not visible - SATEL panel may not be in algebraic mode');
    }
    console.log('✓ Tabs visible: Test Intentions, I/O Interface, Results');
    
    await page.waitForTimeout(2000);
    
    // 6. Check what's in Test Intentions tab
    console.log('6. Checking Test Intentions...');
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    // Look for existing intentions from the example
    const intentionsList = page.locator('text=/intention/i, text=/coverage/i, text=/reach/i').first();
    const hasIntentions = await intentionsList.isVisible({ timeout: 2000 });
    
    if (hasIntentions) {
      console.log('✓ Test intentions visible from Manufacturing example');
    } else {
      console.log('Note: No pre-loaded intentions, will create one');
      
      // Create a test intention
      const createBtn = page.locator('button:has-text("Create Test Intention")');
      if (await createBtn.isVisible({ timeout: 2000 })) {
        await createBtn.click();
        await page.waitForTimeout(2000);
        
        const nameInput = page.locator('input[type="text"]').first();
        await nameInput.fill('Demo Intention');
        await page.waitForTimeout(1000);
        
        const descTextarea = page.locator('textarea').first();
        await descTextarea.fill('Demonstrate SATEL testing');
        await page.waitForTimeout(1500);
        
        const saveBtn = page.locator('button:has-text("Save")').first();
        await saveBtn.click();
        await page.waitForTimeout(2000);
        console.log('✓ Test intention created');
      }
    }
    
    await page.waitForTimeout(2000);
    
    // 7. Generate Test Suite
    console.log('7. Generating Test Suite...');
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    
    if (await generateBtn.isVisible({ timeout: 2000 })) {
      console.log('✓ Generate button found, clicking...');
      await generateBtn.click();
      await page.waitForTimeout(5000); // Generation takes time
      
      // Should auto-switch to Results tab
      console.log('✓ Test generation completed');
    } else {
      console.log('Generate button not visible');
      // Manually switch to Results
      await resultsTab.click();
      await page.waitForTimeout(2000);
    }
    
    await page.waitForTimeout(3000);
    
    // 8. Execute Tests
    console.log('8. Executing tests...');
    const executeBtn = page.locator('button').filter({ hasText: /Execute Tests/ }).first();
    
    if (await executeBtn.isVisible({ timeout: 3000 })) {
      console.log('✓ Execute button found, clicking...');
      await executeBtn.click();
      await page.waitForTimeout(4000);
      
      // Check for pass/fail results
      const passIndicator = page.locator('text=/passed|PASS|✓.*test/i').first();
      if (await passIndicator.isVisible({ timeout: 2000 })) {
        console.log('✓✓✓ TEST RESULTS SHOW PASSED ✓✓✓');
      } else {
        console.log('Note: Results displayed but pass/fail not clearly visible');
      }
    } else {
      console.log('Execute button not available');
    }
    
    await page.waitForTimeout(3000);
    
    // 9. Show I/O Interface tab
    console.log('9. Showing I/O Interface...');
    await interfaceTab.click();
    await page.waitForTimeout(3000);
    console.log('✓ I/O Interface displayed');
    
    // 10. Back to Results
    console.log('10. Back to Results...');
    await resultsTab.click();
    await page.waitForTimeout(2500);
    
    // 11. Back to Test Intentions
    console.log('11. Final view of Test Intentions...');
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    console.log('✓✓✓ RECORDING COMPLETE ✓✓✓');
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    console.log('Saving video...');
    await context.close();
    await browser.close();
    console.log('✓ Video saved!');
  }
}

recordDemo().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
