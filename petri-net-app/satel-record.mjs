import { chromium } from 'playwright';

async function recordSatelDemo() {
  console.log('Starting SATEL demo recording...');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 350,
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
  
  try {
    // 1. Load editor
    console.log('1. Loading editor...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    
    // 2. Open Examples
    console.log('2. Opening Examples...');
    await page.locator('button:has-text("Examples")').first().click();
    await page.waitForTimeout(2000);
    
    // 3. Load Algebraic Net 1 example
    console.log('3. Loading Algebraic Net 1...');
    await page.locator('[data-testid="example-petri-net-algebraic1.pnml"]').click();
    await page.waitForTimeout(3500);
    
    // Close dialog if open
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // 4. Open SATEL panel
    console.log('4. Opening SATEL panel...');
    await page.locator('[data-testid="toolbar-satel"]').click();
    await page.waitForTimeout(2500);
    
    // Verify panel opened
    await page.locator('h2:has-text("SATEL Testing")').waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ SATEL panel opened successfully!');
    await page.waitForTimeout(2000);
    
    // 5. Verify tabs are visible
    console.log('5. Verifying tabs...');
    const intentionsTab = page.locator('button').filter({ hasText: /Test Intentions/ }).first();
    await intentionsTab.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Tabs visible!');
    await page.waitForTimeout(2000);
    
    // 6. Click Test Intentions tab
    console.log('6. Viewing Test Intentions...');
    await intentionsTab.click();
    await page.waitForTimeout(2500);
    
    // 7. Try to generate tests (may not work without intentions)
    console.log('7. Checking for Generate button...');
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    if (await generateBtn.isVisible({ timeout: 2000 })) {
      console.log('Generating test suite...');
      await generateBtn.click();
      await page.waitForTimeout(5000);
    } else {
      console.log('No Generate button (expected without intentions)');
    }
    await page.waitForTimeout(3000);
    
    // 8. Try to execute tests
    console.log('8. Checking for Execute button...');
    const executeBtn = page.locator('button').filter({ hasText: /Execute Tests/ }).first();
    if (await executeBtn.isVisible({ timeout: 2000 })) {
      console.log('Executing tests...');
      await executeBtn.click();
      await page.waitForTimeout(4000);
    } else {
      console.log('No Execute button (expected without test suite)');
    }
    await page.waitForTimeout(3000);
    
    // 9. Show I/O Interface tab
    console.log('9. Showing I/O Interface...');
    const interfaceTab = page.locator('button:has-text("I/O Interface")').first();
    await interfaceTab.click();
    await page.waitForTimeout(3000);
    
    // 10. Show Results tab
    console.log('10. Showing Results...');
    const resultsTab = page.locator('button:has-text("Results")').first();
    await resultsTab.click();
    await page.waitForTimeout(2500);
    
    // 11. Back to Test Intentions
    console.log('11. Back to Test Intentions...');
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    console.log('✓✓✓ Recording completed successfully! ✓✓✓');
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    console.log('Saving video...');
    await context.close();
    await browser.close();
    console.log('Done!');
  }
}

recordSatelDemo().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
