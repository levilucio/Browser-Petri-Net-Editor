/**
 * Test for Priority Subuniformity Fix
 * 
 * Issue: Priority subuniformity should split on path guards (transition conditions),
 * not just constructors, so each priority takes a different path.
 */

import { generateTestSuite } from '../TestGenerator.js';
import { AlgebraicSimulator } from '../../../features/simulation/algebraic-simulator.js';
import { manufacturingNet } from '../../examples/manufacturing/net.js';
import { createOrder, createMaterial } from '../../examples/manufacturing/adt.js';

describe('Priority Subuniformity on Path Guards', () => {
  
  test('should generate different paths for different priority values', async () => {
    // Create intention with guard-based subuniformity
    const intention = {
      id: 'priority-guard-test',
      name: 'Priority Guard-Based Paths',
      testType: 'positive',
      variables: [
        {
          name: 'priority',
          sort: 'Priority',
          hypothesis: {
            type: 'subuniformity',
            source: 'guards' // Split on guard conditions, not constructors
          }
        }
      ],
      pairs: [
        {
          stimulation: {
            transition: 'qualityCheckPass', // Guard: priority(order(j)) == High()
            inputs: {
              stage3InProgress: [{
                __adt__: true,
                constructor: 'Job',
                args: [
                  { __adt__: true, constructor: 'Order', args: [1, '$priority'] },
                  createMaterial(100)
                ]
              }]
            }
          },
          observation: {
            outputs: {
              completedProducts: [{
                __adt__: true,
                constructor: 'Product',
                args: [1, { __adt__: true, constructor: 'Pass', args: [] }]
              }]
            }
          }
        }
      ]
    };

    const petriNet = {
      places: manufacturingNet.places,
      transitions: manufacturingNet.transitions,
      arcs: manufacturingNet.arcs,
      adtDefinitions: manufacturingNet.adtDefinitions
    };

    const simulator = new AlgebraicSimulator();
    const suite = await generateTestSuite([intention], petriNet, simulator, {
      disableGraphCaching: true,
      applyReduction: false
    });

    // Should generate multiple test cases for different priority values
    expect(suite.testCases.length).toBeGreaterThan(1);
    
    // Each case should have different priority instantiation
    const priorities = suite.testCases.map(tc => 
      JSON.stringify(tc.instantiation?.priority)
    );
    const uniquePriorities = new Set(priorities);
    expect(uniquePriorities.size).toBe(suite.testCases.length);
  });
});
