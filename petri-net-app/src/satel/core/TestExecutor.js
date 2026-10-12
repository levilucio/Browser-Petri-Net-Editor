/**
 * Test Executor
 * 
 * Executes test cases and checks results against oracles.
 * Supports both V1 (trace-based) and V2 (stim/obs pairs) formats.
 */

import { executeV2TestCase, executeV2TestCases } from './ObservationChecker.js';

/**
 * Execute a test suite (V1 or V2 test cases)
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
      let result;
      
      // Detect format
      if (testCase.oracle?.type === 'v2') {
        // V2 format: use ObservationChecker
        result = await executeV2TestCase(testCase, petriNet, simulator);
      } else {
        // V1 format: use legacy oracle
        result = await executeV1TestCase(testCase, petriNet, simulator);
      }
      
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

/**
 * Execute V1 test case (legacy trace-based)
 */
async function executeV1TestCase(testCase, petriNet, simulator) {
  // Initialize simulator
  await simulator.initialize(petriNet);
  
  // Set initial marking
  if (testCase.initialMarking) {
    simulator.setMarking(testCase.initialMarking);
  }
  
  // Execute trace
  for (const event of testCase.expectedTrace) {
    const enabled = await simulator.getEnabledTransitions();
    
    if (!enabled.includes(event.transition)) {
      return {
        testCaseId: testCase.id,
        verdict: 'fail',
        reason: `Transition ${event.transition} not enabled`,
        event
      };
    }
    
    await simulator.fireTransition(event.transition);
  }
  
  // Check oracle
  const finalMarking = getCurrentMarking(simulator);
  const oracleResult = checkV1Oracle(testCase.oracle, finalMarking);
  
  return {
    testCaseId: testCase.id,
    verdict: oracleResult.passed ? 'pass' : 'fail',
    reason: oracleResult.reason,
    finalMarking
  };
}

/**
 * Check V1 oracle (output expectations)
 */
function checkV1Oracle(oracle, marking) {
  if (!oracle || !oracle.outputExpectations) {
    return { passed: true };
  }
  
  for (const expectation of oracle.outputExpectations) {
    const tokens = marking[expectation.place] || [];
    
    // Check condition
    if (expectation.condition === 'empty' && tokens.length !== 0) {
      return {
        passed: false,
        reason: `Place ${expectation.place} not empty`
      };
    }
    
    if (expectation.condition === 'non-empty' && tokens.length === 0) {
      return {
        passed: false,
        reason: `Place ${expectation.place} is empty`
      };
    }
  }
  
  return { passed: true };
}

/**
 * Get current marking from simulator
 */
function getCurrentMarking(simulator) {
  const marking = {};
  
  if (!simulator.petriNet || !simulator.petriNet.places) {
    return marking;
  }
  
  for (const place of simulator.petriNet.places) {
    marking[place.id] = place.valueTokens || [];
  }
  
  return marking;
}
