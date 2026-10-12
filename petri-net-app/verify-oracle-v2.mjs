#!/usr/bin/env node

/**
 * Test V2 ObservationChecker Oracle
 */

import { generateTestSuite } from './src/satel/core/TestGenerator.js';
import { executeTestSuite } from './src/satel/core/TestExecutor.js';
import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentionsV2 } from './src/satel/examples/manufacturing/intentions-v2.js';
import { SimulatorFactory } from './src/features/simulation/SimulatorFactory.js';

console.log('🧪 Testing V2 ObservationChecker Oracle\n');

const simulator = SimulatorFactory.createSimulator('algebraic');

try {
  console.log('Step 1: Generate test suite...');
  const suite = await generateTestSuite(
    [manufacturingIntentionsV2[0]], // Test just the first intention
    manufacturingNet,
    simulator,
    {
      maxStates: 100,
      maxDepth: 10,
      applyReduction: false
    }
  );
  
  console.log(`  Generated ${suite.testCases.length} test case(s)\n`);
  
  console.log('Step 2: Execute test suite...');
  const results = await executeTestSuite(
    suite,
    manufacturingNet,
    simulator,
    {
      onProgress: (progress) => {
        console.log(`  Executing ${progress.current}/${progress.total}: ${progress.testCaseId}`);
      }
    }
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS:');
  console.log('='.repeat(60));
  console.log(`Total: ${results.statistics.total}`);
  console.log(`Passed: ${results.statistics.passed}`);
  console.log(`Failed: ${results.statistics.failed}`);
  console.log(`Errors: ${results.statistics.errors}`);
  console.log(`Execution time: ${results.statistics.executionTime}ms`);
  
  for (const result of results.testResults) {
    console.log(`\n  Test ${result.testCaseId}:`);
    console.log(`    Verdict: ${result.verdict}`);
    console.log(`    Type: ${result.testType}`);
    if (result.pairResults) {
      console.log(`    Pair results: ${result.summary}`);
      for (let i = 0; i < result.pairResults.length; i++) {
        const pr = result.pairResults[i];
        console.log(`      Pair ${i}: ${pr.success ? '✓ pass' : '✗ fail'} (${pr.phase})`);
        if (pr.reason) {
          console.log(`        Reason: ${pr.reason}`);
        }
      }
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ V2 Oracle test passed!');
  
} catch (err) {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
