import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { orderProcessingIntention } from './src/satel/examples/manufacturing/intentions-v2.js';
import { generateTestSuite } from './src/satel/core/TestGenerator.js';
import { executeTestSuite } from './src/satel/core/TestExecutor.js';
import { SimulatorFactory } from './src/features/simulation/SimulatorFactory.js';

console.log('=== Manufacturing Test Diagnosis ===\n');

// Generate test suite
console.log('1. Generating test suite...');
const testSuite = await generateTestSuite([orderProcessingIntention], manufacturingNet);
console.log(`   Generated suite with ${testSuite.testCases.length} test cases\n`);

// Create simulator
console.log('2. Creating simulator...');
const simulator = SimulatorFactory.createSimulator('algebraic');
await simulator.initialize(manufacturingNet);

// Execute test suite
console.log('3. Executing test suite...');
try {
  const results = await executeTestSuite(testSuite, manufacturingNet, simulator, { verbose: true });
  console.log(`   Total tests: ${results.summary.total}`);
  console.log(`   Passed: ${results.summary.passed}`);
  console.log(`   Failed: ${results.summary.failed}`);
  console.log(`   Errors: ${results.summary.errors}`);
  
  if (results.testResults.length > 0) {
    console.log('\n4. First test result:');
    const result = results.testResults[0];
    console.log('   Intention:', result.intentionId);
    console.log('   Verdict:', result.verdict);
    console.log('   Error:', result.error || 'none');
    console.log('   Instantiation:', JSON.stringify(result.instantiation, null, 2));
    
    if (result.pairResults) {
      console.log('\n5. Pair results:');
      for (let i = 0; i < result.pairResults.length; i++) {
        const pr = result.pairResults[i];
        console.log(`   Pair ${i + 1}:`);
        console.log('     Stimulation success:', pr.stimulationSuccess);
        console.log('     Observation match:', pr.observationMatch);
        console.log('     Error:', pr.error || 'none');
        if (pr.detail) {
          console.log('     Detail:', pr.detail.substring(0, 200));
        }
      }
    }
  }
} catch (err) {
  console.error('   Execution failed:', err.message);
  console.error(err.stack);
}
