#!/usr/bin/env node

/**
 * Generate detailed test execution report with per-case details
 */

import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentionsV2 } from './src/satel/examples/manufacturing/intentions-v2.js';
import { generateTestSuite } from './src/satel/core/TestGenerator.js';
import { executeTestSuite } from './src/satel/core/TestExecutor.js';
import { SimulatorFactory } from './src/features/simulation/SimulatorFactory.js';

console.log('='.repeat(80));
console.log('SATEL V2 Manufacturing Test - Detailed Execution Report');
console.log('='.repeat(80));
console.log();

const simulator = SimulatorFactory.createSimulator('algebraic');
await simulator.initialize(manufacturingNet);

console.log(`Testing ${manufacturingIntentionsV2.length} intentions:\n`);

for (const intention of manufacturingIntentionsV2) {
  console.log('-'.repeat(80));
  console.log(`Intention: ${intention.name} (${intention.id})`);
  console.log(`Type: ${intention.testType}`);
  console.log(`Variables: ${intention.variables.length}`);
  
  for (const v of intention.variables) {
    console.log(`  - ${v.name}: ${v.sort} (${v.hypothesis.type})`);
  }
  
  try {
    const suite = await generateTestSuite(
      [intention],
      manufacturingNet,
      simulator,
      { maxStates: 0, maxDepth: 0, applyReduction: false }
    );
    
    console.log(`\nGenerated ${suite.testCases.length} test case(s)`);
    
    const results = await executeTestSuite(suite, manufacturingNet, simulator);
    
    for (let i = 0; i < results.testResults.length; i++) {
      const result = results.testResults[i];
      console.log(`\n  Test Case ${i + 1}:`);
      console.log(`    Verdict: ${result.verdict}`);
      
      // Show instantiation
      if (result.instantiation) {
        console.log(`    Instantiation:`);
        for (const [varName, value] of Object.entries(result.instantiation)) {
          console.log(`      ${varName}: ${JSON.stringify(value)}`);
        }
      }
      
      // Show pair results
      if (result.pairResults) {
        console.log(`    Pairs: ${result.pairResults.length}`);
        for (let j = 0; j < result.pairResults.length; j++) {
          const pr = result.pairResults[j];
          console.log(`      Pair ${j + 1}:`);
          console.log(`        Success: ${pr.success}`);
          console.log(`        Phase: ${pr.phase}`);
          if (pr.transition) {
            console.log(`        Transition: ${pr.transition}`);
          }
          if (pr.observationType) {
            console.log(`        Observation Type: ${pr.observationType}`);
          }
          if (pr.producedTokens) {
            console.log(`        Produced Tokens:`);
            for (const [placeId, tokens] of Object.entries(pr.producedTokens)) {
              console.log(`          ${placeId}: ${tokens.length} token(s)`);
              for (const token of tokens) {
                console.log(`            ${JSON.stringify(token)}`);
              }
            }
          }
          if (!pr.success && pr.reason) {
            console.log(`        Reason: ${pr.reason}`);
          }
        }
      }
    }
    
    console.log(`\n  Summary:`);
    console.log(`    Total: ${results.statistics.total}`);
    console.log(`    Passed: ${results.statistics.passed}`);
    console.log(`    Failed: ${results.statistics.failed}`);
    console.log(`    Errors: ${results.statistics.errors}`);
    console.log(`    Execution time: ${results.statistics.executionTime}ms`);
    
  } catch (err) {
    console.error(`  ERROR: ${err.message}`);
    console.error(err.stack);
  }
}

console.log();
console.log('='.repeat(80));
console.log('MUTATION TEST REPORT');
console.log('='.repeat(80));
console.log();

// Run mutation tests
import { 
  materialSufficientIntention,
  materialExhaustionIntention
} from './src/satel/examples/manufacturing/intentions-v2.js';
import { createMaterial, createOrder, createProduct } from './src/satel/examples/manufacturing/adt.js';

console.log('Mutation 1: Wrong expected output');
console.log('-'.repeat(40));

const original1 = materialSufficientIntention;
await simulator.initialize(manufacturingNet);
const suite1 = await generateTestSuite([original1], manufacturingNet, simulator, {
  maxStates: 0,
  maxDepth: 0,
  applyReduction: false
});
const result1 = await executeTestSuite(suite1, manufacturingNet, simulator);
console.log(`Original verdict: ${result1.testResults[0].verdict}`);

const mutated1 = {
  ...materialSufficientIntention,
  pairs: [{
    ...materialSufficientIntention.pairs[0],
    observation: {
      ...materialSufficientIntention.pairs[0].observation,
      outputs: {
        scheduledJobs: [createProduct(999, 'Fail')]
      }
    }
  }]
};

await simulator.initialize(manufacturingNet);
const mutatedSuite1 = await generateTestSuite([mutated1], manufacturingNet, simulator, {
  maxStates: 0,
  maxDepth: 0,
  applyReduction: false
});
const mutatedResult1 = await executeTestSuite(mutatedSuite1, manufacturingNet, simulator);
console.log(`Mutated verdict: ${mutatedResult1.testResults[0].verdict}`);
console.log(`✓ Verdict changed from ${result1.testResults[0].verdict} to ${mutatedResult1.testResults[0].verdict}`);

console.log();
console.log('Mutation 2: Sufficient material in negative test');
console.log('-'.repeat(40));

const original2 = materialExhaustionIntention;
await simulator.initialize(manufacturingNet);
const suite2 = await generateTestSuite([original2], manufacturingNet, simulator, {
  maxStates: 0,
  maxDepth: 0,
  applyReduction: false
});
const result2 = await executeTestSuite(suite2, manufacturingNet, simulator);
console.log(`Original verdict (insufficient material): ${result2.testResults[0].verdict}`);

const mutated2 = {
  ...materialExhaustionIntention,
  pairs: [{
    ...materialExhaustionIntention.pairs[0],
    stimulation: {
      ...materialExhaustionIntention.pairs[0].stimulation,
      inputs: {
        orderQueue: [createOrder(1, { __adt__: true, constructor: 'Normal', args: [] })],
        rawMaterialSupply: [createMaterial(100)]
      }
    }
  }]
};

await simulator.initialize(manufacturingNet);
const mutatedSuite2 = await generateTestSuite([mutated2], manufacturingNet, simulator, {
  maxStates: 0,
  maxDepth: 0,
  applyReduction: false
});
const mutatedResult2 = await executeTestSuite(mutatedSuite2, manufacturingNet, simulator);
console.log(`Mutated verdict (sufficient material): ${mutatedResult2.testResults[0].verdict}`);
console.log(`✓ Verdict changed from ${result2.testResults[0].verdict} to ${mutatedResult2.testResults[0].verdict}`);

console.log();
console.log('='.repeat(80));
console.log('Report complete');
console.log('='.repeat(80));
