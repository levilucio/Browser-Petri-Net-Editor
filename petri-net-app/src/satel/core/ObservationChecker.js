import { equalTokenBags } from '../../utils/builtin-values.js';
import { equalValues } from '../../utils/value-equality.js';
/** Continuous execution from a single initial marking. */
import { isMethodRule } from '../../features/simulation/PublicMethods.js';
import { withInitialMarking, initialMarkingOf } from './InitialMarking.js';

const copy = value => JSON.parse(JSON.stringify(value));
const unwrap = token => token && typeof token === 'object' && Object.keys(token).length === 1 && 'value' in token ? token.value : token;

function inputSelector(stimulation, simulator) {
  const rule = simulator.petriNet.transitions.find(t => t.id === stimulation.transition);
  if (!rule) throw new Error('transition_not_found');
  if (isMethodRule(rule)) throw new Error('Public method rules must be invoked through their method');
  const inputs = stimulation.inputs || {};
  for (const [id, tokens] of Object.entries(inputs)) {
    if (!simulator.petriNet.places.some(p => p.id === id)) throw new Error(`place_not_found: ${id}`);
    if (!Array.isArray(tokens)) throw new Error(`Invalid input token multiset: ${id}`);
    if (!simulator.petriNet.arcs.some(a => (a.sourceId || a.source) === id && (a.targetId || a.target) === stimulation.transition)) {
      throw new Error(`Input place ${id} is not consumed by ${stimulation.transition}`);
    }
  }
  return ({ picks }) => Object.entries(inputs).every(([id, tokens]) =>
    tokensMatch(picks.filter(p => p.srcId === id).map(p => unwrap(p.value)), tokens.map(unwrap)));
}

export async function executeV2TestCase(testCase, petriNet, simulator) {
  const usesMethods = testCase.pairs.some(p => p.stimulation.method);
  if (usesMethods && (testCase.initialMarking !== undefined || testCase.pairs.some(p => !p.stimulation.method))) throw new Error('Method tests cannot override initial marking or mix direct transition steps');
  if (usesMethods && petriNet.transitions.some(t => !isMethodRule(t))) throw new Error('Internal exploration is unsupported in the method oracle');
  const net = usesMethods ? copy(petriNet) : withInitialMarking(petriNet, testCase.initialMarking);
  await simulator.initialize(net);
  const pairResults = [];
  const markings = [initialMarkingOf(net)];
  let failed = false, error = false;
  try {
    for (const pair of testCase.pairs) {
      try {
        if (typeof simulator.isTransitionEnabled !== 'function' || typeof simulator.fireTransitionSpecific !== 'function') {
          throw new Error('SATEL requires the algebraic simulator with firing-effect support');
        }
        const { stimulation, observation } = pair;
        let result;
        if (stimulation.method) {
          const enabled = simulator.checkMethod(stimulation.method, stimulation.arguments);
          if (observation.type === 'notEnabled') {
            result = { success: !enabled, phase: enabled ? 'observation' : 'complete', reason: enabled ? 'method_unexpectedly_enabled' : 'method_correctly_blocked' };
          } else if (!enabled) result = { success: false, phase: 'observation', reason: 'method_blocked' };
          else {
            const call = await simulator.invokeMethod(stimulation.method, stimulation.arguments);
            const checked = checkObservation(observation, initialMarkingOf(call.state), call.produced);
            result = { ...checked, phase: checked.success ? 'complete' : 'observation', method: stimulation.method, producedTokens: call.produced };
          }
        } else {
        const acceptAssignment = inputSelector(stimulation, simulator);
        const enabled = await simulator.isTransitionEnabled(stimulation.transition, acceptAssignment);
        if (observation.type === 'notEnabled') {
          result = { success: !enabled, phase: enabled ? 'observation' : 'complete',
            reason: enabled ? 'transition_unexpectedly_enabled' : 'transition_correctly_not_enabled' };
        } else if (!enabled) {
          result = { success: false, phase: 'observation', reason: 'transition_not_enabled', transition: stimulation.transition };
        } else {
          await simulator.fireTransitionSpecific(stimulation.transition, { acceptAssignment });
          const firing = simulator.lastFiring;
          if (!firing || firing.transitionId !== stimulation.transition) throw new Error('Missing firing evidence');
          const producedTokens = copy(firing.produced);
          const marking = initialMarkingOf(simulator.getCurrentState());
          const checked = checkObservation(observation, marking, producedTokens);
          result = { ...checked, phase: checked.success ? 'complete' : 'observation',
            transition: stimulation.transition, producedTokens, consumedTokens: copy(firing.consumed) };
        }
        }
        result.marking = initialMarkingOf(simulator.getCurrentState());
        pairResults.push(result);
        markings.push(result.marking);
        if (!result.success) { failed = true; break; }
      } catch (e) {
        error = true;
        pairResults.push({ success: false, phase: 'error', error: e.message });
        break;
      }
    }
    return { testCaseId: testCase.id, testType: testCase.testType,
      verdict: error ? 'error' : (testCase.testType === 'negative' ? failed : !failed) ? 'pass' : 'fail',
      pairResults, markings, firstFailureIndex: pairResults.findIndex(r => !r.success),
      summary: `${pairResults.filter(r => r.success).length}/${testCase.pairs.length} pairs succeeded` };
  } finally {
    simulator.reset();
  }
}

function checkObservation(observation, marking, producedTokens = {}) {
  const { outputs, markings } = observation;
  for (const place of [...Object.keys(outputs || {}), ...Object.keys(markings || {})]) {
    if (!Object.hasOwn(marking, place)) throw new Error(`Unknown observation place: ${place}`);
  }
  
  // 1. Check output tokens (use produced tokens from this firing, not marking)
  for (const [place, expectedTokens] of Object.entries(outputs || {})) {
    // Only this firing's production is observable; old tokens are not new events.
    const actualTokens = producedTokens[place] || [];
    
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
const tokensMatch = equalTokenBags;

/**
 * Check if marking satisfies constraint
 */
function checkMarkingConstraint(tokens, constraint) {
  if (constraint.equals !== undefined) return tokensMatch(tokens, constraint.equals);
  if (constraint.length !== undefined) {
    return tokens.length === constraint.length;
  }
  
  if (constraint.empty !== undefined) {
    return constraint.empty ? tokens.length === 0 : tokens.length > 0;
  }
  
  if (constraint.contains !== undefined) {
    // Check if marking contains specified tokens
    return constraint.contains.every(expected =>
      tokens.some(actual => equalValues(actual, expected))
    );
  }
  
  return true;
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
