import { chromium } from 'playwright';

async function debugRecord() {
  console.log('=== DEBUG RECORDING ===\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: '/workspace/docs/assets/', size: { width: 1920, height: 1080 } }
  });
  
  const page = await context.newPage();
  
  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SATEL]') || text.includes('error') || text.includes('Error')) {
      console.log('[BROWSER]', text);
    }
  });
  
  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err.message);
  });
  
  try {
    console.log('Loading app...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    
    console.log('Opening Examples...');
    await page.locator('button:has-text("Examples")').first().click();
    await page.waitForTimeout(2000);
    
    console.log('Loading Manufacturing Workflow...');
    const mfgBtn = page.locator('button:has-text("Manufacturing Workflow")').first();
    await mfgBtn.click();
    await page.waitForTimeout(5000);
    console.log('✓ Manufacturing loaded');
    
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
    
    console.log('Opening SATEL...');
    await page.locator('[data-testid="toolbar-satel"]').click();
    await page.waitForTimeout(2000);
    
    await page.locator('h2:has-text("SATEL Testing")').waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ SATEL opened');
    await page.waitForTimeout(2000);
    
    const intentionsTab = page.locator('button').filter({ hasText: /Test Intentions/ }).first();
    await intentionsTab.click();
    await page.waitForTimeout(3000);
    console.log('✓ Intentions tab active');
    
    console.log('Clicking Generate Test Suite...');
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    await generateBtn.click();
    await page.waitForTimeout(2000);
    console.log('✓ Generate clicked, waiting for completion...');
    
    // Wait longer for generation
    await page.waitForTimeout(12000);
    console.log('Generation wait complete');
    
    // Check what's visible now
    await page.waitForTimeout(2000);
    const allText = await page.locator('button').allTextContents();
    console.log('Visible buttons:', allText.filter(t => t && t.trim()).slice(0, 20));
    
    // Try to find Execute button
    const executeBtn = page.locator('button').filter({ hasText: /Execute Tests/ }).first();
    const hasExecute = await executeBtn.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Execute button visible:', hasExecute);
    
    if (hasExecute) {
      console.log('Clicking Execute...');
      await executeBtn.click();
      await page.waitForTimeout(6000);
      console.log('✓ Execution complete');
      
      await page.waitForTimeout(3000);
    } else {
      console.log('⚠ Execute button not found, checking error state...');
      const errorDiv = page.locator('.bg-red-50, [class*="error"]').first();
      const hasError = await errorDiv.isVisible({ timeout: 1000 }).catch(() => false);
      if (hasError) {
        const errorText = await errorDiv.textContent();
        console.log('ERROR DISPLAYED:', errorText);
      }
    }
    
    await page.waitForTimeout(3000);
    console.log('\n✓ Recording complete');
    
  } catch (error) {
    console.error('\nERROR:', error.message);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

debugRecord().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
