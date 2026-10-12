/**
 * Manufacturing V2 Verdicts Test
 * 
 * Logs and verifies actual verdicts for each test case
 */

import { generateTestSuite } from '../../satel/core/TestGenerator';
import { executeTestSuite } from '../../satel/core/TestExecutor';
import { manufacturingNet } from '../../satel/examples/manufacturing/net';
import { manufacturingIntentionsV2 } from '../../satel/examples/manufacturing/intentions-v2';
import { SimulatorFactory } from '../../features/simulation/SimulatorFactory';

describe('Manufacturing V2 Actual Verdicts', () => {
  let simulator;
  
  beforeEach(() => {
    simulator = SimulatorFactory.createSimulator('algebraic');
  });
  
  test('logs all verdicts and pair details', async () => {
    console.log('\n' + '='.repeat(70));
    console.log('MANUFACTURING V2 ACTUAL VERDICTS');
    console.log('='.repeat(70));
    
    for (const intention of manufacturingIntentionsV2) {
      console.log(`\n${intention.name} (${intention.testType}):`);
      
      const suite = await generateTestSuite(
        [intention],
        manufacturingNet,
        simulator,
        { maxStates: 0, maxDepth: 0, applyReduction: false }
      );
      
      const results = await executeTestSuite(suite, manufacturingNet, simulator);
      
      console.log(`  Generated: ${suite.testCases.length} case(s)`);
      console.log(`  Statistics: ${results.statistics.passed} pass, ${results.statistics.failed} fail, ${results.statistics.errors} errors`);
      
      for (const result of results.testResults) {
        console.log(`\n  Case ${result.testCaseId}:`);
        console.log(`    Verdict: ${result.verdict}`);
        
        if (result.pairResults) {
          for (let i = 0; i < result.pairResults.length; i++) {
            const pr = result.pairResults[i];
            const status = pr.success ? '✓' : '✗';
            console.log(`    Pair ${i + 1}: ${status} ${pr.phase}${pr.reason ? ` (${pr.reason})` : ''}`);
            if (pr.transition) {
              console.log(`      Transition: ${pr.transition}`);
            }
            if (pr.enabledTransitions) {
              console.log(`      Enabled: [${pr.enabledTransitions.join(', ')}]`);
            }
          }
        }
        
        // Track verdict types
        if (result.verdict === 'error') {
          console.log(`    ⚠️  ERROR VERDICT (should be pass or fail)`);
        }
      }
    }
    
    console.log('\n' + '='.repeat(70));
  }, 15000);
});
