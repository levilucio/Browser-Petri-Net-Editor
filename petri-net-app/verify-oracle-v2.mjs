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
  
  // ASSERTIONS
  let assertionsFailed = 0;
  
  // Assert: some test cases were generated
  if (suite.testCases.length === 0) {
    console.error('❌ ASSERTION FAILED: No test cases generated');
    assertionsFailed++;
  } else {
    console.log(`✓ Generated ${suite.testCases.length} test cases`);
  }
  
  // Assert: execution produced results
  if (!results.testResults || results.testResults.length === 0) {
    console.error('❌ ASSERTION FAILED: No execution results');
    assertionsFailed++;
  } else {
    console.log(`✓ Executed ${results.testResults.length} test cases`);
  }
  
  // Assert: statistics are present
  if (!results.statistics) {
    console.error('❌ ASSERTION FAILED: No statistics in results');
    assertionsFailed++;
  } else {
    console.log(`✓ Statistics: ${results.statistics.passed} pass, ${results.statistics.failed} fail, ${results.statistics.errors} errors`);
  }
  
  // Assert: at least one test passed or failed (not all errors)
  if (results.statistics && results.statistics.errors === results.statistics.total) {
    console.error('❌ ASSERTION FAILED: All tests errored (none passed or failed meaningfully)');
    assertionsFailed++;
  } else {
    console.log(`✓ Tests executed meaningfully (not all errors)`);
  }
  
  // Assert: per-test verdicts are present
  for (const result of results.testResults) {
    if (!result.verdict) {
      console.error(`❌ ASSERTION FAILED: Test ${result.testCaseId} has no verdict`);
      assertionsFailed++;
    }
  }
  
  if (assertionsFailed > 0) {
    console.log(`\n❌ ${assertionsFailed} assertion(s) failed`);
    process.exit(1);
  }
  
  console.log('\n✅ All assertions passed!');
  
} catch (err) {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
