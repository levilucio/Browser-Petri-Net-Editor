#!/usr/bin/env node

/**
 * Test V2 Generator: Variable instantiation with Manufacturing ADTs
 */

import { generateTestSuite } from './src/satel/core/TestGenerator.js';
import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentionsV2 } from './src/satel/examples/manufacturing/intentions-v2.js';
import { SimulatorFactory } from './src/features/simulation/SimulatorFactory.js';

console.log('🧪 Testing V2 Generator with Manufacturing ADTs\n');

const simulator = SimulatorFactory.createSimulator('algebraic');

try {
  console.log(`Testing ${manufacturingIntentionsV2.length} V2 intentions...\n`);
  
  const suite = await generateTestSuite(
    manufacturingIntentionsV2,
    manufacturingNet,
    simulator,
    {
      maxStates: 100,
      maxDepth: 10,
      profileMode: true,
      applyReduction: false // No reduction for V2 yet
    }
  );
  
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS:');
  console.log('='.repeat(60));
  console.log(`Intentions processed: ${suite.statistics.intentionsProcessed}`);
  console.log(`Test cases generated: ${suite.testCases.length}`);
  
  for (const tc of suite.testCases) {
    console.log(`\n  ${tc.intentionName}:`);
    console.log(`    ID: ${tc.id}`);
    console.log(`    Type: ${tc.testType}`);
    console.log(`    Instantiation:`, JSON.stringify(tc.instantiation, null, 2).split('\n').join('\n      '));
    console.log(`    Pairs: ${tc.pairs.length}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ V2 Generator test passed!');
  
} catch (err) {
  console.error('\n❌ Error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
