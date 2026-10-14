/**
 * CORRECT Playwright script to record SATEL demo
 * Targets actual SatelPanel component with exact selectors
 */

import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function recordDemo() {
  console.log('=== Starting CORRECT SATEL demo recording ===');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500, // Slow down to make actions very visible
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
    // 1. Navigate to editor
    console.log('1. Navigating to editor...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);
    console.log('✓ Editor loaded');
    
    // 2. Click SATEL button using exact selector from Toolbar.jsx
    console.log('2. Clicking SATEL button (data-testid="toolbar-satel")...');
    const satelButton = page.locator('[data-testid="toolbar-satel"]');
    
    // Wait for button to be visible
    await satelButton.waitFor({ state: 'visible', timeout: 10000 });
    console.log('✓ SATEL button found');
    
    // Click the button
    await satelButton.click();
    await page.waitForTimeout(2000);
    
    // 3. VERIFY SATEL panel is open by checking for "SATEL Testing" heading
    console.log('3. Verifying SATEL panel opened...');
    const panelHeading = page.locator('h2:has-text("SATEL Testing")');
    await panelHeading.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓✓✓ SATEL PANEL IS OPEN ✓✓✓');
    
    await page.waitForTimeout(3000);
    
    // 4. Check what content is actually visible
    console.log('4. Debugging panel content...');
    await page.waitForTimeout(2000);
    
    // Check if we see "only available for Algebraic" message
    const algebraicMessage = await page.locator('text=SATEL testing is only available for Algebraic').isVisible();
    if (algebraicMessage) {
      console.log('!!! ISSUE: App is not in Algebraic mode, SATEL shows fallback message !!!');
      console.log('Attempting to enable algebraic mode via Settings...');
      
      // Close SATEL panel first
      const closeBtn1 = page.locator('button:has-text("✕")').last();
      await closeBtn1.click();
      await page.waitForTimeout(1000);
      
      // Open Settings
      const settingsBtn = page.locator('[data-testid="toolbar-settings"]');
      await settingsBtn.click();
      await page.waitForTimeout(2000);
      
      // Find and click Algebraic option
      const algebraicOption = page.locator('label:has-text("Algebraic"), button:has-text("Algebraic"), input[value="algebraic"]').first();
      await algebraicOption.click();
      await page.waitForTimeout(1500);
      
      // Close Settings
      const closeSettings = page.locator('button:has-text("Close")').first();
      await closeSettings.click();
      await page.waitForTimeout(1500);
      
      // Reopen SATEL
      await satelButton.click();
      await page.waitForTimeout(2000);
    }
    
    // Now check for tabs
    console.log('Checking for tabs...');
    const intentionsTab = page.locator('button:has-text("Test Intentions")').first();
    const interfaceTab = page.locator('button:has-text("I/O Interface")').first();
    const resultsTab = page.locator('button:has-text("Results")').first();
    
    const tabsExist = await intentionsTab.isVisible({ timeout: 3000 }) || false;
    if (tabsExist) {
      console.log('✓ Tabs are visible');
    } else {
      console.log('ERROR: Tabs still not visible - something is wrong');
      throw new Error('SATEL tabs not found after enabling algebraic mode');
    }
    
    await page.waitForTimeout(2000);
    
    // 5. Click Test Intentions tab (find first button containing "Test Intentions")
    console.log('5. Clicking Test Intentions tab...');
    const intentionsTabBtn = page.locator('button:has-text("Test Intentions")').first();
    await intentionsTabBtn.click();
    await page.waitForTimeout(2000);
    
    // Verify Create button exists
    const createBtn = page.locator('button:has-text("Create Test Intention")');
    await createBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Test Intentions tab active, Create button visible');
    
    await page.waitForTimeout(2000);
    
    // 6. Create a test intention
    console.log('6. Creating test intention...');
    await createBtn.click();
    await page.waitForTimeout(2000);
    
    // Fill in the form
    const nameInput = page.locator('input[type="text"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill('Demo Test Intention');
    await page.waitForTimeout(1500);
    
    const descTextarea = page.locator('textarea').first();
    await descTextarea.fill('This demonstrates SATEL test intention creation');
    await page.waitForTimeout(2000);
    
    console.log('✓ Test intention form filled');
    
    // 7. Save the intention
    console.log('7. Saving test intention...');
    const saveBtn = page.locator('button:has-text("Save")').first();
    await saveBtn.click();
    await page.waitForTimeout(2000);
    
    // Verify we're back to the list
    await createBtn.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Test intention saved');
    
    await page.waitForTimeout(2000);
    
    // 8. Try to generate tests
    console.log('8. Looking for Generate Test Suite button...');
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    
    if (await generateBtn.isVisible({ timeout: 3000 })) {
      console.log('✓ Generate button found, clicking...');
      await generateBtn.click();
      await page.waitForTimeout(4000);
      console.log('✓ Test generation attempted');
    } else {
      console.log('Note: Generate button not visible (expected if no valid test cases)');
    }
    
    await page.waitForTimeout(2000);
    
    // 9. Check Results tab
    console.log('9. Switching to Results tab...');
    const resultsTabBtn = page.locator('button:has-text("Results")').first();
    await resultsTabBtn.click();
    await page.waitForTimeout(3000);
    
    // Look for any results content
    const resultsContent = page.locator('text=Test Suite Statistics, text=Test Cases, text=Generated').first();
    if (await resultsContent.isVisible({ timeout: 2000 })) {
      console.log('✓ Results content visible');
      
      // 10. Try to execute if button exists
      console.log('10. Looking for Execute Tests button...');
      const executeBtn = page.locator('button:has-text("Execute Tests")');
      if (await executeBtn.isVisible({ timeout: 2000 })) {
        console.log('✓ Execute button found, clicking...');
        await executeBtn.click();
        await page.waitForTimeout(3000);
        
        // Check for pass/fail text
        const passText = page.locator('text=passed, text=All tests passed, text=PASS').first();
        if (await passText.isVisible({ timeout: 2000 })) {
          console.log('✓✓✓ TEST RESULTS WITH PASS VISIBLE ✓✓✓');
        }
      }
    } else {
      console.log('Note: No test results yet (expected if generation didn\'t produce tests)');
    }
    
    await page.waitForTimeout(3000);
    
    // 11. Check I/O Interface tab
    console.log('11. Switching to I/O Interface tab...');
    const interfaceTabBtn = page.locator('button:has-text("I/O Interface")').first();
    await interfaceTabBtn.click();
    await page.waitForTimeout(3000);
    console.log('✓ I/O Interface tab shown');
    
    // 12. Back to Test Intentions
    console.log('12. Back to Test Intentions...');
    const intentionsTabBtn2 = page.locator('button:has-text("Test Intentions")').first();
    await intentionsTabBtn2.click();
    await page.waitForTimeout(2000);
    
    // 13. Close panel
    console.log('13. Closing SATEL panel...');
    const closeBtn = page.locator('button:has-text("✕")').last();
    await closeBtn.click();
    await page.waitForTimeout(2000);
    
    console.log('✓✓✓ Recording complete! ✓✓✓');
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('ERROR:', error.message);
    throw error;
  } finally {
    console.log('Finalizing video...');
    await context.close();
    await browser.close();
    console.log('✓ Video saved');
  }
}

recordDemo().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
