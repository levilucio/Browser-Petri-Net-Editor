/**
 * Test Executor
 * 
 * Executes test cases and checks results against oracles.
 * Accepts V2 stimulation/observation pairs only.
 */

import { executeV2TestCase } from './ObservationChecker.js';

/**
 * Execute a V2 test suite
 * 
 * @param {Object} testSuite - Generated test suite
 * @param {Object} petriNet - Petri net
 * @param {Object} simulator - Simulator instance
 * @param {Object} [options] - Execution options
 * @returns {Promise<Object>} Execution results
 */
export async function executeTestSuite(testSuite, petriNet, simulator, options = {}) {
  const results = {
    suiteId: testSuite.id,
    suiteName: testSuite.name,
    testResults: [],
    statistics: {
      total: testSuite.testCases.length,
      passed: 0,
      failed: 0,
      errors: 0,
      executionTime: 0
    }
  };
  
  const startTime = Date.now();
  
  for (let i = 0; i < testSuite.testCases.length; i++) {
    const testCase = testSuite.testCases[i];
    
    // Check for cancellation
    if (options.signal?.aborted) {
      throw new Error('Test execution cancelled');
    }
    
    // Progress callback
    if (options.onProgress) {
      options.onProgress({
        current: i + 1,
        total: testSuite.testCases.length,
        testCaseId: testCase.id
      });
    }
    
    try {
      if (testCase.oracle?.type !== 'v2' || !Array.isArray(testCase.pairs) || !testCase.pairs.length) {
        throw new Error('Only nonempty stimulation/observation test cases are supported');
      }
      const result = await executeV2TestCase(testCase, petriNet, simulator);

      results.testResults.push(result);
      
      if (result.verdict === 'pass') {
        results.statistics.passed++;
      } else if (result.verdict === 'fail') {
        results.statistics.failed++;
      } else {
        results.statistics.errors++;
      }
      
    } catch (err) {
      results.testResults.push({
        testCaseId: testCase.id,
        verdict: 'error',
        error: err.message
      });
      results.statistics.errors++;
    }
    
    // Yield to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  results.statistics.executionTime = Date.now() - startTime;
  
  return results;
}
