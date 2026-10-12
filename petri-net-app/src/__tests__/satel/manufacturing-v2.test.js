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
    
    // Each result should have a verdict - NO 'error' verdicts allowed
    for (let i = 0; i < results.testResults.length; i++) {
      const result = results.testResults[i];
      console.log(`Test ${i + 1}: verdict=${result.verdict}, intentionId=${result.intentionId}`);
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
      if (result.pairResults) {
        for (let j = 0; j < result.pairResults.length; j++) {
          const pr = result.pairResults[j];
          if (!pr.success) {
            console.log(`  Pair ${j + 1}: success=false, phase=${pr.phase}, reason=${pr.reason}`);
          }
        }
      }
      expect(result.verdict).toBeDefined();
      expect(['pass', 'fail']).toContain(result.verdict);
      // Explicitly forbid 'error' verdicts
      expect(result.verdict).not.toBe('error');
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
      // Positive test MUST pass
      expect(result.verdict).toBe('pass');
      
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
        // Negative test MUST pass via observation failure (not error)
        expect(result.verdict).toBe('pass');
        
        // Must have observation failure
        const hasObservationFailure = result.pairResults?.some(
          pr => !pr.success && pr.phase === 'observation'
        );
        expect(hasObservationFailure).toBe(true);
        
        // Must NOT have errors (like transition_not_enabled or firing_failed)
        const hasError = result.pairResults?.some(
          pr => pr.reason && (
            pr.reason.includes('error') || 
            pr.reason === 'transition_not_enabled_after_injection' ||
            pr.reason === 'firing_failed'
          )
        );
        expect(hasError).toBe(false);
      }
    }
  }, 10000);
});
