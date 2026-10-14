/**
 * Debug Quality Check Transitions
 */

import { manufacturingNet } from '../../satel/examples/manufacturing/net';
import { createJob, createOrder, createMaterial } from '../../satel/examples/manufacturing/adt';
import { SimulatorFactory } from '../../features/simulation/SimulatorFactory';

test('debug quality check pass', async () => {
  const simulator = SimulatorFactory.createSimulator('algebraic');
  await simulator.initialize(manufacturingNet);
  
  console.log('\n=== Initial Marking ===');
  for (const place of simulator.petriNet.places) {
    if (place.tokens > 0 || (place.valueTokens && place.valueTokens.length > 0)) {
      console.log(`${place.id}: ${place.tokens} tokens`, place.valueTokens);
    }
  }
  
  console.log('\n=== Transition Arcs ===');
  for (const arc of simulator.petriNet.arcs) {
    if (arc.target === 'qualityCheckPass' || arc.source === 'qualityCheckPass') {
      console.log(`Arc ${arc.id}:`, arc);
    }
  }
  
  // Create a job token
  const job = createJob(createOrder(1, 'Normal'), createMaterial(50));
  console.log('\n=== Job token ===', JSON.stringify(job, null, 2));
  
  // Inject into stage3InProgress
  const stage3 = simulator.petriNet.places.find(p => p.id === 'stage3InProgress');
  console.log('Stage3 place before injection:', {
    id: stage3.id,
    sort: stage3.sort,
    tokens: stage3.tokens,
    valueTokens: stage3.valueTokens
  });
  
  stage3.valueTokens = [job];
  stage3.tokens = 1;
  
  console.log('Stage3 place after injection:', {
    tokens: stage3.tokens,
    valueTokens: stage3.valueTokens
  });
  
  // Clear the enabled cache (important!)
  if (simulator._enabledCache) {
    console.log('Clearing enabled cache with', simulator._enabledCache.size, 'entries');
    simulator._enabledCache.clear();
  }
  
  // Check enabled transitions
  console.log('\n=== Checking Enablement ===');
  
  // Verify the place is actually modified in the simulator's petriNet
  const stage3Check = simulator.petriNet.places.find(p => p.id === 'stage3InProgress');
  console.log('stage3Check === stage3?', stage3Check === stage3);
  console.log('stage3Check tokens:', stage3Check.tokens, stage3Check.valueTokens);
  
  const enabled1 = await simulator.getEnabledTransitions();
  console.log('Enabled transitions (1st call):', enabled1);
  
  const enabled2 = await simulator.getEnabledTransitions();
  console.log('Enabled transitions (2nd call):', enabled2);
  
  const enabled = enabled2;
  
  // Try to fire qualityCheckPass
  if (enabled.includes('qualityCheckPass')) {
    console.log('✓ qualityCheckPass is enabled');
    await simulator.fireTransition('qualityCheckPass');
    console.log('✓ qualityCheckPass fired');
    
    // Check stage3 after firing
    console.log('Stage3 after firing:', {
      tokens: stage3.tokens,
      valueTokens: stage3.valueTokens
    });
  } else {
    console.log('✗ qualityCheckPass NOT enabled');
    console.log('Enabled:', enabled);
  }
}, 5000);
