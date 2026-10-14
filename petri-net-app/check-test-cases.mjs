import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

const result = await page.evaluate(async () => {
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
  const suite = await generateTestSuite(manufacturingIntentions.slice(0, 3), petriNet, simulator, {
    maxStates: 300,
    maxDepth: 25,
    maxPathsPerIntention: 15,
    applyReduction: true
  });
  
  return suite.testCases.map(tc => ({
    id: tc.id,
    name: tc.name,
    intentionId: tc.intentionId,
    hasTrace: !!tc.trace,
    traceLength: tc.trace?.length || 0,
    hasExpectedTrace: !!tc.expectedTrace,
    expectedTraceLength: tc.expectedTrace?.length || 0,
    hasPath: !!tc.path,
    pathLength: tc.path?.length || 0,
    keys: Object.keys(tc)
  }));
});

console.log('Test Case Structure:');
result.forEach(tc => {
  console.log(`\n${tc.name || tc.id}:`);
  console.log(`  Keys: ${tc.keys.join(', ')}`);
  console.log(`  trace: ${tc.hasTrace ? tc.traceLength : 'missing'}`);
  console.log(`  expectedTrace: ${tc.hasExpectedTrace ? tc.expectedTraceLength : 'missing'}`);
  console.log(`  path: ${tc.hasPath ? tc.pathLength : 'missing'}`);
});

await browser.close();
