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
import { partitionByPathConditions } from './PathConditionPartitioner.js';

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
    instantiations[variable.name] = generateGroundTerms(variable, intention, petriNet, adtRegistry);
  }
  
  return instantiations;
}

/**
 * Generate ground terms for a single variable based on its hypothesis
 */
function generateGroundTerms(variable, intention, petriNet, adtRegistry) {
  const { hypothesis, sort } = variable;
  
  switch (hypothesis.type) {
    case 'uniformity':
      // If representative provided, use it; otherwise generate from sort
      if (hypothesis.representative !== undefined) {
        return [hypothesis.representative];
      }
      return [generateArbitraryGroundTerm(sort, adtRegistry)];
    
    case 'subuniformity':
      return generateSubuniformTerms(variable, intention, petriNet, adtRegistry);
    
    case 'regularity':
      return generateRegularityTerms(variable, petriNet, adtRegistry, hypothesis.bounds);
    
    default:
      throw new Error(`Unknown hypothesis type: ${hypothesis.type}`);
  }
}

/**
 * Generate an arbitrary ground term from a sort/ADT
 */
function generateArbitraryGroundTerm(sort, adtRegistry) {
  // Primitive types
  if (sort === 'Int' || sort === 'Nat') return 0;
  if (sort === 'Bool') return false;
  if (sort === 'String') return '';
  
  // ADT type - use first nullary constructor or minimal constructor
  if (adtRegistry) {
    const adt = adtRegistry.getType(sort);
    if (adt && adt.constructors) {
      // Prefer nullary constructor
      const nullary = adt.constructors.find(c => c.arity === 0);
      if (nullary) {
        return { __adt__: true, constructor: nullary.name, args: [] };
      }
      
      // Otherwise use first constructor with recursively generated args
      const firstCtor = adt.constructors[0];
      const args = firstCtor.params?.map(p => generateArbitraryGroundTerm(p.type, adtRegistry)) || [];
      return { __adt__: true, constructor: firstCtor.name, args };
    }
  }
  
  // Fallback
  return 0;
}

/**
 * Generate subuniformity representatives
 */
function generateSubuniformTerms(variable, intention, petriNet, adtRegistry) {
  const { sort, hypothesis } = variable;
  
  switch (hypothesis.source) {
    case 'constructors':
      // Use ADT constructor partitioning
      return generateRepresentatives(variable.name, [], {
        sortName: sort,
        adtRegistry,
        maxDepth: 2 // Depth bound for recursive ADTs
      });
    
    case 'path-conditions':
      // NEW: Path-condition-based subuniformity
      // Partition by conjunction of guards along execution paths
      return partitionByPathConditions(variable, intention, petriNet, adtRegistry);
    
    case 'guards':
      // Legacy guard-based subuniformity (kept for backward compatibility)
      // For ADT types, fall back to constructor partitioning
      if (adtRegistry) {
        const adt = adtRegistry.getType(sort);
        if (adt && adt.constructors) {
          // ADT type - guards likely check constructors or projections
          // Use constructor partitioning as it's sort-correct
          return generateRepresentatives(variable.name, [], {
            sortName: sort,
            adtRegistry,
            maxDepth: 2
          });
        }
      }
      
      // For numeric types, extract boundary values from guards
      const guardStrings = extractGuardsForVariable(variable.name, petriNet);
      const boundaries = extractBoundariesFromGuards(guardStrings, variable.name);
      
      if (boundaries.length > 0) {
        return boundaries;
      }
      
      // Fallback: use sign partition for unbounded
      return [-1, 0, 1];
    
    case 'axiom':
      // Domain-specific partition derived from ADT
      return getAxiomRepresentatives(hypothesis.axiom, sort, adtRegistry);
    
    default:
      throw new Error(`Unknown subuniformity source: ${hypothesis.source}`);
  }
}

/**
 * Extract guards mentioning a variable from Petri net transitions
 * Returns guard strings (not parsed structures)
 */
function extractGuardsForVariable(varName, petriNet) {
  const guards = [];
  
  for (const transition of petriNet.transitions || []) {
    if (transition.guard && transition.guard.includes(varName)) {
      guards.push(transition.guard);
    }
  }
  
  return guards;
}

/**
 * Extract boundary values from guard expressions
 * Simple regex-based extraction for numeric comparisons
 */
function extractBoundariesFromGuards(guardStrings, varName) {
  const boundaries = new Set();
  
  for (const guard of guardStrings) {
    // Match patterns like: varName >= 50, varName < 100, etc.
    const patterns = [
      new RegExp(`${varName}\\s*([<>]=?)\\s*(\\d+)`, 'g'),
      new RegExp(`(\\d+)\\s*([<>]=?)\\s*${varName}`, 'g')
    ];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(guard)) !== null) {
        const value = parseInt(match[2] || match[1], 10);
        if (!isNaN(value)) {
          // Add boundary and neighbors
          boundaries.add(value - 1);
          boundaries.add(value);
          boundaries.add(value + 1);
        }
      }
    }
  }
  
  return Array.from(boundaries).sort((a, b) => a - b);
}

/**
 * Extract all guards from petri net that mention any of the variables
 */
export function extractMultiVariableGuards(variables, petriNet) {
  const guards = [];
  const varNames = variables.map(v => v.name);
  
  for (const transition of petriNet.transitions || []) {
    if (transition.guard) {
      // Check if guard mentions any of our variables
      const mentionsVar = varNames.some(name => transition.guard.includes(name));
      if (mentionsVar) {
        guards.push(transition.guard);
      }
    }
  }
  
  return guards;
}

/**
 * Get representatives for axiom-based partitions
 * Derives from ADT definitions or errors clearly
 */
function getAxiomRepresentatives(axiom, sort, adtRegistry) {
  // Try to derive from ADT if available
  if (adtRegistry) {
    const adt = adtRegistry.getType(sort);
    if (adt && adt.constructors) {
      // Use all constructors as representatives
      return adt.constructors.map(ctor => {
        if (ctor.arity === 0) {
          return { __adt__: true, constructor: ctor.name, args: [] };
        }
        // For non-nullary, generate minimal args
        const args = ctor.params?.map(p => generateArbitraryGroundTerm(p.type, adtRegistry)) || [];
        return { __adt__: true, constructor: ctor.name, args };
      });
    }
  }
  
  // No ADT definition available - this is an error
  throw new Error(
    `Axiom partition '${axiom}' for sort '${sort}' cannot be derived: ` +
    `no ADT definition found. Either provide ADT definitions in the net or use a different hypothesis.`
  );
}

/**
 * Generate regularity-bounded terms via depth-bounded enumeration
 */
function generateRegularityTerms(variable, petriNet, adtRegistry, bounds) {
  const { depth = 2, nbEvents = 5 } = bounds || {};
  const { sort } = variable;
  
  // For primitive types, use boundary values
  if (sort === 'Int' || sort === 'Nat') {
    return [0, 1, -1, depth, -depth].slice(0, nbEvents);
  }
  
  if (sort === 'Bool') {
    return [true, false];
  }
  
  if (sort === 'String') {
    return ['', 'a', 'ab'].slice(0, nbEvents);
  }
  
  // For ADT types, enumerate terms up to depth bound
  if (adtRegistry) {
    const adt = adtRegistry.getType(sort);
    if (adt && adt.constructors) {
      return enumerateTermsToDepth(adt, adtRegistry, depth, nbEvents);
    }
  }
  
  // Fallback
  return [0];
}

/**
 * Enumerate distinct ADT terms up to a depth bound
 * Uses BFS to generate terms level by level, ensuring variety
 */
function enumerateTermsToDepth(adt, adtRegistry, maxDepth, maxCount) {
  const terms = [];
  const termsByDepth = new Map();  // depth -> [terms]
  
  // Initialize depth 0 with nullary constructors and base primitives
  termsByDepth.set(0, []);
  
  for (const ctor of adt.constructors) {
    if (ctor.arity === 0) {
      terms.push({ __adt__: true, constructor: ctor.name, args: [] });
      termsByDepth.get(0).push({ __adt__: true, constructor: ctor.name, args: [] });
      if (terms.length >= maxCount) return terms;
    }
  }
  
  // Build terms at each depth level
  for (let d = 1; d <= maxDepth && terms.length < maxCount; d++) {
    termsByDepth.set(d, []);
    
    for (const ctor of adt.constructors) {
      if (terms.length >= maxCount) break;
      if (ctor.arity === 0) continue;  // Already handled at depth 0
      
      // Generate all combinations of args from previous depths
      const argCombos = generateArgCombinations(ctor.params, d - 1, termsByDepth, adtRegistry);
      
      for (const args of argCombos) {
        if (terms.length >= maxCount) break;
        const term = { __adt__: true, constructor: ctor.name, args };
        terms.push(term);
        termsByDepth.get(d).push(term);
      }
    }
  }
  
  return terms.slice(0, maxCount);
}

/**
 * Generate arg combinations for a constructor at given max depth
 */
function generateArgCombinations(params, maxArgDepth, termsByDepth, adtRegistry) {
  if (!params || params.length === 0) return [[]];
  
  // For each parameter, get available terms up to maxArgDepth
  const argChoices = params.map(param => {
    const paramType = param.type;
    
    // Collect terms for this parameter type from all depths <= maxArgDepth
    const choices = [];
    for (let d = 0; d <= maxArgDepth; d++) {
      const termsAtD = termsByDepth.get(d) || [];
      for (const t of termsAtD) {
        // Check if term matches parameter type (simplified - just check constructor sort)
        if (paramType === 'Nat' || paramType === 'Int') {
          choices.push(d);  // Use depth as a primitive value
        } else if (paramType === 'Bool') {
          choices.push(d % 2 === 0);
        } else if (t && t.constructor) {
          // For ADT types, include if constructor name matches or is compatible
          choices.push(t);
        }
      }
    }
    
    // If no choices, generate a minimal term
    if (choices.length === 0) {
      choices.push(generateArbitraryGroundTerm(paramType, adtRegistry));
    }
    
    // Limit choices to avoid explosion
    return choices.slice(0, 3);
  });
  
  // Generate Cartesian product of arg choices (limited)
  function product(arrays, index = 0) {
    if (index >= arrays.length) return [[]];
    const rest = product(arrays, index + 1);
    const result = [];
    for (const val of arrays[index].slice(0, 2)) {  // Limit to 2 per param
      for (const partial of rest.slice(0, 2)) {
        result.push([val, ...partial]);
        if (result.length >= 4) return result;  // Limit combinations
      }
    }
    return result;
  }
  
  return product(argChoices);
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
 * Filter instantiations by joint guards using algebraic evaluator
 * Drop combinations that don't satisfy multi-variable guards
 * 
 * @param {Array<Object>} combinations - Cartesian product combinations
 * @param {Array} guards - Multi-variable guard strings from transitions
 * @param {Object} petriNet - Petri net for context
 * @returns {Array<Object>} Filtered combinations
 */
export async function filterByGuards(combinations, guards, petriNet) {
  if (!guards || guards.length === 0) {
    return combinations;
  }
  
  const { parseBooleanExpr, evaluateBooleanWithBindings } = await import('../../utils/z3-arith.js');
  const { parseArithmetic } = await import('../../utils/arith-parser.js');
  
  const filtered = [];
  for (const inst of combinations) {
    let allGuardsSatisfied = true;
    
    for (const guardStr of guards) {
      try {
        // Create binding environment from instantiation
        const bindings = {};
        for (const [varName, value] of Object.entries(inst)) {
          bindings[varName] = value;
        }
        
        // Parse and evaluate guard expression
        const guardAst = parseBooleanExpr(guardStr);
        const result = evaluateBooleanWithBindings(guardAst, bindings, parseArithmetic);
        
        if (!result) {
          allGuardsSatisfied = false;
          break;
        }
      } catch (err) {
        // If evaluation fails, conservatively keep the combination
        console.warn(`Failed to evaluate guard "${guardStr}" on instantiation:`, err.message);
      }
    }
    
    if (allGuardsSatisfied) {
      filtered.push(inst);
    }
  }
  
  return filtered;
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
  const obs = {
    outputs: instantiateObject(pair.observation.outputs, instantiation),
    markings: pair.observation.markings // Markings don't have variables
  };
  
  // Preserve observation type if present (e.g., 'notEnabled')
  if (pair.observation.type) {
    obs.type = pair.observation.type;
  }
  
  return {
    stimulation: pair.stimulation.method ? {
      method: pair.stimulation.method,
      arguments: instantiateTerm(pair.stimulation.arguments, instantiation),
    } : {
      transition: pair.stimulation.transition,
      inputs: instantiateObject(pair.stimulation.inputs, instantiation)
    },
    observation: obs
  };
}

function instantiateObject(obj, instantiation) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = instantiateTerm(value, instantiation);
  }
  return result;
}
