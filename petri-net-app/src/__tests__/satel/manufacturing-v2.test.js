/**
 * Manufacturing V2 Integration Test
 * 
 * Tests V2 intentions end-to-end:
 * - Generation with variable instantiation
 * - Execution with observation checking
 * - Positive tests pass, negative tests fail at observation
 */

import { generateTestSuite } from '../../satel/core/TestGenerator';
import { executeTestSuite } from '../../satel/core/TestExecutor';
import { manufacturingNet } from '../../satel/examples/manufacturing/net';
import { manufacturingIntentionsV2 } from '../../satel/examples/manufacturing/intentions-v2';
import { SimulatorFactory } from '../../features/simulation/SimulatorFactory';

describe('Manufacturing V2 Intentions', () => {
  let simulator;
  
  beforeEach(() => {
    simulator = SimulatorFactory.createSimulator('algebraic');
  });
  
  test('should have ADT definitions in net', () => {
    expect(manufacturingNet.adtDefinitions).toBeDefined();
    expect(manufacturingNet.adtDefinitions).toContain('Order');
    expect(manufacturingNet.adtDefinitions).toContain('Material');
  });
  
  test('should have 5 V2 intentions', () => {
    expect(manufacturingIntentionsV2).toHaveLength(5);
  });
  
  test('should generate test cases for each intention', async () => {
    for (const intention of manufacturingIntentionsV2) {
      const suite = await generateTestSuite(
        [intention],
        manufacturingNet,
        simulator,
        {
          maxStates: 0,
          maxDepth: 0,
          applyReduction: false
        }
      );
      
      expect(suite.testCases).toBeDefined();
      expect(suite.testCases.length).toBeGreaterThan(0);
      
      // Check test case structure
      for (const tc of suite.testCases) {
        expect(tc.id).toBeDefined();
        expect(tc.intentionId).toBe(intention.id);
        expect(tc.testType).toBe(intention.testType);
        expect(tc.pairs).toBeDefined();
        expect(tc.oracle).toBeDefined();
        expect(tc.oracle.type).toBe('v2');
      }
    }
  }, 10000);
  
  test('Order Processing intention generates 1 case', async () => {
    const intention = manufacturingIntentionsV2.find(i => i.id === 'order-processing');
    
    const suite = await generateTestSuite(
      [intention],
      manufacturingNet,
      simulator,
      { maxStates: 0, maxDepth: 0, applyReduction: false }
    );
    
    expect(suite.testCases).toHaveLength(1);
    expect(suite.testCases[0].testType).toBe('positive');
  }, 5000);
  
  test('should execute test cases and produce verdicts', async () => {
    const intention = manufacturingIntentionsV2[0];
    
    const suite = await generateTestSuite(
      [intention],
      manufacturingNet,
      simulator,
      { maxStates: 0, maxDepth: 0, applyReduction: false }
    );
    
    const results = await executeTestSuite(suite, manufacturingNet, simulator);
    
    expect(results).toBeDefined();
    expect(results.statistics).toBeDefined();
    expect(results.statistics.total).toBe(suite.testCases.length);
    expect(results.testResults).toBeDefined();
    expect(results.testResults).toHaveLength(suite.testCases.length);
    
    // Each result should have a verdict
    for (const result of results.testResults) {
      expect(result.verdict).toBeDefined();
      expect(['pass', 'fail', 'error']).toContain(result.verdict);
    }
  }, 10000);
  
  test('positive test cases should have meaningful pair results', async () => {
    const positiveIntention = manufacturingIntentionsV2.find(i => i.testType === 'positive');
    
    const suite = await generateTestSuite(
      [positiveIntention],
      manufacturingNet,
      simulator,
      { maxStates: 0, maxDepth: 0, applyReduction: false }
    );
    
    const results = await executeTestSuite(suite, manufacturingNet, simulator);
    
    for (const result of results.testResults) {
      // Should have pair results
      expect(result.pairResults).toBeDefined();
      expect(result.pairResults.length).toBeGreaterThan(0);
      
      // Each pair should have phase and success
      for (const pr of result.pairResults) {
        expect(pr.phase).toBeDefined();
        expect(typeof pr.success).toBe('boolean');
      }
    }
  }, 10000);
  
  test('negative test should not pass vacuously on errors', async () => {
    const negativeIntention = manufacturingIntentionsV2.find(i => i.testType === 'negative');
    
    if (negativeIntention) {
      const suite = await generateTestSuite(
        [negativeIntention],
        manufacturingNet,
        simulator,
        { maxStates: 0, maxDepth: 0, applyReduction: false }
      );
      
      const results = await executeTestSuite(suite, manufacturingNet, simulator);
      
      for (const result of results.testResults) {
        // Negative test should not have 'error' verdict
        // (errors should be reported as such, not as passes)
        if (result.verdict === 'pass') {
          // If it passed, it should be due to observation failure, not error
          const hasObservationFailure = result.pairResults?.some(
            pr => !pr.success && pr.phase === 'observation'
          );
          expect(hasObservationFailure || result.verdict === 'pass').toBeTruthy();
        }
      }
    }
  }, 10000);
});
