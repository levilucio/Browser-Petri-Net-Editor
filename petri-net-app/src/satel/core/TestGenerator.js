/**
 * Test Generator
 * Generates concrete test cases from test intentions
 */

import { buildReachabilityGraph, findMatchingPaths } from './StateSpaceExplorer.js';
import { generateOracle } from './OracleGenerator.js';
import { applyReduction } from './ReductionEngine.js';

/**
 * Generate test suite from test intentions
 * @param {Array} testIntentions - Array of test intentions
 * @param {Object} petriNet - Petri net specification
 * @param {Object} simulator - Simulator instance
 * @param {Object} [options] - Generation options
 * @returns {Promise<Object>} Test suite
 */
export async function generateTestSuite(testIntentions, petriNet, simulator, options = {}) {
  const testCases = [];
  const statistics = {
    intentionsProcessed: 0,
    casesGenerated: 0,
    casesAfterReduction: 0,
    generationTime: 0
  };
  
  const startTime = Date.now();
  
  for (const intention of testIntentions) {
    try {
      const cases = await generateTestCasesFromIntention(
        intention,
        petriNet,
        simulator,
        options
      );
      
      testCases.push(...cases);
      statistics.intentionsProcessed++;
      statistics.casesGenerated += cases.length;
    } catch (err) {
      console.error(`Failed to generate tests for intention '${intention.id}':`, err);
    }
  }
  
  // Apply reduction if requested
  let reducedTestCases = testCases;
  if (options.applyReduction !== false) {
    reducedTestCases = applyReduction(testCases, testIntentions, petriNet);
    statistics.casesAfterReduction = reducedTestCases.length;
  } else {
    statistics.casesAfterReduction = testCases.length;
  }
  
  statistics.generationTime = Date.now() - startTime;
  
  return {
    id: `suite-${Date.now()}`,
    name: options.suiteName || 'Generated Test Suite',
    description: options.suiteDescription || `Generated from ${testIntentions.length} test intention(s)`,
    testCases: reducedTestCases,
    statistics
  };
}

/**
 * Generate test cases from a single test intention
 * @param {Object} testIntention - Test intention
 * @param {Object} petriNet - Petri net
 * @param {Object} simulator - Simulator instance
 * @param {Object} [options] - Generation options
 * @returns {Promise<Array>} Array of test cases
 */
async function generateTestCasesFromIntention(testIntention, petriNet, simulator, options = {}) {
  const testCases = [];
  
  // Build reachability graph
  const graph = await buildReachabilityGraph(petriNet, simulator, {
    maxStates: options.maxStates || 1000,
    maxDepth: options.maxDepth || 50
  });
  
  if (graph.truncated) {
    console.warn(`Reachability graph truncated for intention '${testIntention.id}'`);
  }
  
  // Find paths matching the intention's path pattern
  const matchingPaths = findMatchingPaths(graph, testIntention.pathPattern, {
    maxPaths: options.maxPathsPerIntention || 100
  });
  
  if (matchingPaths.length === 0) {
    console.warn(`No matching paths found for intention '${testIntention.id}'`);
    return [];
  }
  
  // Generate a test case for each matching path
  for (let i = 0; i < matchingPaths.length; i++) {
    const path = matchingPaths[i];
    
    try {
      const testCase = await generateTestCaseFromPath(
        testIntention,
        path,
        graph,
        petriNet,
        simulator,
        i
      );
      testCases.push(testCase);
    } catch (err) {
      console.error(`Failed to generate test case from path ${i}:`, err);
    }
  }
  
  return testCases;
}

/**
 * Generate a single test case from a path in the reachability graph
 * @param {Object} testIntention - Test intention
 * @param {Array} path - Path (array of transitions)
 * @param {Object} graph - Reachability graph
 * @param {Object} petriNet - Petri net
 * @param {Object} simulator - Simulator
 * @param {number} index - Path index
 * @returns {Promise<Object>} Test case
 */
async function generateTestCaseFromPath(testIntention, path, graph, petriNet, simulator, index) {
  // Get initial marking
  const initialState = graph.states.find(s => s.id === graph.initialStateId);
  const initialMarking = initialState.marking;
  
  // Build trace from path
  const trace = path.map((transition, i) => ({
    transition: transition.transitionId,
    binding: transition.binding || {},
    timestamp: i
  }));
  
  // Get final marking
  const finalTransition = path[path.length - 1];
  const finalState = graph.states.find(s => s.id === finalTransition.targetStateId);
  const finalMarking = finalState ? finalState.marking : initialMarking;
  
  // Generate oracle
  const oracle = generateOracle(testIntention, trace, finalMarking, petriNet);
  
  // Create test case
  const testCase = {
    id: `${testIntention.id}-case-${index}`,
    intentionId: testIntention.id,
    name: `${testIntention.name} - Case ${index + 1}`,
    initialMarking,
    expectedTrace: trace,
    oracle
  };
  
  return testCase;
}

/**
 * Apply input constraints to generate initial markings
 * @param {Object} testIntention - Test intention
 * @param {Object} petriNet - Petri net
 * @returns {Array} Array of initial markings
 */
function generateInitialMarkings(testIntention, petriNet) {
  const markings = [];
  
  // Base marking from current net
  const baseMarking = {};
  for (const place of petriNet.places || []) {
    const tokens = [];
    if (place.valueTokens && place.valueTokens.length > 0) {
      tokens.push(...place.valueTokens);
    } else if (place.tokens > 0) {
      // Convert count to tokens
      for (let i = 0; i < place.tokens; i++) {
        tokens.push({ value: 1 });
      }
    }
    baseMarking[place.id] = tokens;
  }
  
  // Apply input constraints if specified
  if (testIntention.inputConstraints && testIntention.inputConstraints.length > 0) {
    const constrainedMarking = { ...baseMarking };
    
    for (const constraint of testIntention.inputConstraints) {
      if (constraint.place) {
        // Add tokens to input place
        const tokens = parseConstraintPattern(constraint.pattern);
        constrainedMarking[constraint.place] = tokens;
      }
    }
    
    markings.push(constrainedMarking);
  } else {
    // No constraints, use base marking
    markings.push(baseMarking);
  }
  
  return markings;
}

/**
 * Parse constraint pattern to tokens
 * @param {string} pattern - Pattern string
 * @returns {Array} Tokens
 */
function parseConstraintPattern(pattern) {
  try {
    if (pattern.startsWith('[')) {
      return JSON.parse(pattern).map(v => ({ value: v }));
    }
    const num = Number(pattern);
    if (!isNaN(num)) {
      return [{ value: num }];
    }
    return [{ value: pattern }];
  } catch (err) {
    return [{ value: pattern }];
  }
}
