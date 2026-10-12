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
  let hasError = false;
  let hasObservationFailure = false;
  
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i];
    
    try {
      const result = await executePair(pair, simulator);
      pairResults.push(result);
      
      if (!result.success) {
        // Check if this is an observation failure (meaningful for negative tests)
        if (result.phase === 'observation') {
          hasObservationFailure = true;
        }
        
        // Check if this is an error (transition_not_enabled_after_injection, firing_failed)
        if (result.reason === 'transition_not_found' || 
            result.reason === 'firing_failed' ||
            result.reason === 'transition_not_enabled_after_injection') {
          hasError = true;
        }
        
        overallSuccess = false;
        if (firstFailureIndex === -1) {
          firstFailureIndex = i;
        }
        
        // For negative tests, stop on first observation failure (expected)
        if (testType === 'negative' && result.phase === 'observation') {
          break;
        }
      }
    } catch (err) {
      hasError = true;
      pairResults.push({
        success: false,
        phase: 'error',
        error: err.message,
        pairIndex: i
      });
      overallSuccess = false;
      if (firstFailureIndex === -1) {
        firstFailureIndex = i;
      }
      
      // For negative tests, exceptions are NOT expected successes - they're errors
      // Continue to report the error
    }
  }
  
  // Determine verdict based on test type
  let verdict;
  if (hasError) {
    // Errors are always 'error' verdict, never pass
    verdict = 'error';
  } else if (testType === 'positive') {
    // All pairs must succeed
    verdict = overallSuccess ? 'pass' : 'fail';
  } else {
    // Negative test: at least one pair must fail at observation
    verdict = hasObservationFailure ? 'pass' : 'fail';
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
 * Execute stimulation: inject input tokens and fire transition
 */
async function executeStimulation(stimulation, simulator, marking) {
  const { transition, inputs } = stimulation;
  
  try {
    // 1. Inject input tokens into places
    for (const [placeId, tokens] of Object.entries(inputs)) {
      const place = simulator.petriNet.places.find(p => p.id === placeId);
      if (place) {
        // Set tokens - ensure proper format
        place.valueTokens = tokens.map(token => {
          // If already an object with value or ADT structure, use as-is
          if (typeof token === 'object' && token !== null) {
            return token;
          }
          // Primitive: wrap in value object
          return { value: token };
        });
        // Update token count
        place.tokens = place.valueTokens.length;
      }
    }
    
    // 1b. Clear enabled transition cache if it exists (algebraic simulator)
    if (simulator._enabledCache) {
      simulator._enabledCache.clear();
    }
    
    // 2. Check transition exists
    const transitionDef = simulator.petriNet.transitions.find(t => t.id === transition);
    if (!transitionDef) {
      return {
        success: false,
        reason: 'transition_not_found',
        transition
      };
    }
    
    // 3. Try to fire the transition
    // The simulator will handle binding internally
    try {
      // Check if enabled first
      const enabled = await simulator.getEnabledTransitions();
      
      if (!enabled.includes(transition)) {
        // Not enabled - this could be due to guards or missing tokens
        return {
          success: false,
          reason: 'transition_not_enabled_after_injection',
          transition,
          enabledTransitions: enabled
        };
      }
      
      // Fire the transition
      await simulator.fireTransition(transition);
      
      return { success: true };
    } catch (fireErr) {
      return {
        success: false,
        reason: 'firing_failed',
        error: fireErr.message
      };
    }
  } catch (err) {
    return {
      success: false,
      reason: 'stimulation_setup_failed',
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
