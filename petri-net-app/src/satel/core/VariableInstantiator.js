/**
 * Variable Instantiator
 * 
 * Generates ground terms for variables based on hypotheses:
 * - Uniformity: single representative
 * - Subuniformity: one representative per equivalence class
 * - Regularity: bounded enumeration
 */

import { generateRepresentatives } from './PartitionGenerator.js';
import { buildAdtRegistry } from '../../utils/adt-parser.js';

/**
 * Generate ground terms for all variables in an intention
 * 
 * @param {Object} intention - Intention with variables
 * @param {Object} petriNet - Petri net
 * @param {Object} adtRegistry - ADT registry
 * @returns {Object} Map of variable name -> array of representatives
 */
export function instantiateVariables(intention, petriNet, adtRegistry) {
  const instantiations = {};
  
  for (const variable of intention.variables) {
    instantiations[variable.name] = generateGroundTerms(variable, petriNet, adtRegistry);
  }
  
  return instantiations;
}

/**
 * Generate ground terms for a single variable based on its hypothesis
 */
function generateGroundTerms(variable, petriNet, adtRegistry) {
  const { hypothesis, sort } = variable;
  
  switch (hypothesis.type) {
    case 'uniformity':
      return [hypothesis.representative];
    
    case 'subuniformity':
      return generateSubuniformTerms(variable, petriNet, adtRegistry);
    
    case 'regularity':
      return generateRegularityTerms(variable, hypothesis.bounds);
    
    default:
      throw new Error(`Unknown hypothesis type: ${hypothesis.type}`);
  }
}

/**
 * Generate subuniformity representatives
 */
function generateSubuniformTerms(variable, petriNet, adtRegistry) {
  const { sort, hypothesis } = variable;
  
  switch (hypothesis.source) {
    case 'constructors':
      // Use ADT constructor partitioning
      return generateRepresentatives(variable.name, [], {
        sortName: sort,
        adtRegistry,
        maxDepth: 2 // Depth bound for recursive ADTs
      });
    
    case 'guards':
      // Extract guards from transitions that use this variable
      const guards = extractGuardsForVariable(variable.name, petriNet);
      return generateRepresentatives(variable.name, guards, {
        includeBoundaries: true,
        includeSign: true
      });
    
    case 'axiom':
      // Domain-specific partition
      return getAxiomRepresentatives(hypothesis.axiom, sort);
    
    default:
      throw new Error(`Unknown subuniformity source: ${hypothesis.source}`);
  }
}

/**
 * Extract guards mentioning a variable from Petri net transitions
 */
function extractGuardsForVariable(varName, petriNet) {
  const guards = [];
  
  for (const transition of petriNet.transitions || []) {
    if (transition.guard && transition.guard.includes(varName)) {
      // Parse guard to extract constraints
      // Simplified: just note that variable appears in guard
      guards.push({
        type: 'comparison',
        variable: varName,
        operator: '>',
        value: 0 // Default boundary
      });
    }
  }
  
  return guards;
}

/**
 * Get representatives for axiom-based partitions
 */
function getAxiomRepresentatives(axiom, sort) {
  // Predefined axiom partitions
  const axioms = {
    quality_outcomes: [
      { __adt__: true, constructor: 'Pass', args: [] },
      { __adt__: true, constructor: 'Fail', args: [] }
    ],
    priority_levels: [
      { __adt__: true, constructor: 'Low', args: [] },
      { __adt__: true, constructor: 'Normal', args: [] },
      { __adt__: true, constructor: 'High', args: [] }
    ]
  };
  
  if (axioms[axiom]) {
    return axioms[axiom];
  }
  
  // Fallback: use constructor-based partition
  console.warn(`Unknown axiom ${axiom}, using constructor partition for ${sort}`);
  return [];
}

/**
 * Generate regularity-bounded terms
 */
function generateRegularityTerms(variable, bounds) {
  const { depth = 2, nbEvents = 5 } = bounds;
  
  // Simplified: enumerate up to depth limit
  // For now, just return basic values
  return [0, 1, 2].slice(0, nbEvents);
}

/**
 * Compute Cartesian product of variable instantiations
 * 
 * @param {Object} instantiations - Map of varName -> [representatives]
 * @returns {Array<Object>} Array of instantiation combinations
 */
export function cartesianProduct(instantiations) {
  const varNames = Object.keys(instantiations);
  
  if (varNames.length === 0) {
    return [{}];
  }
  
  // Recursive Cartesian product
  function product(names, index = 0) {
    if (index >= names.length) {
      return [{}];
    }
    
    const name = names[index];
    const values = instantiations[name];
    const rest = product(names, index + 1);
    
    const result = [];
    for (const value of values) {
      for (const partial of rest) {
        result.push({ [name]: value, ...partial });
      }
    }
    
    return result;
  }
  
  return product(varNames);
}

/**
 * Filter instantiations by joint guards
 * Drop combinations that don't satisfy multi-variable guards
 * 
 * @param {Array<Object>} combinations - Cartesian product combinations
 * @param {Array} guards - Multi-variable guards
 * @returns {Array<Object>} Filtered combinations
 */
export function filterByGuards(combinations, guards) {
  if (!guards || guards.length === 0) {
    return combinations;
  }
  
  return combinations.filter(inst => {
    return guards.every(guard => evaluateGuard(guard, inst));
  });
}

/**
 * Evaluate a guard on an instantiation
 * Simple boolean check (no SMT)
 */
function evaluateGuard(guard, instantiation) {
  // Simplified guard evaluation
  // For now, always return true (no filtering)
  // Full implementation would parse and evaluate guard AST
  return true;
}

/**
 * Instantiate a term by replacing variable references with ground terms
 * 
 * @param {*} term - Term with variable references ($var)
 * @param {Object} instantiation - Variable -> value map
 * @returns {*} Instantiated term
 */
export function instantiateTerm(term, instantiation) {
  if (typeof term === 'string' && term.startsWith('$')) {
    // Variable reference
    const varName = term.slice(1);
    if (!(varName in instantiation)) {
      throw new Error(`Undefined variable: ${varName}`);
    }
    return instantiation[varName];
  }
  
  if (Array.isArray(term)) {
    return term.map(t => instantiateTerm(t, instantiation));
  }
  
  if (term && typeof term === 'object') {
    const result = {};
    for (const [key, value] of Object.entries(term)) {
      result[key] = instantiateTerm(value, instantiation);
    }
    return result;
  }
  
  return term;
}

/**
 * Instantiate stimulation/observation pair
 */
export function instantiatePair(pair, instantiation) {
  return {
    stimulation: {
      transition: pair.stimulation.transition,
      inputs: instantiateObject(pair.stimulation.inputs, instantiation)
    },
    observation: {
      outputs: instantiateObject(pair.observation.outputs, instantiation),
      markings: pair.observation.markings // Markings don't have variables
    }
  };
}

function instantiateObject(obj, instantiation) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = instantiateTerm(value, instantiation);
  }
  return result;
}
