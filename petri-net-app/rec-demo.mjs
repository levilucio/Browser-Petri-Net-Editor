import { chromium } from 'playwright';

async function record() {
  console.log('=== FINAL SATEL DEMO RECORDING ===\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 350,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: '/workspace/docs/assets/', size: { width: 1920, height: 1080 } }
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Loading app with demo mode...');
    await page.goto('http://localhost:3000?satel-demo=true', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    console.log('✓ Loaded\n');
    
    console.log('Opening Examples...');
    await page.locator('button:has-text("Examples")').first().click();
    await page.waitForTimeout(2000);
    
    console.log('Loading Manufacturing Workflow...');
    await page.locator('button:has-text("Manufacturing Workflow")').first().click();
    await page.waitForTimeout(4500);
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
    console.log('✓ SATEL OPEN\n');
    
    await page.waitForTimeout(2500);
    
    console.log('Activating Test Intentions tab...');
    const intentionsTab = page.locator('button').filter({ hasText: /Test Intentions/ }).first();
    await intentionsTab.click();
    await page.waitForTimeout(3000);
    console.log('✓ Intentions visible\n');
    
    console.log('Clicking Generate Test Suite...');
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    await generateBtn.click();
    await page.waitForTimeout(2000);
    console.log('Generating...');
    await page.waitForTimeout(6000);
    console.log('✓ GENERATED\n');
    
    await page.waitForTimeout(2000);
    
    console.log('Switching to Intentions for Execute button...');
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    console.log('Clicking Execute Tests...');
    const executeBtn = page.locator('button').filter({ hasText: /Execute Tests/ }).first();
    await executeBtn.waitFor({ state: 'visible', timeout: 5000 });
    await executeBtn.click();
    console.log('Executing...');
    await page.waitForTimeout(6000);
    console.log('✓ EXECUTED\n');
    
    await page.waitForTimeout(2500);
    
    console.log('Showing Results tab...');
    const resultsTab = page.locator('button:has-text("Results")').first();
    await resultsTab.click();
    await page.waitForTimeout(3500);
    
    const resultsText = await page.locator('text=/passed|test|result/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Results visible:', resultsText);
    console.log('✓ RESULTS SHOWN\n');
    
    await page.waitForTimeout(3000);
    
    console.log('Showing I/O Interface...');
    const interfaceTab = page.locator('button:has-text("I/O Interface")').first();
    await interfaceTab.click();
    await page.waitForTimeout(3000);
    
    console.log('Back to Results...');
    await resultsTab.click();
    await page.waitForTimeout(2500);
    
    console.log('Back to Intentions...');
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    console.log('\n✓✓✓ RECORDING COMPLETE ✓✓✓\n');
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('\nERROR:', error.message);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

record().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
