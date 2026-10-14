/**
 * I/O Interface Manager
 * Manages stimulation and observation marking for places and transitions
 */

/**
 * Mark a place or transition as input, output, or internal
 * @param {Object} element - Place or transition object
 * @param {'input' | 'output' | 'internal'} ioType - I/O type
 * @param {string} [description] - Optional description
 * @returns {Object} Updated element
 */
export function markIOType(element, ioType, description = '') {
  return {
    ...element,
    io_type: ioType,
    io_description: description
  };
}

/**
 * Get the I/O type of an element
 * @param {Object} element - Place or transition
 * @returns {'input' | 'output' | 'internal'}
 */
export function getIOType(element) {
  return element.io_type || 'internal';
}

/**
 * Check if element is an input
 * @param {Object} element - Place or transition
 * @returns {boolean}
 */
export function isInput(element) {
  return getIOType(element) === 'input';
}

/**
 * Check if element is an output
 * @param {Object} element - Place or transition
 * @returns {boolean}
 */
export function isOutput(element) {
  return getIOType(element) === 'output';
}

/**
 * Get all input places from a Petri net
 * @param {Object} petriNet - Petri net object
 * @returns {Array} Input places
 */
export function getInputPlaces(petriNet) {
  return (petriNet.places || []).filter(isInput);
}

/**
 * Get all output places from a Petri net
 * @param {Object} petriNet - Petri net object
 * @returns {Array} Output places
 */
export function getOutputPlaces(petriNet) {
  return (petriNet.places || []).filter(isOutput);
}

/**
 * Get all input transitions from a Petri net
 * @param {Object} petriNet - Petri net object
 * @returns {Array} Input transitions
 */
export function getInputTransitions(petriNet) {
  return (petriNet.transitions || []).filter(isInput);
}

/**
 * Get all output transitions from a Petri net
 * @param {Object} petriNet - Petri net object
 * @returns {Array} Output transitions
 */
export function getOutputTransitions(petriNet) {
  return (petriNet.transitions || []).filter(isOutput);
}

/**
 * Extract the interface (inputs/outputs) of a Petri net
 * @param {Object} petriNet - Petri net object
 * @returns {Object} Interface specification
 */
export function extractInterface(petriNet) {
  return {
    inputPlaces: getInputPlaces(petriNet),
    outputPlaces: getOutputPlaces(petriNet),
    inputTransitions: getInputTransitions(petriNet),
    outputTransitions: getOutputTransitions(petriNet)
  };
}

/**
 * Validate that a net has a proper I/O interface
 * @param {Object} petriNet - Petri net object
 * @returns {Object} Validation result
 */
export function validateInterface(petriNet) {
  const errors = [];
  const warnings = [];
  
  const inputPlaces = getInputPlaces(petriNet);
  const outputPlaces = getOutputPlaces(petriNet);
  const inputTransitions = getInputTransitions(petriNet);
  const outputTransitions = getOutputTransitions(petriNet);
  
  // Check that there is at least one input or output
  if (inputPlaces.length === 0 && inputTransitions.length === 0) {
    warnings.push('No input places or transitions defined. Reactive system needs inputs (stimulations).');
  }
  
  if (outputPlaces.length === 0 && outputTransitions.length === 0) {
    warnings.push('No output places or transitions defined. Reactive system needs outputs (observations).');
  }
  
  // Check for naming conflicts
  const allNames = [
    ...inputPlaces.map(p => p.label),
    ...outputPlaces.map(p => p.label),
    ...inputTransitions.map(t => t.label),
    ...outputTransitions.map(t => t.label)
  ];
  const uniqueNames = new Set(allNames.filter(n => n));
  if (uniqueNames.size < allNames.filter(n => n).length) {
    warnings.push('Duplicate labels found in I/O interface. Consider unique names for clarity.');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Create a stimulation (input) for testing
 * @param {string} placeOrTransitionId - Element ID
 * @param {*} value - Input value/token
 * @returns {Object} Stimulation object
 */
export function createStimulation(placeOrTransitionId, value) {
  return {
    elementId: placeOrTransitionId,
    value,
    timestamp: Date.now()
  };
}

/**
 * Create an observation specification
 * @param {string} placeOrTransitionId - Element ID
 * @param {*} expectedValue - Expected value/token
 * @returns {Object} Observation specification
 */
export function createObservation(placeOrTransitionId, expectedValue) {
  return {
    elementId: placeOrTransitionId,
    expectedValue
  };
}
