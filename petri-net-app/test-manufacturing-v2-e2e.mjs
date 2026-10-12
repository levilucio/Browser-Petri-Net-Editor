#!/usr/bin/env node

/**
 * End-to-End Test: Manufacturing V2 Intentions
 * 
 * Runs full generation + execution cycle and verifies:
 * - All positive tests pass
 * - All negative tests fail at observation (not errors)
 */

import { generateTestSuite } from './src/satel/core/TestGenerator.js';
import { executeTestSuite } from './src/satel/core/TestExecutor.js';
import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentionsV2 } from './src/satel/examples/manufacturing/intentions-v2.js';
import { SimulatorFactory } from './src/features/simulation/SimulatorFactory.js';

console.log('🧪 Manufacturing V2 End-to-End Test\n');
console.log('='.repeat(70));

const simulator = SimulatorFactory.createSimulator('algebraic');

let passedIntentions = 0;
let failedIntentions = 0;
const intentionResults = [];

try {
  console.log(`\n📋 Testing ${manufacturingIntentionsV2.length} V2 Intentions:\n`);
  
  for (const intention of manufacturingIntentionsV2) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Testing: ${intention.name} (${intention.testType})`);
    console.log(`Variables: ${intention.variables.length}, Pairs: ${intention.pairs.length}`);
    
    const startGen = Date.now();
    
    // Generate test suite for this intention
    const suite = await generateTestSuite(
      [intention],
      manufacturingNet,
      simulator,
      {
        maxStates: 0,
        maxDepth: 0,
        applyReduction: false,
        profileMode: true
      }
    );
    
    const genTime = Date.now() - startGen;
    console.log(`\n✓ Generated ${suite.testCases.length} test case(s) in ${genTime}ms`);
    
    // Execute test suite
    const startExec = Date.now();
    const results = await executeTestSuite(suite, manufacturingNet, simulator);
    const execTime = Date.now() - startExec;
    
    console.log(`✓ Executed in ${execTime}ms`);
    console.log(`\nResults:`);
    console.log(`  Total: ${results.statistics.total}`);
    console.log(`  Passed: ${results.statistics.passed}`);
    console.log(`  Failed: ${results.statistics.failed}`);
    console.log(`  Errors: ${results.statistics.errors}`);
    
    // Verify results based on test type
    let intentionPassed = false;
    let issues = [];
    
    if (intention.testType === 'positive') {
      // All test cases should pass
      if (results.statistics.passed === results.statistics.total && results.statistics.errors === 0) {
        intentionPassed = true;
      } else {
        issues.push(`Expected all ${results.statistics.total} cases to pass, but ${results.statistics.failed} failed and ${results.statistics.errors} errored`);
      }
    } else if (intention.testType === 'negative') {
      // All test cases should pass (observation failures expected)
      if (results.statistics.passed === results.statistics.total && results.statistics.errors === 0) {
        intentionPassed = true;
      } else {
        issues.push(`Expected negative tests to pass via observation failure, but ${results.statistics.errors} errored`);
      }
    }
    
    // Check per-case details
    for (const result of results.testResults) {
      console.log(`\n  Case ${result.testCaseId}:`);
      console.log(`    Verdict: ${result.verdict}`);
      
      if (result.pairResults) {
        for (let i = 0; i < result.pairResults.length; i++) {
          const pr = result.pairResults[i];
          const status = pr.success ? '✓' : '✗';
          console.log(`    Pair ${i + 1}: ${status} ${pr.phase}${pr.reason ? ` (${pr.reason})` : ''}`);
        }
      }
      
      // Verify verdict correctness
      if (intention.testType === 'positive' && result.verdict !== 'pass') {
        issues.push(`Case ${result.testCaseId}: expected pass, got ${result.verdict}`);
      }
      
      if (intention.testType === 'negative') {
        if (result.verdict === 'error') {
          issues.push(`Case ${result.testCaseId}: negative test got error verdict (should be pass via observation failure)`);
        } else if (result.verdict !== 'pass') {
          issues.push(`Case ${result.testCaseId}: negative test should pass, got ${result.verdict}`);
        }
      }
    }
    
    if (intentionPassed && issues.length === 0) {
      console.log(`\n✅ ${intention.name}: PASS`);
      passedIntentions++;
    } else {
      console.log(`\n❌ ${intention.name}: FAIL`);
      for (const issue of issues) {
        console.log(`   - ${issue}`);
      }
      failedIntentions++;
    }
    
    intentionResults.push({
      intention: intention.name,
      testType: intention.testType,
      testCases: suite.testCases.length,
      passed: intentionPassed,
      genTime,
      execTime,
      issues
    });
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`FINAL RESULTS:`);
  console.log(`='.repeat(70)}`);
  console.log(`Intentions: ${passedIntentions}/${manufacturingIntentionsV2.length} passed`);
  console.log(`Failed: ${failedIntentions}`);
  
  if (failedIntentions === 0) {
    console.log(`\n✅ ALL MANUFACTURING V2 TESTS PASS`);
    process.exit(0);
  } else {
    console.log(`\n❌ SOME TESTS FAILED - See details above`);
    process.exit(1);
  }
  
} catch (err) {
  console.error(`\n❌ FATAL ERROR:`, err.message);
  console.error(err.stack);
  process.exit(1);
}
