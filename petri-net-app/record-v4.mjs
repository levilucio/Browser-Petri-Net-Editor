import { chromium } from 'playwright';

async function record() {
  console.log('=== FINAL SATEL DEMO ===\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 400,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: '/workspace/docs/assets/', size: { width: 1920, height: 1080 } }
  });
  
  const page = await context.newPage();
  const ts = {};
  
  try {
    console.log('[0s] Loading...');
    ts.start = Date.now();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2000);
    
    console.log('[2s] Opening Examples...');
    await page.locator('button:has-text("Examples")').first().click();
    await page.waitForTimeout(2000);
    
    console.log('[4s] Loading Manufacturing Workflow...');
    const mfgBtn = page.locator('[data-testid="example-manufacturing-workflow"]').or(
      page.locator('button:has-text("Manufacturing Workflow")').first()
    );
    await mfgBtn.click();
    await page.waitForTimeout(4000);
    ts.mfgLoaded = Date.now();
    console.log(`✓ Manufacturing loaded (${Math.round((ts.mfgLoaded - ts.start)/1000)}s)\n`);
    
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
    
    console.log('[8s] Opening SATEL...');
    await page.locator('[data-testid="toolbar-satel"]').click();
    await page.waitForTimeout(2000);
    
    await page.locator('h2:has-text("SATEL Testing")').waitFor({ state: 'visible', timeout: 5000 });
    ts.satelOpen = Date.now();
    console.log(`✓✓✓ SATEL OPEN (${Math.round((ts.satelOpen - ts.start)/1000)}s)\n`);
    
    await page.waitForTimeout(2000);
    
    console.log('[10s] Checking tabs...');
    const intentionsTab = page.locator('button').filter({ hasText: /Test Intentions/ }).first();
    await intentionsTab.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ Tabs visible\n');
    
    await intentionsTab.click();
    await page.waitForTimeout(3000);
    ts.intentionsVisible = Date.now();
    console.log(`✓ Intentions tab active (${Math.round((ts.intentionsVisible - ts.start)/1000)}s)\n`);
    
    console.log('[13s] Clicking Generate...');
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    await generateBtn.waitFor({ state: 'visible', timeout: 5000 });
    
    const isDisabled = await generateBtn.evaluate(el => el.disabled);
    if (isDisabled) {
      throw new Error('Generate button disabled!');
    }
    
    await generateBtn.click();
    ts.generateClicked = Date.now();
    console.log(`✓ Generate clicked (${Math.round((ts.generateClicked - ts.start)/1000)}s)`);
    
    console.log('Waiting for generation...');
    await page.waitForTimeout(8000);
    ts.generateDone = Date.now();
    console.log(`✓✓✓ GENERATED (${Math.round((ts.generateDone - ts.start)/1000)}s)\n`);
    
    await page.waitForTimeout(2000);
    
    // Generation auto-switches to Results tab, need to go back to Intentions to see Execute button
    console.log('[23s] Switching back to Test Intentions tab...');
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    console.log('[25s] Looking for Execute button...');
    const executeBtn = page.locator('button').filter({ hasText: /Execute Tests/ }).first();
    const executeVisible = await executeBtn.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!executeVisible) {
      console.log('⚠ Execute button not visible, checking if test suite was created...');
      const allButtons = await page.locator('button').allTextContents();
      console.log('Available buttons:', allButtons.filter(t => t.includes('Test') || t.includes('Execute') || t.includes('Generate')));
      throw new Error('Execute Tests button not found - test suite may not have generated');
    }
    
    console.log('✓ Execute button found, waiting for it to be ready...');
    await executeBtn.waitFor({ state: 'visible', timeout: 2000 });
    
    const execDisabled = await executeBtn.evaluate(el => el.disabled);
    if (execDisabled) {
      throw new Error('Execute button disabled!');
    }
    
    await executeBtn.click();
    ts.executeClicked = Date.now();
    console.log(`✓ Execute clicked (${Math.round((ts.executeClicked - ts.start)/1000)}s)`);
    
    console.log('Waiting for execution...');
    await page.waitForTimeout(6000);
    
    console.log('[29s] Checking results...');
    const resultsText = page.locator('text=/passed|PASS|test|results/i').first();
    await resultsText.waitFor({ state: 'visible', timeout: 5000 });
    ts.results = Date.now();
    console.log(`✓✓✓ RESULTS VISIBLE (${Math.round((ts.results - ts.start)/1000)}s)\n`);
    
    await page.waitForTimeout(3000);
    
    const interfaceTab = page.locator('button:has-text("I/O Interface")').first();
    await interfaceTab.click();
    await page.waitForTimeout(3000);
    
    const resultsTab = page.locator('button:has-text("Results")').first();
    await resultsTab.click();
    await page.waitForTimeout(3000);
    
    await intentionsTab.click();
    await page.waitForTimeout(2000);
    
    console.log('\n✓✓✓ COMPLETE ✓✓✓\n');
    console.log('TIMESTAMPS:');
    console.log(`  Manufacturing: ${Math.round((ts.mfgLoaded - ts.start)/1000)}s`);
    console.log(`  SATEL open: ${Math.round((ts.satelOpen - ts.start)/1000)}s`);
    console.log(`  Intentions: ${Math.round((ts.intentionsVisible - ts.start)/1000)}s`);
    console.log(`  Generate: ${Math.round((ts.generateClicked - ts.start)/1000)}s -> ${Math.round((ts.generateDone - ts.start)/1000)}s`);
    console.log(`  Execute: ${Math.round((ts.executeClicked - ts.start)/1000)}s -> ${Math.round((ts.results - ts.start)/1000)}s`);
    console.log(`  Total: ${Math.round((Date.now() - ts.start)/1000)}s\n`);
    
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
