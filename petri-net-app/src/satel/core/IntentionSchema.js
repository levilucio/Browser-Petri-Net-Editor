/**
 * SATEL Intention Schema V2
 * 
 * New schema based on stimulation/observation pairs with typed variables.
 * Replaces the old PathEvent + outputExpectations format.
 */

/**
 * Intention Schema V2
 * 
 * @typedef {Object} IntentionV2
 * @property {string} id - Unique intention ID
 * @property {string} name - Human-readable name
 * @property {'positive'|'negative'} testType - Test type (positive: all pairs succeed, negative: at least one fails)
 * @property {Variable[]} variables - Typed variables with hypotheses
 * @property {StimObsPair[]} pairs - Sequence of stimulation/observation pairs
 * @property {string[]} [includes] - Included intention IDs
 * @property {string} [description] - Optional description
 */

/**
 * Variable Declaration
 * 
 * @typedef {Object} Variable
 * @property {string} name - Variable name (e.g., 'order', 'material')
 * @property {string} sort - ADT sort (e.g., 'Order', 'Material', 'Nat')
 * @property {Hypothesis} hypothesis - Generation hypothesis
 * @property {string} [description] - Optional description
 */

/**
 * Hypothesis for variable instantiation
 * 
 * @typedef {UniformityHypothesis | SubuniformityHypothesis | RegularityHypothesis} Hypothesis
 */

/**
 * @typedef {Object} UniformityHypothesis
 * @property {'uniformity'} type
 * @property {*} representative - Single ground term
 */

/**
 * @typedef {Object} SubuniformityHypothesis
 * @property {'subuniformity'} type
 * @property {'constructors'|'guards'|'axiom'} source - Partition source
 * @property {string} [axiom] - Axiom name if source is 'axiom'
 */

/**
 * @typedef {Object} RegularityHypothesis
 * @property {'regularity'} type
 * @property {Object} bounds - Bounds
 * @property {number} bounds.depth - Max term depth
 * @property {number} bounds.nbEvents - Max event count
 */

/**
 * Stimulation/Observation Pair
 * 
 * @typedef {Object} StimObsPair
 * @property {Stimulation} stimulation - Input to fire
 * @property {Observation} observation - Expected output
 */

/**
 * Stimulation: fire transition with input tokens
 * 
 * @typedef {Object} Stimulation
 * @property {string} transition - Transition ID
 * @property {Object.<string, Array>} inputs - Input tokens per place (terms over variables)
 */

/**
 * Observation: expected output tokens + optional marking checks
 * 
 * @typedef {Object} Observation
 * @property {Object.<string, Array>} outputs - Expected tokens on output places
 * @property {Object.<string, MarkingConstraint>} [markings] - Optional marking checks
 */

/**
 * Marking Constraint
 * 
 * @typedef {Object} MarkingConstraint
 * @property {number} [length] - Expected token count
 * @property {boolean} [empty] - Place must be empty
 * @property {Array} [contains] - Place must contain these tokens
 */

/**
 * Validate intention schema
 */
export function validateIntention(intention) {
  if (!intention || 'pathPattern' in intention || !Array.isArray(intention.variables) || !Array.isArray(intention.pairs)) {
    throw new Error('Only intentions with variables and stimulation/observation pairs are supported');
  }
  if (!intention.id || typeof intention.id !== 'string') {
    throw new Error('Intention must have string id');
  }
  
  if (!intention.name || typeof intention.name !== 'string') {
    throw new Error('Intention must have string name');
  }
  
  if (intention.testType !== 'positive' && intention.testType !== 'negative') {
    throw new Error('testType must be "positive" or "negative"');
  }
  
  if (!Array.isArray(intention.variables)) {
    throw new Error('variables must be an array');
  }
  
  for (const v of intention.variables) {
    validateVariable(v);
  }
  
  if (!Array.isArray(intention.pairs) || intention.pairs.length === 0) {
    throw new Error('pairs must be non-empty array');
  }
  
  if (intention.initialMarking !== undefined && (!intention.initialMarking || typeof intention.initialMarking !== 'object' || Array.isArray(intention.initialMarking) || !Object.values(intention.initialMarking).every(Array.isArray))) {
    throw new Error('Initial marking must map place IDs to token arrays');
  }
  for (const pair of intention.pairs) {
    validatePair(pair);
  }
  
  return true;
}

function validateVariable(v) {
  if (!v.name || typeof v.name !== 'string') {
    throw new Error('Variable must have string name');
  }
  
  if (!v.sort || typeof v.sort !== 'string') {
    throw new Error('Variable must have string sort');
  }
  
  if (!v.hypothesis || typeof v.hypothesis !== 'object') {
    throw new Error('Variable must have hypothesis');
  }
  
  const validTypes = ['uniformity', 'subuniformity', 'regularity'];
  if (!validTypes.includes(v.hypothesis.type)) {
    throw new Error(`Hypothesis type must be one of: ${validTypes.join(', ')}`);
  }
}

function validatePair(pair) {
  if (!pair.stimulation || typeof pair.stimulation !== 'object') {
    throw new Error('Pair must have stimulation');
  }
  
  if (!pair.stimulation.transition || typeof pair.stimulation.transition !== 'string') {
    throw new Error('Stimulation must have transition ID');
  }
  
  if (!pair.stimulation.inputs || typeof pair.stimulation.inputs !== 'object') {
    throw new Error('Stimulation must have inputs object');
  }
  
  if (!pair.observation || typeof pair.observation !== 'object') {
    throw new Error('Pair must have observation');
  }
  
  if (!pair.observation.outputs || typeof pair.observation.outputs !== 'object') {
    throw new Error('Observation must have outputs object');
  }
}
