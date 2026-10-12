import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentionsV2 } from './src/satel/examples/manufacturing/intentions-v2.js';
import { generateTestSuite } from './src/satel/core/TestGenerator.js';
import { executeTestSuite } from './src/satel/core/TestExecutor.js';
import { SimulatorFactory } from './src/features/simulation/SimulatorFactory.js';

console.log('=== Testing Manufacturing Intentions ===\n');

const simulator = SimulatorFactory.createSimulator('algebraic');
await simulator.initialize(manufacturingNet);

for (const intention of manufacturingIntentionsV2) {
  console.log(`\n${'-'.repeat(70)}`);
  console.log(`Testing: ${intention.name} (${intention.id})`);
  console.log(`Type: ${intention.testType}`);
  
  try {
    const suite = await generateTestSuite(
      [intention],
      manufacturingNet,
      simulator,
      { maxStates: 0, maxDepth: 0, applyReduction: false }
    );
    
    console.log(`Generated ${suite.testCases.length} test cases`);
    
    const results = await executeTestSuite(suite, manufacturingNet, simulator);
    
    console.log(`\nResults:`);
    console.log(`  Total: ${results.statistics.total}`);
    console.log(`  Passed: ${results.statistics.passed}`);
    console.log(`  Failed: ${results.statistics.failed}`);
    console.log(`  Errors: ${results.statistics.errors}`);
    
    if (results.testResults.length > 0) {
      for (let i = 0; i < results.testResults.length; i++) {
        const result = results.testResults[i];
        console.log(`\nTest ${i + 1}: verdict=${result.verdict}`);
        
        if (result.error) {
          console.log(`  Error: ${result.error}`);
        }
        
        if (result.pairResults) {
          for (let j = 0; j < result.pairResults.length; j++) {
            const pr = result.pairResults[j];
            console.log(`  Pair ${j + 1}: success=${pr.success}, phase=${pr.phase || 'unknown'}, reason=${pr.reason || 'none'}`);
            if (pr.error) {
              console.log(`    Error: ${pr.error}`);
            }
            if (pr.detail) {
              console.log(`    Detail: ${pr.detail.substring(0, 150)}`);
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`ERROR: ${err.message}`);
    console.error(err.stack);
  }
}

console.log(`\n${'='.repeat(70)}`);
console.log('Done');
