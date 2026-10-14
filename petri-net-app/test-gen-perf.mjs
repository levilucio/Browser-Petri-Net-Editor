import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log('Loading app on http://localhost:3002...');
await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });

console.log('Running test generation measurement...\n');

const result = await page.evaluate(async () => {
  const start = performance.now();
  try {
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
    
    const suite = await generateTestSuite(manufacturingIntentions, petriNet, simulator, {
      maxStates: 300,
      maxDepth: 25,
      maxPathsPerIntention: 15,
      applyReduction: true
    });
    
    return {
      success: true,
      durationMs: Math.round(performance.now() - start),
      intentions: manufacturingIntentions.length,
      testCases: suite.testCases?.length || 0
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

console.log('======================================================================');
console.log('RESULTS');
console.log('======================================================================');
console.log();

if (result.success) {
  console.log(`✅ Duration: ${result.durationMs}ms (${(result.durationMs / 1000).toFixed(2)}s)`);
  console.log(`✅ Intentions: ${result.intentions}`);
  console.log(`✅ Test Cases: ${result.testCases}`);
  console.log();
  if (result.durationMs < 7000) {
    console.log('✅ GOOD for interactive use (<7s)');
  } else if (result.durationMs < 15000) {
    console.log('⚠️  ACCEPTABLE but noticeable wait (<15s)');
  } else {
    console.log('❌ TOO SLOW for comfortable interactive use');
  }
} else {
  console.log(`❌ Failed: ${result.error}`);
}

await browser.close();
