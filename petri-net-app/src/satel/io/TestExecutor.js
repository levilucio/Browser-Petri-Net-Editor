/**
 * Test Executor
 * Runs test cases against an APN simulator and validates results
 */

import { validateOracle } from '../core/OracleGenerator.js';

/**
 * Execute a test suite against a simulator
 * @param {Object} testSuite - Test suite to execute
 * @param {Object} petriNet - Petri net specification
 * @param {Object} simulator - Simulator instance
 * @param {Object} [options] - Execution options
 * @returns {Promise<Object>} Execution results
 */
export async function executeTestSuite(testSuite, petriNet, simulator, options = {}) {
  const results = {
    suiteId: testSuite.id,
    suiteName: testSuite.name,
    executionTime: 0,
    totalTests: testSuite.testCases.length,
    passed: 0,
    failed: 0,
    errors: 0,
    testResults: []
  };
  
  const startTime = Date.now();
  
  for (const testCase of testSuite.testCases) {
    try {
      const result = await executeTestCase(testCase, petriNet, simulator, options);
      results.testResults.push(result);
      
      if (result.passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (err) {
      results.errors++;
      results.testResults.push({
        testCaseId: testCase.id,
        passed: false,
        error: err.message,
        errorStack: err.stack
      });
    }
  }
  
  results.executionTime = Date.now() - startTime;
  
  return results;
}

/**
 * Execute a single test case
 * @param {Object} testCase - Test case to execute
 * @param {Object} petriNet - Petri net
 * @param {Object} simulator - Simulator instance
 * @param {Object} [options] - Execution options
 * @returns {Promise<Object>} Test result
 */
async function executeTestCase(testCase, petriNet, simulator, options = {}) {
  const result = {
    testCaseId: testCase.id,
    testCaseName: testCase.name,
    intentionId: testCase.intentionId,
    passed: false,
    actualTrace: [],
    actualOutputs: {},
    errors: [],
    warnings: []
  };
  
  try {
    // Apply initial marking
    const testNet = applyMarkingToNet(petriNet, testCase.initialMarking);
    
    // Initialize simulator
    await simulator.initialize(testNet);
    
    // Execute expected trace
    for (const event of testCase.expectedTrace) {
      // Check if transition is enabled
      const enabled = await simulator.isTransitionEnabled(event.transition);
      
      if (!enabled) {
        result.errors.push(
          `Transition '${event.transition}' not enabled at step ${event.timestamp}`
        );
        break; // Cannot continue trace
      }
      
      // Fire transition
      await simulator.fireTransition(event.transition);
      
      // Record actual event
      result.actualTrace.push({
        transition: event.transition,
        binding: event.binding, // TODO: capture actual binding used
        timestamp: event.timestamp
      });
    }
    
    // Get final state
    const finalNet = simulator.getCurrentState();
    const finalMarking = extractMarking(finalNet);
    result.actualOutputs = finalMarking;
    
    // Validate oracle
    const validation = validateOracle(finalMarking, testCase.oracle, petriNet);
    result.passed = validation.passed;
    result.errors.push(...validation.errors);
    result.warnings.push(...validation.warnings);
    
  } catch (err) {
    result.passed = false;
    result.errors.push(`Execution error: ${err.message}`);
  }
  
  return result;
}

/**
 * Apply a marking to a Petri net (creates a copy)
 * @param {Object} petriNet - Original Petri net
 * @param {Object} marking - Marking to apply
 * @returns {Object} New Petri net with marking
 */
function applyMarkingToNet(petriNet, marking) {
  const newNet = JSON.parse(JSON.stringify(petriNet));
  
  for (const place of newNet.places || []) {
    const tokens = marking[place.id] || [];
    
    if (tokens.length === 0) {
      place.tokens = 0;
      place.valueTokens = [];
    } else {
      place.tokens = tokens.length;
      place.valueTokens = tokens;
    }
  }
  
  return newNet;
}

/**
 * Extract marking from a Petri net
 * @param {Object} petriNet - Petri net
 * @returns {Object} Marking (placeId -> tokens)
 */
function extractMarking(petriNet) {
  const marking = {};
  
  for (const place of petriNet.places || []) {
    const tokens = [];
    
    if (place.valueTokens && place.valueTokens.length > 0) {
      tokens.push(...place.valueTokens);
    } else if (place.tokens > 0) {
      // Convert count to generic tokens
      for (let i = 0; i < place.tokens; i++) {
        tokens.push({ value: 1 });
      }
    }
    
    marking[place.id] = tokens;
  }
  
  return marking;
}

/**
 * Generate execution report (human-readable)
 * @param {Object} suiteResults - Suite execution results
 * @returns {string} Formatted report
 */
export function generateExecutionReport(suiteResults) {
  const lines = [];
  
  lines.push('='.repeat(60));
  lines.push(`Test Suite: ${suiteResults.suiteName}`);
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Total Tests: ${suiteResults.totalTests}`);
  lines.push(`Passed: ${suiteResults.passed} (${Math.round(suiteResults.passed / suiteResults.totalTests * 100)}%)`);
  lines.push(`Failed: ${suiteResults.failed}`);
  lines.push(`Errors: ${suiteResults.errors}`);
  lines.push(`Execution Time: ${suiteResults.executionTime}ms`);
  lines.push('');
  
  // List failed tests
  if (suiteResults.failed > 0 || suiteResults.errors > 0) {
    lines.push('Failed Tests:');
    lines.push('-'.repeat(60));
    
    for (const testResult of suiteResults.testResults) {
      if (!testResult.passed) {
        lines.push(`\n[FAIL] ${testResult.testCaseName || testResult.testCaseId}`);
        
        if (testResult.error) {
          lines.push(`  Error: ${testResult.error}`);
        }
        
        if (testResult.errors && testResult.errors.length > 0) {
          for (const error of testResult.errors) {
            lines.push(`  - ${error}`);
          }
        }
      }
    }
    
    lines.push('');
  }
  
  // List passed tests
  if (suiteResults.passed > 0) {
    lines.push('Passed Tests:');
    lines.push('-'.repeat(60));
    
    for (const testResult of suiteResults.testResults) {
      if (testResult.passed) {
        lines.push(`[PASS] ${testResult.testCaseName || testResult.testCaseId}`);
      }
    }
    
    lines.push('');
  }
  
  lines.push('='.repeat(60));
  
  return lines.join('\n');
}
