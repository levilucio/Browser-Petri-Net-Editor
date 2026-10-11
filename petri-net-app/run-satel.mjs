import { chromium } from 'playwright';

async function record() {
  console.log('Starting...');
  
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
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    
    await page.locator('button:has-text("Examples")').first().click();
    await page.waitForTimeout(2000);
    
    await page.locator('[data-testid="example-petri-net-algebraic1.pnml"]').click();
    await page.waitForTimeout(3500);
    
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
    
    await page.locator('[data-testid="toolbar-satel"]').click();
    await page.waitForTimeout(2500);
    
    await page.locator('h2:has-text("SATEL Testing")').waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ SATEL opened');
    await page.waitForTimeout(2000);
    
    const intentionsTab = page.locator('button').filter({ hasText: /Test Intentions/ }).first();
    await intentionsTab.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Tabs visible');
    await page.waitForTimeout(2500);
    
    await intentionsTab.click();
    await page.waitForTimeout(2500);
    
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    if (await generateBtn.isVisible({ timeout: 2000 })) {
      await generateBtn.click();
      await page.waitForTimeout(5000);
    }
    await page.waitForTimeout(3000);
    
    const executeBtn = page.locator('button').filter({ hasText: /Execute Tests/ }).first();
    if (await executeBtn.isVisible({ timeout: 2000 })) {
      await executeBtn.click();
      await page.waitForTimeout(4000);
    }
    await page.waitForTimeout(3000);
    
    const interfaceTab = page.locator('button:has-text("I/O Interface")').first();
    await interfaceTab.click();
    await page.waitForTimeout(3000);
    
    const resultsTab = page.locator('button:has-text("Results")').first();
    await resultsTab.click();
    await page.waitForTimeout(2500);
    
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    console.log('✓ Complete');
    await page.waitForTimeout(2000);
    
  } finally {
    await context.close();
    await browser.close();
  }
}

record().catch(err => {
  console.error('ERROR:', err);
  process.exit(1);
});
