/**
 * Manufacturing Mutation Tests
 * 
 * Verifies that test verdicts change appropriately when inputs/expectations are mutated.
 * This ensures tests are genuine and not vacuous.
 */

import { manufacturingNet } from '../../satel/examples/manufacturing/net.js';
import { 
  materialSufficientIntention,
  materialExhaustionIntention,
  priorityQualityCheckIntention
} from '../../satel/examples/manufacturing/intentions-v2.js';
import { createMaterial, createOrder, createJob, createProduct } from '../../satel/examples/manufacturing/adt.js';
import { generateTestSuite } from '../../satel/core/TestGenerator.js';
import { executeTestSuite } from '../../satel/core/TestExecutor.js';
import { SimulatorFactory } from '../../features/simulation/SimulatorFactory.js';

describe('Manufacturing Mutation Tests', () => {
  let simulator;

  beforeEach(async () => {
    simulator = SimulatorFactory.createSimulator('algebraic');
    await simulator.initialize(manufacturingNet);
  });

  test('Mutation 1: Wrong expected output - verdict changes from pass to fail', async () => {
    // Original: materialSufficientIntention expects Job in scheduledJobs
    const original = { ...materialSufficientIntention };
    
    const suite = await generateTestSuite([original], manufacturingNet, simulator, {
      maxStates: 0,
      maxDepth: 0,
      applyReduction: false
    });
    
    const originalResults = await executeTestSuite(suite, manufacturingNet, simulator);
    
    // Original should pass
    expect(originalResults.testResults[0].verdict).toBe('pass');
    
    // Mutate: Change expected output to wrong Product instead of Job
    const mutated = {
      ...materialSufficientIntention,
      pairs: [{
        ...materialSufficientIntention.pairs[0],
        observation: {
          ...materialSufficientIntention.pairs[0].observation,
          outputs: {
            scheduledJobs: [createProduct(999, 'Fail')] // Wrong! Should be Job
          }
        }
      }]
    };
    
    await simulator.initialize(manufacturingNet);
    const mutatedSuite = await generateTestSuite([mutated], manufacturingNet, simulator, {
      maxStates: 0,
      maxDepth: 0,
      applyReduction: false
    });
    
    const mutatedResults = await executeTestSuite(mutatedSuite, manufacturingNet, simulator);
    
    // Mutated should fail or error (output type mismatch)
    expect(mutatedResults.testResults[0].verdict).not.toBe('pass');
  });

  test('Mutation 2: Sufficient material in negative test - verdict changes', async () => {
    // Original: materialExhaustionIntention with insufficient material (notEnabled)
    const original = { ...materialExhaustionIntention };
    
    const suite = await generateTestSuite([original], manufacturingNet, simulator, {
      maxStates: 0,
      maxDepth: 0,
      applyReduction: false
    });
    
    const originalResults = await executeTestSuite(suite, manufacturingNet, simulator);
    
    // Original should pass (notEnabled observation succeeds)
    expect(originalResults.testResults[0].verdict).toBe('pass');
    
    // Mutate: Change to sufficient material
    const mutated = {
      ...materialExhaustionIntention,
      pairs: [{
        ...materialExhaustionIntention.pairs[0],
        stimulation: {
          ...materialExhaustionIntention.pairs[0].stimulation,
          inputs: {
            orderQueue: [createOrder(1, { __adt__: true, constructor: 'Normal', args: [] })],
            rawMaterialSupply: [createMaterial(100)] // Sufficient now!
          }
        }
      }]
    };
    
    mutated.initialMarking = mutated.pairs[0].stimulation.inputs;
    await simulator.initialize(manufacturingNet);
    const mutatedSuite = await generateTestSuite([mutated], manufacturingNet, simulator, {
      maxStates: 0,
      maxDepth: 0,
      applyReduction: false
    });
    
    const mutatedResults = await executeTestSuite(mutatedSuite, manufacturingNet, simulator);
    
    // Mutated should fail (transition fires when it should not)
    expect(mutatedResults.testResults[0].verdict).toBe('fail');
  });

  test('Mutation 3: Wrong expected token value - verdict changes', async () => {
    // Create a test that expects a specific Product
    const correctTest = {
      id: 'correct-product',
      name: 'Correct Product Test',
      testType: 'positive',
      variables: [],
      pairs: [{
        stimulation: {
          transition: 'qualityCheckPass',
          inputs: {
            stage3InProgress: [
              createJob(
                createOrder(1, { __adt__: true, constructor: 'High', args: [] }),
                createMaterial(100)
              )
            ]
          }
        },
        observation: {
          outputs: {
            completedProducts: [createProduct(1, 'Pass')]
          },
          markings: {
            stage3InProgress: { length: 0 },
            completedProducts: { length: 1 }
          }
        }
      }]
    };
    
    correctTest.initialMarking = correctTest.pairs[0].stimulation.inputs;
    const suite = await generateTestSuite([correctTest], manufacturingNet, simulator, {
      maxStates: 0,
      maxDepth: 0,
      applyReduction: false
    });
    
    const originalResults = await executeTestSuite(suite, manufacturingNet, simulator);
    
    // Correct expectation should pass
    expect(originalResults.testResults[0].verdict).toBe('pass');
    
    // Mutate: Change expected product ID to wrong value
    const wrongTest = {
      ...correctTest,
      pairs: [{
        ...correctTest.pairs[0],
        observation: {
          ...correctTest.pairs[0].observation,
          outputs: {
            completedProducts: [createProduct(999, 'Pass')] // Wrong ID!
          }
        }
      }]
    };
    
    await simulator.initialize(manufacturingNet);
    const mutatedSuite = await generateTestSuite([wrongTest], manufacturingNet, simulator, {
      maxStates: 0,
      maxDepth: 0,
      applyReduction: false
    });
    
    const mutatedResults = await executeTestSuite(mutatedSuite, manufacturingNet, simulator);
    
    // Wrong expectation should fail
    expect(mutatedResults.testResults[0].verdict).toBe('fail');
  });

  test('Mutation 4: Wrong-sort token - produces error or fail', async () => {
    // Try to inject a Product where a Job is expected
    const wrongSortTest = {
      id: 'wrong-sort',
      name: 'Wrong Sort Test',
      testType: 'positive',
      variables: [],
      pairs: [{
        stimulation: {
          transition: 'qualityCheckPass',
          inputs: {
            stage3InProgress: [
              createProduct(1, 'Pass') // Wrong! Should be Job
            ]
          }
        },
        observation: {
          outputs: {
            completedProducts: [createProduct(1, 'Pass')]
          },
          markings: {
            stage3InProgress: { length: 0 },
            completedProducts: { length: 1 }
          }
        }
      }]
    };
    
    wrongSortTest.initialMarking = wrongSortTest.pairs[0].stimulation.inputs;
    const suite = await generateTestSuite([wrongSortTest], manufacturingNet, simulator, {
      maxStates: 0,
      maxDepth: 0,
      applyReduction: false
    });
    
    const results = await executeTestSuite(suite, manufacturingNet, simulator);
    
    // Should fail or error (sort mismatch causes guard to fail or pattern match to fail)
    expect(results.testResults[0].verdict).not.toBe('pass');
  });
});
