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
  
  // 2. Check if this is a 'notEnabled' observation (expects transition NOT to fire)
  if (observation.type === 'notEnabled') {
    const stimResult = await checkNotEnabled(stimulation, simulator);
    
    if (stimResult.success) {
      // Transition is correctly not enabled - observation passes
      return {
        success: true,
        phase: 'complete',
        observationType: 'notEnabled',
        transition: stimulation.transition,
        reason: stimResult.reason
      };
    } else {
      // Transition fired when it should not have
      return {
        success: false,
        phase: 'observation',
        reason: 'transition_fired_unexpectedly',
        transition: stimulation.transition
      };
    }
  }
  
  // 3. Execute stimulation
  const stimResult = await executeStimulation(stimulation, simulator, initialMarking);
  
  if (!stimResult.success) {
    return {
      success: false,
      phase: 'stimulation',
      reason: stimResult.reason,
      transition: stimulation.transition
    };
  }
  
  // 4. Get new marking and produced tokens after stimulation
  const newMarking = getCurrentMarking(simulator);
  const producedTokens = stimResult.producedTokens || {};
  
  // 5. Check observation
  const obsResult = checkObservation(observation, newMarking, producedTokens);
  
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
    producedTokens,
    tokensProduced: Object.keys(producedTokens).length
  };
}

/**
 * Check if transition is NOT enabled (for notEnabled observations)
 */
async function checkNotEnabled(stimulation, simulator) {
  const { transition, inputs } = stimulation;
  
  try {
    // 1. Inject input tokens into places
    for (const [placeId, tokens] of Object.entries(inputs)) {
      const place = simulator.petriNet.places.find(p => p.id === placeId);
      if (place) {
        place.valueTokens = tokens.map(token => {
          if (typeof token === 'object' && token !== null) {
            return token;
          }
          return { value: token };
        });
        place.tokens = place.valueTokens.length;
      }
    }
    
    // 2. Invalidate cache
    if (typeof simulator.invalidateEnabledCache === 'function') {
      simulator.invalidateEnabledCache();
    }
    
    // 3. Check if transition is enabled
    const enabled = await simulator.getEnabledTransitions();
    
    if (!enabled.includes(transition)) {
      // Transition is NOT enabled - this is what we expect
      return {
        success: true,
        reason: 'transition_correctly_not_enabled',
        enabledTransitions: enabled
      };
    } else {
      // Transition IS enabled - this violates the notEnabled observation
      return {
        success: false,
        reason: 'transition_unexpectedly_enabled'
      };
    }
  } catch (err) {
    return {
      success: false,
      reason: 'check_failed',
      error: err.message
    };
  }
}

/**
 * Execute stimulation: inject input tokens and fire transition
 */
async function executeStimulation(stimulation, simulator, marking) {
  const { transition, inputs } = stimulation;
  
  try {
    // 1. Inject input tokens into places (if any specified)
    if (inputs && Object.keys(inputs).length > 0) {
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
      
      // Invalidate enabled transition cache after injection
      if (typeof simulator.invalidateEnabledCache === 'function') {
        simulator.invalidateEnabledCache();
      }
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
    
    // 3. Capture output arcs to track produced tokens
    const outputArcs = simulator.petriNet.arcs.filter(
      a => (a.sourceId === transition || a.source === transition) && (a.targetType === 'place' || !a.targetType)
    );
    
    // 4. Get places before firing to compare after
    const placesBefore = {};
    for (const arc of outputArcs) {
      const placeId = arc.targetId || arc.target;
      const place = simulator.petriNet.places.find(p => p.id === placeId);
      if (place && Array.isArray(place.valueTokens)) {
        placesBefore[placeId] = place.valueTokens.length;
      }
    }
    
    // 5. Try to fire the transition
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
      
      // 6. Track produced tokens
      const producedTokens = {};
      for (const arc of outputArcs) {
        const placeId = arc.targetId || arc.target;
        const place = simulator.petriNet.places.find(p => p.id === placeId);
        if (place && Array.isArray(place.valueTokens)) {
          const beforeCount = placesBefore[placeId] || 0;
          const afterCount = place.valueTokens.length;
          if (afterCount > beforeCount) {
            // Get newly produced tokens
            producedTokens[placeId] = place.valueTokens.slice(beforeCount);
          }
        }
      }
      
      return { success: true, producedTokens };
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
function checkObservation(observation, marking, producedTokens = {}) {
  const { outputs, markings } = observation;
  
  // 1. Check output tokens (use produced tokens from this firing, not marking)
  for (const [place, expectedTokens] of Object.entries(outputs)) {
    // Use actually produced tokens if available, otherwise fall back to marking
    const actualTokens = producedTokens[place] || marking[place] || [];
    
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
