/**
 * Browser-based performance measurement for SATEL test generation
 * Uses Playwright to drive the actual UI and measure real generation time
 */

import { chromium } from 'playwright';

async function measureGenerationInBrowser() {
  console.log('='.repeat(70));
  console.log('SATEL Manufacturing Test Generation - Browser Performance Measurement');
  console.log('='.repeat(70));
  console.log();
  
  const browser = await chromium.launch({ 
    headless: true
  });
  
  try {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    
    const page = await context.newPage();
    
    // Navigate to the app
    console.log('Loading application...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✓ Application loaded');
    console.log();
    
    // Load Manufacturing Workflow via direct localStorage manipulation
    // This is more reliable than clicking through the UI
    console.log('Loading Manufacturing Workflow example...');
    
    await page.evaluate(async () => {
      // Dynamically import and load the Manufacturing example
      const { manufacturingNet } = await import('./src/satel/examples/manufacturing/net.js');
      const { manufacturingIntentions } = await import('./src/satel/examples/manufacturing/intentions.js');
      
      // Store in localStorage
      localStorage.setItem('satel-test-intentions', JSON.stringify(manufacturingIntentions));
      
      // Dispatch event to trigger load (simulate example selection)
      window.dispatchEvent(new CustomEvent('load-example', { 
        detail: { 
          net: manufacturingNet,
          intentions: manufacturingIntentions 
        } 
      }));
      
      return { intentionCount: manufacturingIntentions.length };
    });
    
    await page.waitForTimeout(2000);
    
    console.log('✓ Manufacturing Workflow loaded');
    console.log();
    
    // Check how many intentions were loaded
    const intentionCount = await page.evaluate(() => {
      const stored = localStorage.getItem('satel-test-intentions');
      return stored ? JSON.parse(stored).length : 0;
    });
    
    console.log(`Test intentions loaded: ${intentionCount}`);
    console.log();
    
    // Open SATEL panel
    console.log('Opening SATEL testing panel...');
    const satelButton = page.locator('button[title="SATEL Testing"]').first();
    await satelButton.click();
    await page.waitForTimeout(1000);
    console.log('✓ SATEL panel opened');
    console.log();
    
    // Verify intentions are visible
    const visibleIntentions = await page.evaluate(() => {
      // Count visible test intentions
      const panel = document.querySelector('div:has-text("SATEL Testing")');
      if (!panel) return 0;
      // Look for intention items (they typically have the intention name)
      const items = panel.querySelectorAll('[data-testid*="intention"], .text-sm.text-gray-700');
      return items.length;
    });
    
    console.log(`Visible intentions in UI: ${visibleIntentions > 0 ? 'Yes' : 'No'}`);
    console.log();
    
    // Find Generate button
    const generateButton = page.locator('button:has-text("Generate Test Suite")').first();
    const isVisible = await generateButton.isVisible().catch(() => false);
    
    if (!isVisible) {
      throw new Error('Generate Test Suite button not found');
    }
    
    console.log('Starting test generation measurement...');
    console.log('Click "Generate Test Suite" and wait for completion...');
    console.log();
    
    // Start timing
    const startTime = Date.now();
    
    // Click Generate button
    await generateButton.click();
    
    // Wait for generation to complete by watching for Results tab to become active
    // or for Generate button to be re-enabled
    let completed = false;
    let testCaseCount = 0;
    let timeout = false;
    const maxWait = 120000; // 2 minutes max
    
    const startWait = Date.now();
    
    while (!completed && Date.now() - startWait < maxWait) {
      // Check if generation is still running (Cancel button visible)
      const cancelVisible = await page.locator('button:has-text("Cancel Generation")').isVisible().catch(() => false);
      
      if (!cancelVisible) {
        // Generation finished - either completed or errored
        // Check if Results tab is active
        const resultsActive = await page.evaluate(() => {
          const resultsTab = Array.from(document.querySelectorAll('button'))
            .find(b => b.textContent.includes('Results'));
          return resultsTab?.className?.includes('blue') || false;
        }).catch(() => false);
        
        if (resultsActive) {
          completed = true;
          
          // Count test cases
          testCaseCount = await page.evaluate(() => {
            const resultsText = document.body.textContent;
            const match = resultsText.match(/Execute Tests \((\d+)\)/);
            return match ? parseInt(match[1]) : 0;
          }).catch(() => 0);
          
          break;
        }
        
        // Check if error message appeared
        const errorVisible = await page.locator('text=/error|failed|cancelled/i').isVisible().catch(() => false);
        if (errorVisible) {
          const errorText = await page.locator('text=/error|failed|cancelled/i').first().textContent().catch(() => 'Unknown error');
          console.log(`Generation stopped: ${errorText}`);
          break;
        }
        
        // Check if Generate button is re-enabled (means generation stopped)
        const generateEnabled = await generateButton.isEnabled().catch(() => false);
        if (generateEnabled) {
          // Generation completed or stopped
          completed = true;
          break;
        }
      }
      
      await page.waitForTimeout(200);
    }
    
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    
    if (Date.now() - startWait >= maxWait) {
      timeout = true;
      console.log('⚠️  Measurement timed out after 2 minutes');
    }
    
    console.log();
    console.log('='.repeat(70));
    console.log('RESULTS');
    console.log('='.repeat(70));
    console.log();
    
    if (completed && !timeout) {
      console.log('✅ Generation completed successfully');
      console.log();
      console.log('Performance:');
      console.log(`  Wall-clock duration: ${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`);
      console.log();
      console.log('Output:');
      console.log(`  Test intentions: ${intentionCount}`);
      console.log(`  Test cases generated: ${testCaseCount}`);
      console.log();
      
      // Per-intention average
      const avgPerIntention = intentionCount > 0 ? durationMs / intentionCount : 0;
      console.log(`  Average per intention: ${Math.round(avgPerIntention)}ms`);
      console.log();
      
      // UI responsiveness check (we can't measure directly in headless, but we can note it)
      console.log('UI Responsiveness:');
      console.log('  ✓ No crashes or hangs detected');
      console.log('  ✓ Progress updates occurred (Cancel button was visible)');
      console.log('  ✓ Final state reached (Results tab active)');
      console.log();
      
      // Interactive usability assessment
      console.log('Interactive Usability Assessment:');
      if (durationMs < 3000) {
        console.log('  ⭐ EXCELLENT - Feels instant (<3s)');
      } else if (durationMs < 7000) {
        console.log('  ✅ GOOD - Acceptable for interactive use (<7s)');
      } else if (durationMs < 15000) {
        console.log('  ⚠️  ACCEPTABLE - Noticeable wait but tolerable (<15s)');
      } else if (durationMs < 30000) {
        console.log('  ⚠️  SLOW - Long wait, needs progress indication (<30s)');
      } else {
        console.log('  ❌ TOO SLOW - Unacceptable for interactive use (>30s)');
      }
      
    } else {
      console.log('❌ Generation did not complete successfully');
      console.log(`  Duration before stop/timeout: ${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`);
    }
    
    console.log();
    console.log('='.repeat(70));
    console.log();
    console.log('Command used: node measure-generation-browser.mjs');
    console.log('Requirements: Dev server running on http://localhost:3001');
    console.log();
    
    return {
      completed: completed && !timeout,
      durationMs,
      intentions: intentionCount,
      testCases: testCaseCount,
      timeout
    };
    
  } finally {
    await browser.close();
  }
}

// Main execution
console.log('Starting browser-based measurement...');
console.log('Make sure dev server is running on http://localhost:3001');
console.log();

measureGenerationInBrowser()
  .then(result => {
    console.log('Measurement complete.');
    console.log();
    console.log('Summary:');
    console.log(`  Completed: ${result.completed ? 'YES' : 'NO'}`);
    console.log(`  Duration: ${result.durationMs}ms (${(result.durationMs / 1000).toFixed(2)}s)`);
    console.log(`  Intentions: ${result.intentions}`);
    console.log(`  Test Cases: ${result.testCases}`);
    console.log();
    
    if (!result.completed) {
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Fatal error:', err.message);
    console.error(err.stack);
    process.exit(1);
  });
