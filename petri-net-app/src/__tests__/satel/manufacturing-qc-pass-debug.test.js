/**
 * Debug Quality Check Pass Observation
 */

import { generateTestSuite } from '../../satel/core/TestGenerator';
import { executeTestSuite } from '../../satel/core/TestExecutor';
import { manufacturingNet } from '../../satel/examples/manufacturing/net';
import { qualityCheckPassIntention } from '../../satel/examples/manufacturing/intentions-v2';
import { SimulatorFactory } from '../../features/simulation/SimulatorFactory';

test('debug QC pass observation', async () => {
  const simulator = SimulatorFactory.createSimulator('algebraic');
  
  const suite = await generateTestSuite(
    [qualityCheckPassIntention],
    manufacturingNet,
    simulator,
    { maxStates: 0, maxDepth: 0, applyReduction: false }
  );
  
  console.log('Test case:', JSON.stringify(suite.testCases[0], null, 2));
  
  const results = await executeTestSuite(suite, manufacturingNet, simulator);
  
  console.log('Results:', JSON.stringify(results.testResults[0], null, 2));
}, 5000);
