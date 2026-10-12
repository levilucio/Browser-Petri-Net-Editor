/**
 * Observation Checker (Oracle)
 * 
 * Executes stimulation/observation pairs and checks results.
 * Implements positive/negative test semantics.
 */

/**
 * Execute and check a V2 test case (sequence of stim/obs pairs)
 * 
 * @param {Object} testCase - V2 test case with pairs
 * @param {Object} petriNet - Petri net
 * @param {Object} simulator - Simulator instance
 * @returns {Promise<Object>} Test result
 */
export async function executeV2TestCase(testCase, petriNet, simulator) {
  const { pairs, testType } = testCase;
  
  // Initialize simulator with petri net
  await simulator.initialize(petriNet);
  
  const pairResults = [];
  let overallSuccess = true;
  let firstFailureIndex = -1;
  
  // Execute each pair sequentially
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    
    try {
      const result = await executePair(pair, simulator);
      pairResults.push(result);
      
      if (!result.success) {
        overallSuccess = false;
        if (firstFailureIndex === -1) {
          firstFailureIndex = i;
        }
        
        // For negative tests, first failure is expected
        if (testType === 'negative') {
          break; // Stop on first failure (expected)
        }
      }
    } catch (err) {
      pairResults.push({
        success: false,
        error: err.message,
        pairIndex: i
      });
      overallSuccess = false;
      if (firstFailureIndex === -1) {
        firstFailureIndex = i;
      }
      
      // For negative tests, error is expected
      if (testType === 'negative') {
        break;
      }
    }
  }
  
  // Determine verdict based on test type
  let verdict;
  if (testType === 'positive') {
    // All pairs must succeed
    verdict = overallSuccess ? 'pass' : 'fail';
  } else {
    // At least one pair must fail
    verdict = overallSuccess ? 'fail' : 'pass'; // Inverted!
  }
  
  return {
    testCaseId: testCase.id,
    testType,
    verdict,
    pairResults,
    firstFailureIndex,
    summary: `${pairResults.filter(r => r.success).length}/${pairs.length} pairs succeeded`
  };
}

/**
 * Execute a single stimulation/observation pair
 * 
 * @param {Object} pair - Stim/obs pair
 * @param {Object} simulator - Simulator instance
 * @returns {Promise<Object>} Pair result
 */
async function executePair(pair, simulator) {
  const { stimulation, observation } = pair;
  
  // 1. Get current marking
  const initialMarking = getCurrentMarking(simulator);
  
  // 2. Execute stimulation
  const stimResult = await executeStimulation(stimulation, simulator, initialMarking);
  
  if (!stimResult.success) {
    return {
      success: false,
      phase: 'stimulation',
      reason: stimResult.reason,
      transition: stimulation.transition
    };
  }
  
  // 3. Get new marking after stimulation
  const newMarking = getCurrentMarking(simulator);
  
  // 4. Check observation
  const obsResult = checkObservation(observation, newMarking);
  
  if (!obsResult.success) {
    return {
      success: false,
      phase: 'observation',
      reason: obsResult.reason,
      expected: obsResult.expected,
      actual: obsResult.actual,
      place: obsResult.place
    };
  }
  
  return {
    success: true,
    phase: 'complete',
    transition: stimulation.transition,
    tokensProduced: Object.keys(observation.outputs).length
  };
}

/**
 * Execute stimulation: fire transition with explicit inputs
 */
async function executeStimulation(stimulation, simulator, marking) {
  const { transition, inputs } = stimulation;
  
  // Check if transition is enabled
  const enabled = await simulator.getEnabledTransitions();
  if (!enabled.includes(transition)) {
    return {
      success: false,
      reason: 'transition_not_enabled',
      transition
    };
  }
  
  try {
    // Prepare explicit binding from inputs
    // For now, fire transition normally (explicit binding already implemented in Phase 1)
    await simulator.fireTransition(transition);
    
    return { success: true };
  } catch (err) {
    return {
      success: false,
      reason: 'firing_failed',
      error: err.message
    };
  }
}

/**
 * Check observation: verify output tokens and markings
 */
function checkObservation(observation, marking) {
  const { outputs, markings } = observation;
  
  // 1. Check output tokens
  for (const [place, expectedTokens] of Object.entries(outputs)) {
    const actualTokens = marking[place] || [];
    
    if (!tokensMatch(actualTokens, expectedTokens)) {
      return {
        success: false,
        reason: 'output_mismatch',
        place,
        expected: expectedTokens,
        actual: actualTokens
      };
    }
  }
  
  // 2. Check markings (optional)
  if (markings) {
    for (const [place, constraint] of Object.entries(markings)) {
      const tokens = marking[place] || [];
      
      if (!checkMarkingConstraint(tokens, constraint)) {
        return {
          success: false,
          reason: 'marking_constraint_failed',
          place,
          constraint,
          actual: tokens
        };
      }
    }
  }
  
  return { success: true };
}

/**
 * Check if actual tokens match expected tokens (deep equality)
 */
function tokensMatch(actual, expected) {
  if (actual.length !== expected.length) {
    return false;
  }
  
  // Deep equality check
  return JSON.stringify(sortTokens(actual)) === JSON.stringify(sortTokens(expected));
}

/**
 * Sort tokens for consistent comparison
 */
function sortTokens(tokens) {
  return tokens.slice().sort((a, b) => {
    const aStr = JSON.stringify(a);
    const bStr = JSON.stringify(b);
    return aStr.localeCompare(bStr);
  });
}

/**
 * Check if marking satisfies constraint
 */
function checkMarkingConstraint(tokens, constraint) {
  if (constraint.length !== undefined) {
    return tokens.length === constraint.length;
  }
  
  if (constraint.empty !== undefined) {
    return constraint.empty ? tokens.length === 0 : tokens.length > 0;
  }
  
  if (constraint.contains !== undefined) {
    // Check if marking contains specified tokens
    return constraint.contains.every(expected =>
      tokens.some(actual => JSON.stringify(actual) === JSON.stringify(expected))
    );
  }
  
  return true;
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

/**
 * Execute multiple V2 test cases
 * 
 * @param {Array} testCases - Array of V2 test cases
 * @param {Object} petriNet - Petri net
 * @param {Object} simulator - Simulator instance
 * @param {Object} [options] - Execution options
 * @returns {Promise<Array>} Array of test results
 */
export async function executeV2TestCases(testCases, petriNet, simulator, options = {}) {
  const results = [];
  
  for (let i = 0; i < testCases.length; i++) {
    // Check for cancellation
    if (options.signal?.aborted) {
      throw new Error('Execution cancelled');
    }
    
    // Progress callback
    if (options.onProgress) {
      options.onProgress({
        current: i + 1,
        total: testCases.length,
        testCase: testCases[i].id
      });
    }
    
    const result = await executeV2TestCase(testCases[i], petriNet, simulator);
    results.push(result);
    
    // Yield to keep UI responsive
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return results;
}
