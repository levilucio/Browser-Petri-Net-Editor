import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

console.log('Testing all 15 intentions...\n');
await page.goto('http://localhost:3000?t=' + Date.now(), { waitUntil: 'networkidle' });

const result = await page.evaluate(async () => {
  const timestamp = Date.now();
  const { generateTestSuite } = await import(`./src/satel/index.js?t=${timestamp}`);
  const { AlgebraicSimulator } = await import(`./src/features/simulation/algebraic-simulator.js?t=${timestamp}`);
  const { manufacturingNet } = await import(`./src/satel/examples/manufacturing/net.js?t=${timestamp}`);
  const { manufacturingIntentions } = await import(`./src/satel/examples/manufacturing/intentions.js?t=${timestamp}`);
  
  const petriNet = {
    places: manufacturingNet.places,
    transitions: manufacturingNet.transitions,
    arcs: manufacturingNet.arcs,
    mode: 'algebraic'
  };
  
  const simulator = new AlgebraicSimulator();
  const startTime = performance.now();
  
  const suite = await generateTestSuite(manufacturingIntentions, petriNet, simulator, {
    maxStates: 300,
    maxDepth: 25,
    maxPathsPerIntention: 15,
    applyReduction: true
  });
  
  const endTime = performance.now();
  
  // Count test cases per intention
  const casesPerIntention = {};
  manufacturingIntentions.forEach(intention => {
    casesPerIntention[intention.id] = 0;
  });
  
  suite.testCases.forEach(tc => {
    if (tc.intentionId && casesPerIntention.hasOwnProperty(tc.intentionId)) {
      casesPerIntention[tc.intentionId]++;
    }
  });
  
  return {
    success: true,
    durationMs: Math.round(endTime - startTime),
    totalIntentions: manufacturingIntentions.length,
    intentionsProcessed: suite.statistics.intentionsProcessed,
    totalTestCases: suite.testCases.length,
    statesExplored: suite.statistics.statesExplored,
    casesPerIntention,
    intentionNames: manufacturingIntentions.map(i => ({ id: i.id, name: i.name }))
  };
});

console.log('======================================================================');
console.log('ALL INTENTIONS TEST RESULTS');
console.log('======================================================================');
console.log();
console.log(`Duration: ${result.durationMs}ms (${(result.durationMs / 1000).toFixed(2)}s)`);
console.log(`Total Intentions: ${result.totalIntentions}`);
console.log(`Intentions Processed: ${result.intentionsProcessed}`);
console.log(`Total Test Cases: ${result.totalTestCases}`);
console.log(`States Explored: ${result.statesExplored}`);
console.log();
console.log('Test Cases Per Intention:');
console.log('----------------------------------------------------------------------');

let intentionsWithCases = 0;
let intentionsWithoutCases = 0;

result.intentionNames.forEach((intention, idx) => {
  const count = result.casesPerIntention[intention.id] || 0;
  const status = count > 0 ? '✅' : '❌';
  console.log(`${status} ${intention.name.padEnd(40)} ${count} cases`);
  
  if (count > 0) {
    intentionsWithCases++;
  } else {
    intentionsWithoutCases++;
  }
});

console.log('----------------------------------------------------------------------');
console.log();
console.log('Summary:');
console.log(`  Intentions generating cases: ${intentionsWithCases}/${result.totalIntentions}`);
console.log(`  Intentions with zero cases: ${intentionsWithoutCases}`);
console.log(`  Average cases per intention: ${(result.totalTestCases / result.totalIntentions).toFixed(1)}`);
console.log();

if (intentionsWithCases === result.totalIntentions) {
  console.log('✅ SUCCESS: All intentions generate test cases!');
} else if (intentionsWithCases >= result.totalIntentions * 0.8) {
  console.log(`⚠️  PARTIAL: ${intentionsWithCases}/${result.totalIntentions} intentions work`);
} else {
  console.log(`❌ FAILURE: Only ${intentionsWithCases}/${result.totalIntentions} intentions work`);
}

console.log();
console.log('======================================================================');

await browser.close();
