import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log('Debug test case generation...\n');
await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });

// Capture console logs
page.on('console', msg => {
  if (msg.text().includes('[SATEL]') || msg.text().includes('matching paths')) {
    console.log('  Browser:', msg.text());
  }
});

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
    
    // Test with just first intention
    const firstIntention = manufacturingIntentions[0];
    console.log('[DEBUG] Testing first intention:', firstIntention.name);
    console.log('[DEBUG] Path pattern:', JSON.stringify(firstIntention.pathPattern, null, 2));
    console.log('[DEBUG] Net transitions:', petriNet.transitions.map(t => t.id).slice(0, 10));
    
    const suite = await generateTestSuite([firstIntention], petriNet, simulator, {
      maxStates: 300,
      maxDepth: 25,
      maxPathsPerIntention: 15,
      applyReduction: true
    });
    
    return {
      success: true,
      testCases: suite.testCases?.length || 0,
      statesExplored: suite.statistics?.statesExplored || 0,
      firstIntentionName: firstIntention.name,
      firstPathPattern: firstIntention.pathPattern
    };
  } catch (error) {
    return { success: false, error: error.message, stack: error.stack };
  }
});

console.log('\n=== Results ===');
console.log('Test cases:', result.testCases);
console.log('States explored:', result.statesExplored);
if (!result.success) {
  console.log('Error:', result.error);
}

await browser.close();
