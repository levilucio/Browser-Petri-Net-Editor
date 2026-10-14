/**
 * Measure actual path lengths for Manufacturing and Banking
 */
import { generateTestSuite } from './src/satel/core/TestGenerator.js';
import { AlgebraicSimulator } from './src/features/simulation/algebraic-simulator.js';
import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentionsV2 } from './src/satel/examples/manufacturing/intentions-v2.js';
import { bankingMultiStepIntentions } from './src/satel/examples/banking/intentions-v2-multistep.js';
import { bankingNet } from './src/satel/examples/banking/net.js';

async function measureManufacturing() {
  console.log('=== Manufacturing Workflow Path Lengths ===\n');
  
  const simulator = new AlgebraicSimulator();
  const petriNet = {
    places: manufacturingNet.places,
    transitions: manufacturingNet.transitions,
    arcs: manufacturingNet.arcs,
    mode: 'algebraic',
    adtDefinitions: manufacturingNet.adtDefinitions
  };

  const result = await generateTestSuite(
    manufacturingIntentionsV2,
    petriNet,
    simulator,
    { disableGraphCaching: true, applyReduction: false, variableDepth: 2 }
  );

  console.log(`Total test cases: ${result.testCases.length}`);
  console.log(`States explored: ${result.statistics.statesExplored}`);
  console.log('\nPer-case path lengths:\n');

  result.testCases.forEach((tc, idx) => {
    const pathLength = tc.expectedTrace?.length || 0;
    const vars = tc.instantiation ? JSON.stringify(tc.instantiation) : 'None';
    const status = tc.status || 'unknown';
    console.log(`${idx + 1}. ${tc.intention.name} (${tc.intention.id})`);
    console.log(`   Variables: ${vars}`);
    console.log(`   Path: ${pathLength} transitions`);
    console.log(`   Status: ${status}\n`);
  });

  const pathLengths = result.testCases.map(tc => tc.expectedTrace?.length || 0);
  const avg = pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length;
  const over3 = pathLengths.filter(l => l >= 3).length;
  
  console.log(`\nStatistics:`);
  console.log(`  Path lengths: [${pathLengths.join(', ')}]`);
  console.log(`  Average: ${avg.toFixed(2)} transitions`);
  console.log(`  Tests with path >= 3: ${over3}/${result.testCases.length} (${(over3/result.testCases.length*100).toFixed(0)}%)`);
  
  return { testCases: result.testCases, pathLengths, avg, over3 };
}

async function measureBanking() {
  console.log('\n\n=== Banking Operations Path Lengths ===\n');
  
  const simulator = new AlgebraicSimulator();
  const petriNet = {
    places: bankingNet.places,
    transitions: bankingNet.transitions,
    arcs: bankingNet.arcs,
    mode: 'algebraic',
    adtDefinitions: bankingNet.adtDefinitions || []
  };

  const result = await generateTestSuite(
    bankingMultiStepIntentions,
    petriNet,
    simulator,
    { disableGraphCaching: true, applyReduction: false, variableDepth: 2 }
  );

  console.log(`Total test cases: ${result.testCases.length}`);
  console.log(`States explored: ${result.statistics.statesExplored}`);
  console.log('\nPer-case path lengths:\n');

  result.testCases.forEach((tc, idx) => {
    const pathLength = tc.expectedTrace?.length || 0;
    const vars = tc.instantiation ? JSON.stringify(tc.instantiation) : 'None';
    const status = tc.status || 'unknown';
    console.log(`${idx + 1}. ${tc.intention.name} (${tc.intention.id})`);
    console.log(`   Variables: ${vars}`);
    console.log(`   Path: ${pathLength} transitions`);
    console.log(`   Status: ${status}\n`);
  });

  const pathLengths = result.testCases.map(tc => tc.expectedTrace?.length || 0);
  const avg = pathLengths.length > 0 ? pathLengths.reduce((a, b) => a + b, 0) / pathLengths.length : 0;
  const over3 = pathLengths.filter(l => l >= 3).length;
  
  console.log(`\nStatistics:`);
  console.log(`  Path lengths: [${pathLengths.join(', ')}]`);
  console.log(`  Average: ${avg.toFixed(2)} transitions`);
  console.log(`  Tests with path >= 3: ${over3}/${result.testCases.length} (${(over3/result.testCases.length*100).toFixed(0)}%)`);
  
  return { testCases: result.testCases, pathLengths, avg, over3 };
}

// Run measurements
try {
  const mfg = await measureManufacturing();
  const banking = await measureBanking();
  
  console.log('\n\n=== Summary ===\n');
  console.log(`Manufacturing: ${mfg.testCases.length} tests, avg ${mfg.avg.toFixed(2)} transitions, ${mfg.over3} tests with path >= 3`);
  console.log(`Banking: ${banking.testCases.length} tests, avg ${banking.avg.toFixed(2)} transitions, ${banking.over3} tests with path >= 3`);
} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
