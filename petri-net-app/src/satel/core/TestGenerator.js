/**
 * Test Generator
 * Generates concrete test cases from test intentions
 * Supports both V1 (PathEvent) and V2 (StimObs pairs) formats
 */

import { buildReachabilityGraph, findMatchingPaths } from './StateSpaceExplorer.js';
import { generateOracle } from './OracleGenerator.js';
import { applyReduction } from './ReductionEngine.js';
import { buildAdtRegistry } from '../../utils/adt-parser.js';
import { 
  instantiateVariables, 
  cartesianProduct, 
  filterByGuards,
  instantiatePair,
  extractMultiVariableGuards
} from './VariableInstantiator.js';
import { validateIntention } from './IntentionSchema.js';

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
    generationTime: 0,
    totalIntentions: 0,  // Will be set at end
    statesExplored: 0,   // Will be set at end
    reductionApplied: false,  // Will be set at end
    timing: {
      exploration: 0,
      pathFinding: 0,
      oracleGen: 0,
      reduction: 0
    }
  };
  
  const startTime = Date.now();
  
  // Build ADT registry from Petri net ADT definitions for constructor partitioning
  const adtRegistry = buildAdtRegistry(petriNet);
  
  // OPTIMIZATION: Build reachability graph once and reuse for all intentions
  // This is the biggest time saver since all intentions share the same Petri net
  const graphStart = Date.now();
  const sharedGraph = options.disableGraphCaching ? null : await buildReachabilityGraph(petriNet, simulator, {
    maxStates: options.maxStates ?? 1000,
    maxDepth: options.maxDepth || 50,
    signal: options.signal,
    onProgress: options.onProgress,
    adtRegistry // Pass ADT registry for constructor partitioning
  });
  const graphTime = Date.now() - graphStart;
  
  if (options.profileMode && sharedGraph) {
    console.log(`[PROFILE] Shared reachability graph: ${graphTime}ms (${sharedGraph.states.length} states, ${sharedGraph.transitions.length} transitions)`);
    console.log(`[PROFILE] This graph will be reused for all ${testIntentions.length} intentions\n`);
  }
  
  for (let i = 0; i < testIntentions.length; i++) {
    const intention = testIntentions[i];
    
    try {
      const intentionStart = Date.now();
      
      // Update progress
      if (options.onProgress) {
        options.onProgress({
          current: i + 1,
          total: testIntentions.length,
          message: `Processing: ${intention.name || intention.id}`
        });
      }
      
      const cases = await generateTestCasesFromIntention(
        intention,
        petriNet,
        simulator,
        { ...options, sharedGraph }
      );
      
      testCases.push(...cases);
      statistics.intentionsProcessed++;
      statistics.casesGenerated += cases.length;
      
      if (options.profileMode) {
        console.log(`[PROFILE] Intention '${intention.name}': ${Date.now() - intentionStart}ms, ${cases.length} cases`);
      }
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
  
  // Add fields expected by UI
  statistics.totalIntentions = testIntentions.length;
  statistics.statesExplored = sharedGraph ? sharedGraph.states.length : 0;  // states is an array, not Map
  statistics.reductionApplied = options.applyReduction !== false;
  
  return {
    id: `suite-${Date.now()}`,
    name: options.suiteName || 'Generated Test Suite',
    description: options.suiteDescription || `Generated from ${testIntentions.length} test intention(s)`,
    testCases: reducedTestCases,
    statistics
  };
}

/**
 * Detect if intention is V2 format (has variables and pairs)
 */
function isV2Intention(intention) {
  return intention.variables && intention.pairs;
}

/**
 * Generate test cases from V2 intention (stimulation/observation pairs)
 * @private
 */
async function generateTestCasesFromIntentionV2(intention, petriNet, simulator, options = {}) {
  const adtRegistry = options.adtRegistry || buildAdtRegistry(petriNet);
  
  // Validate schema
  try {
    validateIntention(intention);
  } catch (err) {
    console.error(`Invalid V2 intention ${intention.id}:`, err.message);
    return [];
  }
  
  // 1. Generate representatives per variable per hypothesis
  const instantiations = instantiateVariables(intention, petriNet, adtRegistry);
  
  // 2. Cartesian product
  let combinations = cartesianProduct(instantiations);
  
  if (options.profileMode) {
    console.log(`[V2] Intention '${intention.name}': ${combinations.length} combinations before filtering`);
  }
  
  // 3. Filter by multi-variable guards
  const guards = extractMultiVariableGuards(intention.variables, petriNet);
  if (guards.length > 0) {
    combinations = await filterByGuards(combinations, guards, petriNet);
    
    if (options.profileMode) {
      console.log(`[V2] Intention '${intention.name}': ${combinations.length} combinations after guard filtering`);
    }
  }
  
  // 4. Generate one test case per combination
  const testCases = [];
  for (const inst of combinations) {
    // Instantiate all pairs
    const instantiatedPairs = intention.pairs.map(pair => 
      instantiatePair(pair, inst)
    );
    
    testCases.push({
      id: `${intention.id}-${testCases.length + 1}`,
      intentionId: intention.id,
      intentionName: intention.name,
      testType: intention.testType,
      instantiation: inst,
      pairs: instantiatedPairs,
      expectedTrace: [], // Not used for V2
      oracle: { type: 'v2', pairs: instantiatedPairs }
    });
  }
  
  return testCases;
}

/**
 * Generate test cases from a single test intention (V1 or V2 format)
 * @param {Object} testIntention - Test intention
 * @param {Object} petriNet - Petri net
 * @param {Object} simulator - Simulator instance
 * @param {Object} [options] - Generation options
 * @returns {Promise<Array>} Array of test cases
 */
async function generateTestCasesFromIntention(testIntention, petriNet, simulator, options = {}) {
  // Detect format
  if (isV2Intention(testIntention)) {
    return await generateTestCasesFromIntentionV2(testIntention, petriNet, simulator, options);
  }
  
  // V1 format (legacy)
  const testCases = [];
  
  // Use shared graph if available (major optimization)
  let graph;
  let graphTime = 0;
  
  if (options.sharedGraph) {
    // Reuse pre-computed graph (saves ~95% of time per intention)
    graph = options.sharedGraph;
  } else {
    // Build reachability graph for this intention only
    const graphStart = Date.now();
    graph = await buildReachabilityGraph(petriNet, simulator, {
      maxStates: options.maxStates ?? 1000,
      maxDepth: options.maxDepth || 50,
      signal: options.signal,
      adtRegistry, // Pass ADT registry
      onProgress: options.onProgress
    });
    graphTime = Date.now() - graphStart;
  }
  
  if (graph.truncated) {
    console.warn(`Reachability graph truncated for intention '${testIntention.id}'`);
  }
  
  // Find paths matching the intention's path pattern
  const pathStart = Date.now();
  const matchingPaths = findMatchingPaths(graph, testIntention.pathPattern, {
    maxPaths: options.maxPathsPerIntention || 100
  });
  const pathTime = Date.now() - pathStart;
  
  if (options.profileMode && !options.sharedGraph) {
    console.log(`  [PROFILE]   Graph: ${graphTime}ms (${graph.states.length} states), Paths: ${pathTime}ms (${matchingPaths.length} found)`);
  } else if (options.profileMode) {
    console.log(`  [PROFILE]   Paths: ${pathTime}ms (${matchingPaths.length} found from cached graph)`);
  }
  
  if (matchingPaths.length === 0) {
    console.warn(`No matching paths found for intention '${testIntention.id}' (${testIntention.name})`);
    console.warn(`  Path pattern:`, JSON.stringify(testIntention.pathPattern, null, 2));
    console.warn(`  Available transitions in graph:`, graph.transitions.slice(0, 5).map(t => t.transitionId));
    return [];
  }
  
  // Generate a test case for each matching path (limit to avoid explosion)
  const oracleStart = Date.now();
  const maxCases = Math.min(matchingPaths.length, options.maxPathsPerIntention || 100);
  
  for (let i = 0; i < maxCases; i++) {
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
  const oracleTime = Date.now() - oracleStart;
  
  if (options.profileMode) {
    console.log(`  [PROFILE]   Oracle gen: ${oracleTime}ms for ${testCases.length} cases`);
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
