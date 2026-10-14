import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log('Testing fix with fresh server...\n');
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

const result = await page.evaluate(async () => {
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
      testCases: suite.testCases?.length || 0,
      intentions: suite.statistics?.totalIntentions || 0,
      intentionsProcessed: suite.statistics?.intentionsProcessed || 0,
      statesExplored: suite.statistics?.statesExplored || 0,
      reductionApplied: suite.statistics?.reductionApplied || false,
      casesGenerated: suite.statistics?.casesGenerated || 0,
      casesAfterReduction: suite.statistics?.casesAfterReduction || 0
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

console.log('======================================================================');
console.log('FIX VERIFICATION');
console.log('======================================================================');
console.log();

if (result.success) {
  console.log('✅ Generation completed');
  console.log();
  console.log('Results:');
  console.log(`  Total Intentions: ${result.intentions}`);
  console.log(`  Intentions Processed: ${result.intentionsProcessed}`);
  console.log(`  Test Cases Generated: ${result.casesGenerated}`);
  console.log(`  Test Cases After Reduction: ${result.casesAfterReduction}`);
  console.log(`  Final Test Cases: ${result.testCases}`);
  console.log(`  States Explored: ${result.statesExplored}`);
  console.log(`  Reduction Applied: ${result.reductionApplied ? 'Yes' : 'No'}`);
  console.log();
  
  const hasZeroIssue = result.testCases === 0 || result.statesExplored === 0 || result.intentions === 0;
  
  if (hasZeroIssue) {
    console.log('❌ BUG STILL PRESENT:');
    if (result.testCases === 0) console.log('  - Test cases is 0');
    if (result.statesExplored === 0) console.log('  - States explored is 0');
    if (result.intentions === 0) console.log('  - Total intentions is 0');
  } else {
    console.log('✅ BUG FIXED: All values are non-zero');
  }
} else {
  console.log(`❌ Generation failed: ${result.error}`);
}

console.log();
console.log('======================================================================');

await browser.close();
