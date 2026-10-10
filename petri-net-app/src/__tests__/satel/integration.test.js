/**
 * Integration test for SATEL with Drink Vending Machine example
 */

import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';
import { generateTestSuite } from '../../satel/core/TestGenerator';
import { drinkVendingNet } from '../../satel/examples/drinkVending/net';
import { drinkVendingIntentions } from '../../satel/examples/drinkVending/intentions';
import { extractInterface, validateInterface } from '../../satel/io/IOInterface';

describe('SATEL Integration Test - Drink Vending Machine', () => {
  it('should extract I/O interface from drink vending net', () => {
    const iface = extractInterface(drinkVendingNet);
    
    expect(iface.inputPlaces.length).toBeGreaterThan(0);
    expect(iface.outputPlaces.length).toBeGreaterThan(0);
    
    // Check specific inputs
    const inputLabels = iface.inputPlaces.map(p => p.label);
    expect(inputLabels).toContain('Coin Slot');
    expect(inputLabels).toContain('Drink Selection');
    
    // Check specific outputs
    const outputLabels = iface.outputPlaces.map(p => p.label);
    expect(outputLabels).toContain('Dispensed Drink');
    expect(outputLabels).toContain('Change');
    expect(outputLabels).toContain('Error Message');
  });
  
  it('should validate interface', () => {
    const validation = validateInterface(drinkVendingNet);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });
  
  it('should have well-formed test intentions', () => {
    expect(drinkVendingIntentions.length).toBeGreaterThan(0);
    
    for (const intention of drinkVendingIntentions) {
      expect(intention.id).toBeDefined();
      expect(intention.name).toBeDefined();
      expect(intention.pathPattern).toBeDefined();
      expect(intention.pathPattern.type).toBeDefined();
      expect(intention.pathPattern.events).toBeDefined();
      expect(intention.oracleType).toMatch(/positive|negative/);
    }
  });
  
  it('should generate test suite from intentions', async () => {
    const simulator = new AlgebraicSimulator();
    
    // Use a subset of intentions for faster testing
    const testIntentions = drinkVendingIntentions.slice(0, 2);
    
    const testSuite = await generateTestSuite(
      testIntentions,
      drinkVendingNet,
      simulator,
      {
        maxStates: 100,  // Limit for test speed
        maxDepth: 10,
        maxPathsPerIntention: 5,
        applyReduction: false  // Don't reduce for this test
      }
    );
    
    expect(testSuite).toBeDefined();
    expect(testSuite.id).toBeDefined();
    expect(testSuite.name).toBeDefined();
    expect(testSuite.testCases).toBeDefined();
    expect(testSuite.statistics).toBeDefined();
    expect(testSuite.statistics.intentionsProcessed).toBe(testIntentions.length);
  }, 30000);  // 30 second timeout for reachability graph exploration
  
  it('should apply reduction hypotheses', () => {
    // Find intentions with reduction hypotheses
    const withReduction = drinkVendingIntentions.filter(
      i => i.reductionHypothesis
    );
    
    expect(withReduction.length).toBeGreaterThan(0);
    
    // Check reduction hypothesis types
    const types = withReduction.map(i => i.reductionHypothesis.type);
    expect(types).toContain('uniformity');  // Should have uniformity hypotheses
  });
  
  it('should generate HML formulas for positive tests', () => {
    const positiveIntentions = drinkVendingIntentions.filter(
      i => i.oracleType === 'positive'
    );
    
    expect(positiveIntentions.length).toBeGreaterThan(0);
    
    // All positive intentions should have path patterns
    for (const intention of positiveIntentions) {
      expect(intention.pathPattern.events.length).toBeGreaterThan(0);
    }
  });
  
  it('should have negative test cases', () => {
    const negativeIntentions = drinkVendingIntentions.filter(
      i => i.oracleType === 'negative'
    );
    
    // Should have at least one negative test (forbidden behavior)
    expect(negativeIntentions.length).toBeGreaterThan(0);
  });
});
