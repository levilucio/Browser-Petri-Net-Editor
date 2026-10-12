import { chromium } from 'playwright';

async function recordWithZ3() {
  console.log('=== RECORDING WITH Z3 SUPPORT ===\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 350,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-features=SharedArrayBuffer',
      '--window-size=1920,1080'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: '/workspace/docs/assets/', size: { width: 1920, height: 1080 } },
    // Enable service workers and proper headers for Z3
    serviceWorkers: 'allow',
    bypassCSP: false
  });
  
  const page = await context.newPage();
  
  // Log important console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SATEL]') || text.includes('Z3') || text.includes('Test suite generated')) {
      console.log('[APP]', text);
    }
  });
  
  try {
    console.log('Loading app (waiting for service worker)...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
    // Extra wait for service worker to activate
    await page.waitForTimeout(3000);
    console.log('✓ App loaded\n');
    
    console.log('Opening Examples...');
    await page.locator('button:has-text("Examples")').first().click();
    await page.waitForTimeout(2000);
    
    console.log('Loading Manufacturing Workflow...');
    await page.locator('button:has-text("Manufacturing Workflow")').first().click();
    await page.waitForTimeout(5000);
    console.log('✓ Manufacturing loaded\n');
    
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
    
    console.log('Opening SATEL panel...');
    await page.locator('[data-testid="toolbar-satel"]').click();
    await page.waitForTimeout(2500);
    await page.locator('h2:has-text("SATEL Testing")').waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ SATEL panel open\n');
    
    await page.waitForTimeout(2000);
    
    console.log('Activating Test Intentions tab...');
    const intentionsTab = page.locator('button').filter({ hasText: /Test Intentions/ }).first();
    await intentionsTab.click();
    await page.waitForTimeout(3000);
    console.log('✓ Test Intentions active\n');
    
    console.log('Clicking Generate Test Suite...');
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    await generateBtn.click();
    await page.waitForTimeout(2000);
    
    // Wait for generation to complete (with Z3 working, it should succeed)
    console.log('Waiting for test generation (15-20s)...');
    await page.waitForTimeout(18000);
    console.log('✓ Generation time elapsed\n');
    
    // Switch back to Intentions tab for Execute button
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    console.log('Looking for Execute Tests button...');
    const executeBtn = page.locator('button').filter({ hasText: /Execute Tests/ }).first();
    const hasExecute = await executeBtn.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (hasExecute) {
      console.log('✓ Execute button found!\n');
      await executeBtn.click();
      console.log('Executing tests...');
      await page.waitForTimeout(8000);
      console.log('✓ Execution complete\n');
      
      // Show Results tab
      const resultsTab = page.locator('button:has-text("Results")').first();
      await resultsTab.click();
      await page.waitForTimeout(3000);
      
      // Look for results
      const resultsVisible = await page.locator('text=/passed|PASS|✓/i').first().isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Results visible:', resultsVisible);
      
      await page.waitForTimeout(3000);
      
      // Show other tabs
      const interfaceTab = page.locator('button:has-text("I/O Interface")').first();
      await interfaceTab.click();
      await page.waitForTimeout(2500);
      
      await resultsTab.click();
      await page.waitForTimeout(2500);
      
      await intentionsTab.click();
      await page.waitForTimeout(2000);
      
      console.log('\n✓✓✓ COMPLETE ✓✓✓');
    } else {
      console.log('⚠ Execute button NOT FOUND - generation may have failed');
      const allButtons = await page.locator('button').allTextContents();
      console.log('Available:', allButtons.filter(t => t && t.trim()).slice(0, 15));
    }
    
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('\nERROR:', error.message);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

recordWithZ3().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
