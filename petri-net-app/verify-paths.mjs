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
  const suite = await generateTestSuite(manufacturingIntentions, petriNet, simulator, {
    maxStates: 300,
    maxDepth: 25,
    maxPathsPerIntention: 15,
    applyReduction: true
  });
  
  const pathLengths = {};
  const pathDetails = {};
  
  manufacturingIntentions.forEach(intention => {
    const cases = suite.testCases.filter(tc => tc.intentionId === intention.id);
    if (cases.length > 0) {
      const pathLen = cases[0].expectedTrace?.length || 0;
      const path = cases[0].expectedTrace?.map(t => t.transition).join(' → ') || 'empty';
      pathLengths[intention.name] = pathLen;
      pathDetails[intention.name] = path;
    }
  });
  
  return { pathLengths, pathDetails, totalCases: suite.testCases.length };
});

console.log('Path Lengths Per Intention:');
console.log('='.repeat(70));
Object.entries(result.pathLengths).forEach(([name, length]) => {
  const status = length >= 1 ? '✅' : '❌';
  console.log(`${status} ${name.padEnd(40)} ${length} transitions`);
  console.log(`   Path: ${result.pathDetails[name]}`);
});

console.log('='.repeat(70));
const allValid = Object.values(result.pathLengths).every(len => len >= 1);
console.log();
if (allValid) {
  console.log('✅ All test cases have non-empty paths (length ≥ 1)');
} else {
  console.log('❌ Some test cases have empty paths');
}
console.log(`Total test cases: ${result.totalCases}`);

await browser.close();
