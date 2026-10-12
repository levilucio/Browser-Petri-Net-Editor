import { chromium } from 'playwright';

async function smoothRecord() {
  console.log('=== SMOOTH CONTINUOUS RECORDING (25 FPS) ===\n');
  
  const browser = await chromium.launch({
    headless: false,
    // Minimal slowMo for smooth recording
    slowMo: 100,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--force-device-scale-factor=1'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: '/workspace/docs/assets/',
      size: { width: 1920, height: 1080 }
    },
    // Ensure cursor is visible
    hasTouch: false
  });
  
  const page = await context.newPage();
  
  // Helper to move mouse smoothly and click
  const smoothClick = async (selector, description) => {
    const element = page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout: 10000 });
    const box = await element.boundingBox();
    if (box) {
      // Move to element with smooth animation
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
      await page.waitForTimeout(300);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      console.log(`  ✓ Clicked: ${description}`);
    }
  };
  
  try {
    console.log('Loading app...');
    await page.goto('http://localhost:3000?satel-demo=true', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(1500);
    
    // Move cursor to center
    await page.mouse.move(960, 540, { steps: 10 });
    await page.waitForTimeout(1000);
    console.log('✓ App loaded\n');
    
    console.log('Opening Examples...');
    await smoothClick('button:has-text("Examples")', 'Examples button');
    await page.waitForTimeout(1500);
    
    console.log('Loading Manufacturing Workflow...');
    await smoothClick('button:has-text("Manufacturing Workflow")', 'Manufacturing Workflow');
    await page.waitForTimeout(3000);
    console.log('✓ Manufacturing loaded\n');
    
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 500 })) {
      await smoothClick('button:has-text("Close")', 'Close dialog');
      await page.waitForTimeout(800);
    }
    
    console.log('Opening SATEL panel...');
    await smoothClick('[data-testid="toolbar-satel"]', 'SATEL button');
    await page.waitForTimeout(2000);
    console.log('✓ SATEL panel opened\n');
    
    console.log('Showing Test Intentions...');
    await smoothClick('button:has-text("Test Intentions")', 'Test Intentions tab');
    await page.waitForTimeout(2500);
    
    // Scroll to show intentions list
    await page.mouse.move(1600, 400, { steps: 10 });
    await page.waitForTimeout(2000);
    console.log('✓ Intentions list visible\n');
    
    console.log('Generating test suite...');
    await smoothClick('button:has-text("Generate Test Suite")', 'Generate button');
    await page.waitForTimeout(1500);
    
    // Show generation in progress
    await page.mouse.move(1600, 500, { steps: 5 });
    await page.waitForTimeout(5000);
    console.log('✓ Generation completed\n');
    
    await page.waitForTimeout(1500);
    
    console.log('Switching to Intentions for Execute...');
    await smoothClick('button:has-text("Test Intentions")', 'Intentions tab again');
    await page.waitForTimeout(1500);
    
    console.log('Executing tests...');
    await smoothClick('button:has-text("Execute Tests")', 'Execute button');
    await page.waitForTimeout(1500);
    
    // Show execution
    await page.mouse.move(1600, 600, { steps: 5 });
    await page.waitForTimeout(4500);
    console.log('✓ Execution completed\n');
    
    await page.waitForTimeout(1500);
    
    console.log('Showing Results...');
    await smoothClick('button:has-text("Results")', 'Results tab');
    await page.waitForTimeout(2500);
    
    // Scroll through results
    await page.mouse.move(1600, 450, { steps: 10 });
    await page.waitForTimeout(1500);
    console.log('✓ Results displayed\n');
    
    console.log('Showing I/O Interface...');
    await smoothClick('button:has-text("I/O Interface")', 'I/O Interface tab');
    await page.waitForTimeout(2000);
    
    console.log('Back to Results...');
    await smoothClick('button:has-text("Results")', 'Results tab again');
    await page.waitForTimeout(1500);
    
    console.log('Back to Intentions...');
    await smoothClick('button:has-text("Test Intentions")', 'Intentions final');
    await page.waitForTimeout(1500);
    
    // Move cursor away
    await page.mouse.move(960, 540, { steps: 10 });
    await page.waitForTimeout(1000);
    
    console.log('\n✓✓✓ SMOOTH RECORDING COMPLETE ✓✓✓\n');
    
  } catch (error) {
    console.error('\nERROR:', error.message);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

smoothRecord().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
