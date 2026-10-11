import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function recordDemo() {
  console.log('=== SATEL Demo Recording v3 ===');
  
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
    console.log('1. Loading editor...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(2500);
    
    console.log('2. Opening Examples...');
    const examplesBtn = page.locator('button:has-text("Examples")').first();
    await examplesBtn.click();
    await page.waitForTimeout(2000);
    
    console.log('3. Loading Algebraic Net 1...');
    const algBtn = page.locator('[data-testid="example-petri-net-algebraic1.pnml"]');
    await algBtn.click();
    console.log('3. Loading Algebraic Net 1...');
    const algBtn = page.locator('[data-testid="example-petri-net-algebraic1.pnml"]');
    await algBtn.click();
    console.log('3. Loading Algebraic Net 1...');
    const algBtn = page.locator('[data-testid="example-petri-net-algebraic1.pnml"]');
    await algBtn.click();
    await page.waitForTimeout(3500);
    
    const closeBtn1 = page.locator('button:has-text("Close")').first();
    if (await closeBtn1.isVisible({ timeout: 1000 })) {
      await closeBtn1.click();
      await page.waitForTimeout(1000);
    }
    
    console.log('4. Opening SATEL...');
    const satelBtn = page.locator('[data-testid="toolbar-satel"]');
    await satelBtn.click();
    await page.waitForTimeout(2500);
    
    console.log('5. Checking tabs...');
    const intentionsTab = page.locator('button').filter({ hasText: /Test Intentions/ }).first();
    await intentionsTab.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✓ SATEL panel open with tabs!');
    
    await page.waitForTimeout(2000);
    await intentionsTab.click();
    await page.waitForTimeout(2500);
    
    console.log('6. Generating tests...');
    const generateBtn = page.locator('button:has-text("Generate Test Suite")');
    if (await generateBtn.isVisible({ timeout: 2000 })) {
      await generateBtn.click();
      await page.waitForTimeout(5000);
      console.log('✓ Test suite generated');
    }
    
    await page.waitForTimeout(3000);
    
    console.log('7. Executing tests...');
    const executeBtn = page.locator('button').filter({ hasText: /Execute Tests/ }).first();
    if (await executeBtn.isVisible({ timeout: 3000 })) {
      await executeBtn.click();
      await page.waitForTimeout(4000);
      console.log('✓ Tests executed');
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
    
    console.log('✓✓✓ COMPLETE ✓✓✓');
    await page.waitForTimeout(2000);
    
  } catch (error) {
    console.error('ERROR:', error.message);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

recordDemo().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
