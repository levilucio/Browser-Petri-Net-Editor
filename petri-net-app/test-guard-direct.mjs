#!/usr/bin/env node
/**
 * Test guard evaluation directly
 */

import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { SimulatorFactory } from './src/features/simulation/SimulatorFactory.js';

const simulator = SimulatorFactory.createSimulator('algebraic');
await simulator.initialize(manufacturingNet);

console.log('Testing scheduleJob transition...\n');

// Inject tokens
const orderPlace = simulator.petriNet.places.find(p => p.id === 'orderQueue');
const materialPlace = simulator.petriNet.places.find(p => p.id === 'rawMaterialSupply');

orderPlace.valueTokens = [{
  __adt__: true,
  constructor: 'Order',
  args: [1, { __adt__: true, constructor: 'Normal', args: [] }]
}];
orderPlace.tokens = 1;

materialPlace.valueTokens = [{
  __adt__: true,
  constructor: 'Material',
  args: [100]
}];
materialPlace.tokens = 1;

console.log('Injected tokens:');
console.log('  orderQueue:', JSON.stringify(orderPlace.valueTokens[0], null, 2));
console.log('  material:', JSON.stringify(materialPlace.valueTokens[0], null, 2));

// Get transition
const transition = simulator.petriNet.transitions.find(t => t.id === 'scheduleJob');
console.log('\nTransition guard:', transition.guard);
console.log('Transition action:', transition.action);

// Clear cache
if (simulator._enabledCache) {
  simulator._enabledCache.clear();
  console.log('\nCleared cache');
}

// Check if enabled
console.log('\nChecking if transition enabled...');
const enabled = await simulator.getEnabledTransitions();
console.log('Enabled transitions:', enabled);

if (enabled.includes('scheduleJob')) {
  console.log('\n✓ scheduleJob is enabled!');
  
  console.log('\nFiring transition...');
  await simulator.fireTransition('scheduleJob');
  
  const scheduledJobs = simulator.petriNet.places.find(p => p.id === 'scheduledJobs');
  console.log('\nProduced tokens in scheduledJobs:');
  console.log(JSON.stringify(scheduledJobs.valueTokens, null, 2));
} else {
  console.log('\n✗ scheduleJob NOT enabled');
  
  // Debug why
  const isEnabled = await simulator.isTransitionEnabled('scheduleJob');
  console.log('isTransitionEnabled result:', isEnabled);
}
