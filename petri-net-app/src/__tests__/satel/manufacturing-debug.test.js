/**
 * Debug Manufacturing V2 Execution
 */

import { generateTestSuite } from '../../satel/core/TestGenerator';
import { executeTestSuite } from '../../satel/core/TestExecutor';
import { manufacturingNet } from '../../satel/examples/manufacturing/net';
import { manufacturingIntentionsV2 } from '../../satel/examples/manufacturing/intentions-v2';
import { SimulatorFactory } from '../../features/simulation/SimulatorFactory';

test('debug order processing execution', async () => {
  const simulator = SimulatorFactory.createSimulator('algebraic');
  const intention = manufacturingIntentionsV2[0]; // order-processing
  
  console.log('\n=== Order Processing Intention ===');
  console.log('Variables:', JSON.stringify(intention.variables, null, 2));
  console.log('Pairs:', JSON.stringify(intention.pairs, null, 2));
  
  const suite = await generateTestSuite(
    [intention],
    manufacturingNet,
    simulator,
    { maxStates: 0, maxDepth: 0, applyReduction: false }
  );
  
  console.log('\n=== Generated Test Case ===');
  const testCase = suite.testCases[0];
  console.log('Instantiation:', JSON.stringify(testCase.instantiation, null, 2));
  console.log('Pairs:', JSON.stringify(testCase.pairs, null, 2));
  
  const results = await executeTestSuite(suite, manufacturingNet, simulator);
  
  console.log('\n=== Execution Results ===');
  const result = results.testResults[0];
  console.log('Verdict:', result.verdict);
  console.log('Pair Results:', JSON.stringify(result.pairResults, null, 2));
  
  // Re-initialize and manually check what the transition produces
  await simulator.initialize(manufacturingNet);
  
  // Inject tokens manually
  const orderPlace = simulator.petriNet.places.find(p => p.id === 'orderQueue');
  const materialPlace = simulator.petriNet.places.find(p => p.id === 'rawMaterialSupply');
  
  orderPlace.valueTokens = testCase.pairs[0].stimulation.inputs.orderQueue;
  materialPlace.valueTokens = testCase.pairs[0].stimulation.inputs.rawMaterialSupply;
  
  console.log('\n=== Manual Execution ===');
  console.log('Injected order tokens:', JSON.stringify(orderPlace.valueTokens, null, 2));
  console.log('Injected material tokens:', JSON.stringify(materialPlace.valueTokens, null, 2));
  
  const enabled = await simulator.getEnabledTransitions();
  console.log('Enabled:', enabled);
  
  if (enabled.includes('scheduleJob')) {
    console.log('Firing scheduleJob...');
    
    try {
      await simulator.fireTransition('scheduleJob');
      console.log('✓ Transition fired successfully');
    } catch (err) {
      console.log('✗ Transition firing failed:', err.message);
    }
    
    // Check all places after firing
    console.log('\nAll places after firing:');
    for (const place of simulator.petriNet.places) {
      if (place.valueTokens && place.valueTokens.length > 0) {
        console.log(`  ${place.id}: ${place.valueTokens.length} tokens`);
        place.valueTokens.forEach(t => console.log(`    ${JSON.stringify(t)}`));
      } else {
        console.log(`  ${place.id}: 0 tokens`);
      }
    }
    
    const scheduledJobs = simulator.petriNet.places.find(p => p.id === 'scheduledJobs');
    console.log('\nExpected tokens in scheduledJobs:', JSON.stringify(testCase.pairs[0].observation.outputs.scheduledJobs, null, 2));
  }
}, 10000);
