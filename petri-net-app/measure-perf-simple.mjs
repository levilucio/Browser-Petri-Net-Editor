/**
 * Simple browser-based performance measurement
 * Injects code into the page to measure generation directly
 */

import { chromium } from 'playwright';

async function measure() {
  console.log('======================================================================');
  console.log('SATEL Test Generation - Performance Measurement (Browser)');
  console.log('======================================================================');
  console.log();
  
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await context.newPage();
    
    console.log('Loading app...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('✓ App loaded\n');
    
    // Inject test code that will run generation and measure time
    const result = await page.evaluate(async () => {
      const startTime = performance.now();
      
      try {
        // Import modules
        const { generateTestSuite } = await import('./src/satel/index.js');
        const { AlgebraicSimulator } = await import('./src/features/simulation/algebraic-simulator.js');
        const { manufacturingNet } = await import('./src/satel/examples/manufacturing/net.js');
        const { manufacturingIntentions } = await import('./src/satel/examples/manufacturing/intentions.js');
        
        const petriNet = {
          places: manufacturingNet.places,
          transitions: manufacturingNet.transitions,
          arcs: manufacturingNet.arcs,
          mode: 'algebraic'
        };
        
        const simulator = new AlgebraicSimulator();
        
        const limits = {
          maxStates: 300,
          maxDepth: 25,
          maxPathsPerIntention: 15,
          applyReduction: true
        };
        
        // Run generation
        const suite = await generateTestSuite(
          manufacturingIntentions,
          petriNet,
          simulator,
          limits
        );
        
        const endTime = performance.now();
        
        return {
          success: true,
          durationMs: Math.round(endTime - startTime),
          intentions: manufacturingIntentions.length,
          testCases: suite.testCases?.length || 0,
          intentionsProcessed: suite.statistics?.intentionsProcessed || 0
        };
        
      } catch (error) {
        return {
          success: false,
          error: error.message,
          durationMs: performance.now() - startTime
        };
      }
    });
    
    console.log('======================================================================');
    console.log('RESULTS');
    console.log('======================================================================');
    console.log();
    
    if (result.success) {
      console.log('✅ Generation completed successfully');
      console.log();
      console.log('Performance:');
      console.log(`  Wall-clock duration: ${result.durationMs}ms (${(result.durationMs / 1000).toFixed(2)}s)`);
      console.log();
      console.log('Output:');
      console.log(`  Test intentions: ${result.intentions}`);
      console.log(`  Intentions processed: ${result.intentionsProcessed}/${result.intentions}`);
      console.log(`  Test cases generated: ${result.testCases}`);
      console.log();
      
      const avgPerIntention = result.intentions > 0 ? result.durationMs / result.intentions : 0;
      console.log(`  Average per intention: ${Math.round(avgPerIntention)}ms`);
      console.log();
      
      console.log('Interactive Usability Assessment:');
      if (result.durationMs < 3000) {
        console.log('  ⭐ EXCELLENT - Feels instant (<3s)');
      } else if (result.durationMs < 7000) {
        console.log('  ✅ GOOD - Acceptable for interactive use (<7s)');
      } else if (result.durationMs < 15000) {
        console.log('  ⚠️  ACCEPTABLE - Noticeable wait but tolerable (<15s)');
      } else if (result.durationMs < 30000) {
        console.log('  ⚠️  SLOW - Long wait, progress bar essential (<30s)');
      } else {
        console.log('  ❌ TOO SLOW - Unacceptable for interactive use (>30s)');
      }
      
    } else {
      console.log('❌ Generation failed');
      console.log(`  Error: ${result.error}`);
      console.log(`  Time before failure: ${result.durationMs}ms`);
    }
    
    console.log();
    console.log('======================================================================');
    console.log();
    console.log('Command: node measure-perf-simple.mjs');
    console.log('Requires: Dev server on http://localhost:3001');
    console.log();
    
    return result;
    
  } finally {
    await browser.close();
  }
}

measure().then(result => {
  console.log('Measurement complete.');
  if (!result.success) process.exit(1);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
