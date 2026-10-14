/**
 * Verification script for Manufacturing V2 bug fix
 */

import { generateTestSuite } from '../src/satel/core/TestGenerator.js';
import { AlgebraicSimulator } from '../src/features/simulation/algebraic-simulator.js';
import { manufacturingNet } from '../src/satel/examples/manufacturing/net.js';
import { manufacturingIntentionsV2 } from '../src/satel/examples/manufacturing/intentions-v2.js';

console.log('Manufacturing V2 Bug Fix Verification\n');

const simulator = new AlgebraicSimulator();
const petriNet = {
  places: manufacturingNet.places,
  transitions: manufacturingNet.transitions,
  arcs: manufacturingNet.arcs,
  mode: 'algebraic',
  adtDefinitions: manufacturingNet.adtDefinitions
};

console.log(`Intentions: ${manufacturingIntentionsV2.length}`);

const suite = await generateTestSuite(manufacturingIntentionsV2, petriNet, simulator, {
  disableGraphCaching: true,
  applyReduction: false
});

console.log(`\nResults:`);
console.log(`  Test Cases: ${suite.testCases.length}`);
console.log(`  States Explored: ${suite.statistics.statesExplored}`);

suite.testCases.forEach((tc, idx) => {
  console.log(`  Test ${idx + 1}: ${tc.expectedTrace?.length || 0} transitions`);
});

const allOk = suite.testCases.length === 11 && 
              suite.statistics.statesExplored > 1 &&
              suite.testCases.every(tc => (tc.expectedTrace?.length || 0) > 0);

console.log(`\n${allOk ? '✅ PASS' : '❌ FAIL'}`);
process.exit(allOk ? 0 : 1);
