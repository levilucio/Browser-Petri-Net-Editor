#!/usr/bin/env node

/**
 * Verify Manufacturing Net Transitions Fire Correctly
 */

import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { SimulatorFactory } from './src/features/simulation/SimulatorFactory.js';

console.log('🔧 Verifying Manufacturing Net Transitions\n');

const simulator = SimulatorFactory.createSimulator('algebraic');

async function testTransition(transitionId, description) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`Testing: ${transitionId} - ${description}`);
  
  try {
    // Initialize with net
    await simulator.initialize(manufacturingNet);
    
    // Show initial marking
    console.log('\nInitial marking:');
    for (const place of manufacturingNet.places) {
      if (place.valueTokens && place.valueTokens.length > 0) {
        console.log(`  ${place.id}: ${place.valueTokens.length} token(s)`);
        console.log(`    ${JSON.stringify(place.valueTokens[0])}`);
      }
    }
    
    // Check if transition is enabled
    const enabled = await simulator.getEnabledTransitions();
    console.log(`\nEnabled transitions: [${enabled.join(', ')}]`);
    
    if (!enabled.includes(transitionId)) {
      console.log(`❌ ${transitionId} NOT ENABLED`);
      return false;
    }
    
    console.log(`✓ ${transitionId} is enabled`);
    
    // Fire transition
    await simulator.fireTransition(transitionId);
    console.log(`✓ ${transitionId} fired successfully`);
    
    // Show resulting marking
    console.log('\nResulting marking:');
    for (const place of simulator.petriNet.places) {
      if (place.valueTokens && place.valueTokens.length > 0) {
        console.log(`  ${place.id}: ${place.valueTokens.length} token(s)`);
        for (const token of place.valueTokens) {
          console.log(`    ${JSON.stringify(token)}`);
        }
      }
    }
    
    return true;
  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    console.log(err.stack);
    return false;
  }
}

async function runTests() {
  let passed = 0;
  let failed = 0;
  
  // Test 1: scheduleJob
  if (await testTransition('scheduleJob', 'Schedule a job from order and material')) {
    passed++;
  } else {
    failed++;
  }
  
  // For subsequent tests, we need to set up the marking
  // Test 2: startStage1
  await simulator.initialize(manufacturingNet);
  // Manually set up scheduledJobs
  const scheduledJobsPlace = simulator.petriNet.places.find(p => p.id === 'scheduledJobs');
  scheduledJobsPlace.valueTokens = [
    { __adt__: true, constructor: 'Job', args: [
      { __adt__: true, constructor: 'Order', args: [1, { __adt__: true, constructor: 'Normal', args: [] }] },
      { __adt__: true, constructor: 'Material', args: [100] }
    ]}
  ];
  
  if (await testTransition('startStage1', 'Start stage 1 with job and machine')) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 3: completeStage1
  await simulator.initialize(manufacturingNet);
  const stage1Place = simulator.petriNet.places.find(p => p.id === 'stage1InProgress');
  stage1Place.valueTokens = [
    { __adt__: true, constructor: 'Job', args: [
      { __adt__: true, constructor: 'Order', args: [1, { __adt__: true, constructor: 'Normal', args: [] }] },
      { __adt__: true, constructor: 'Material', args: [100] }
    ]}
  ];
  
  if (await testTransition('completeStage1', 'Complete stage 1')) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 4: completeStage2
  await simulator.initialize(manufacturingNet);
  const stage2Place = simulator.petriNet.places.find(p => p.id === 'stage2InProgress');
  stage2Place.valueTokens = [
    { __adt__: true, constructor: 'Job', args: [
      { __adt__: true, constructor: 'Order', args: [1, { __adt__: true, constructor: 'Normal', args: [] }] },
      { __adt__: true, constructor: 'Material', args: [100] }
    ]}
  ];
  
  if (await testTransition('completeStage2', 'Complete stage 2')) {
    passed++;
  } else {
    failed++;
  }
  
  // Test 5: qualityCheckPass
  await simulator.initialize(manufacturingNet);
  const stage3Place = simulator.petriNet.places.find(p => p.id === 'stage3InProgress');
  stage3Place.valueTokens = [
    { __adt__: true, constructor: 'Job', args: [
      { __adt__: true, constructor: 'Order', args: [1, { __adt__: true, constructor: 'Normal', args: [] }] },
      { __adt__: true, constructor: 'Material', args: [100] }
    ]}
  ];
  
  if (await testTransition('qualityCheckPass', 'Quality check pass')) {
    passed++;
  } else {
    failed++;
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ All transitions fire correctly!');
    process.exit(0);
  } else {
    console.log('❌ Some transitions failed');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
