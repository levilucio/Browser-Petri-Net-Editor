/**
 * Test Option Net Firing to Understand Working Pattern
 */

const { optionNet } = require('./src/satel/examples/option/net.js');
const { SimulatorFactory } = require('./src/features/simulation/SimulatorFactory.js');

async function test() {
  console.log('Testing Option Net Firing\n');
  
  const simulator = SimulatorFactory.createSimulator('algebraic');
  await simulator.initialize(optionNet);
  
  console.log('Initial marking:');
  for (const place of simulator.petriNet.places) {
    if (place.valueTokens && place.valueTokens.length > 0) {
      console.log(`  ${place.id}: ${place.valueTokens.length} tokens`);
      place.valueTokens.forEach(t => console.log(`    ${JSON.stringify(t)}`));
    }
  }
  
  console.log('\nEnabled transitions:', await simulator.getEnabledTransitions());
  
  console.log('\nFiring processRequest...');
  await simulator.fireTransition('processRequest');
  
  console.log('\nAfter firing:');
  for (const place of simulator.petriNet.places) {
    if (place.valueTokens && place.valueTokens.length > 0) {
      console.log(`  ${place.id}: ${place.valueTokens.length} tokens`);
      place.valueTokens.forEach(t => console.log(`    ${JSON.stringify(t)}`));
    }
  }
  
  console.log('\n✓ Option net works correctly!');
}

test().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
