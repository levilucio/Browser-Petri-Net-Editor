/**
 * Test Manufacturing Transitions Fire and Produce Output Tokens
 */

import { manufacturingNet } from '../../satel/examples/manufacturing/net.js';
import { SimulatorFactory } from '../../features/simulation/SimulatorFactory.js';

describe('Manufacturing Transition Firing', () => {
  let simulator;
  
  beforeEach(async () => {
    simulator = SimulatorFactory.createSimulator('algebraic');
    await simulator.initialize(manufacturingNet);
  });
  
  test('scheduleJob: sufficient material enables transition', async () => {
    // Inject Order and Material with sufficient quantity
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
      args: [100]  // >= 50, guard satisfied
    }];
    materialPlace.tokens = 1;
    
    // Clear cache
    if (simulator._enabledCache) simulator._enabledCache.clear();
    
    const enabled = await simulator.getEnabledTransitions();
    console.log('Enabled with sufficient material:', enabled);
    
    expect(enabled).toContain('scheduleJob');
    
    // Fire transition
    await simulator.fireTransition('scheduleJob');
    
    // Check outputs
    const scheduledJobs = simulator.petriNet.places.find(p => p.id === 'scheduledJobs');
    console.log('Produced tokens:', JSON.stringify(scheduledJobs.valueTokens, null, 2));
    
    expect(scheduledJobs.valueTokens.length).toBe(1);
    const producedJob = scheduledJobs.valueTokens[0];
    expect(producedJob.__adt__).toBe(true);
    expect(producedJob.constructor).toBe('Job');
    expect(producedJob.args).toHaveLength(2);
  });
  
  test('scheduleJob: insufficient material disables transition', async () => {
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
      args: [30]  // < 50, guard NOT satisfied
    }];
    materialPlace.tokens = 1;
    
    if (simulator._enabledCache) simulator._enabledCache.clear();
    
    const enabled = await simulator.getEnabledTransitions();
    console.log('Enabled with insufficient material:', enabled);
    
    expect(enabled).not.toContain('scheduleJob');
  });
  
  test('qualityCheckPass: High priority enables transition', async () => {
    const stage3 = simulator.petriNet.places.find(p => p.id === 'stage3InProgress');
    
    const job = {
      __adt__: true,
      constructor: 'Job',
      args: [
        { __adt__: true, constructor: 'Order', args: [
          1,
          { __adt__: true, constructor: 'High', args: [] }
        ]},
        { __adt__: true, constructor: 'Material', args: [100] }
      ]
    };
    
    stage3.valueTokens = [job];
    stage3.tokens = 1;
    
    if (simulator._enabledCache) simulator._enabledCache.clear();
    
    const enabled = await simulator.getEnabledTransitions();
    console.log('Enabled for High priority:', enabled);
    
    expect(enabled).toContain('qualityCheckPass');
    expect(enabled).not.toContain('qualityCheckFail');
    
    // Fire and check output
    await simulator.fireTransition('qualityCheckPass');
    
    const products = simulator.petriNet.places.find(p => p.id === 'completedProducts');
    console.log('Produced products:', JSON.stringify(products.valueTokens, null, 2));
    
    expect(products.valueTokens.length).toBe(1);
    const product = products.valueTokens[0];
    expect(product.__adt__).toBe(true);
    expect(product.constructor).toBe('Product');
  });
  
  test('qualityCheckFail: Normal priority enables rework transition', async () => {
    const stage3 = simulator.petriNet.places.find(p => p.id === 'stage3InProgress');
    
    const job = {
      __adt__: true,
      constructor: 'Job',
      args: [
        { __adt__: true, constructor: 'Order', args: [
          1,
          { __adt__: true, constructor: 'Normal', args: [] }
        ]},
        { __adt__: true, constructor: 'Material', args: [100] }
      ]
    };
    
    stage3.valueTokens = [job];
    stage3.tokens = 1;
    
    if (simulator._enabledCache) simulator._enabledCache.clear();
    
    const enabled = await simulator.getEnabledTransitions();
    console.log('Enabled for Normal priority:', enabled);
    
    expect(enabled).not.toContain('qualityCheckPass');
    expect(enabled).toContain('qualityCheckFail');
    
    // Fire and check output
    await simulator.fireTransition('qualityCheckFail');
    
    const rework = simulator.petriNet.places.find(p => p.id === 'reworkQueue');
    console.log('Rework tokens:', JSON.stringify(rework.valueTokens, null, 2));
    
    expect(rework.valueTokens.length).toBe(1);
    expect(rework.valueTokens[0].__adt__).toBe(true);
    expect(rework.valueTokens[0].constructor).toBe('Job');
  });
});
