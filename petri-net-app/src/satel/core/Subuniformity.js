/**
 * Subuniformity - Main API for semantic equivalence class partitioning
 * 
 * Coordinates guard analysis, partition generation, and representative finding
 * to implement sound symbolic subuniformity without full enumeration.
 */

import { analyzeGuard, extractConstants } from './GuardAnalyzer.js';
import { generatePartitions, generateAbstractionDoc } from './PartitionGenerator.js';
import { findRepresentativeBindings } from './RepresentativeFinder.js';

/**
 * Compute subuniform transitions for a given transition
 * Returns multiple (transition, binding) pairs representing equivalence classes
 * 
 * @param {Object} params - Parameters
 * @param {string} params.transitionId - Transition ID
 * @param {Object} params.petriNet - Petri net object
 * @param {Object} params.simulator - Algebraic simulator
 * @param {Object} params.cache - Simulator cache with guardAstByTransition and bindingAstsByArc
 * @param {Object} params.adtRegistry - ADT registry (optional)
 * @param {Object} params.options - Options
 * @returns {Promise<Array>} Array of {binding, picks, repr, doc} objects
 */
export async function computeSubuniformTransitions({
  transitionId,
  petriNet,
  simulator,
  cache,
  adtRegistry = null,
  options = {}
}) {
  const {
    maxRepresentatives = 10,
    enableSubuniformity = true,
    includeBoundaries = true,
    maxDepth = 2 // NEW: Max depth for ADT witness generation
  } = options;

  // Get transition and arcs
  const transition = petriNet.transitions.find(t => t.id === transitionId);
  if (!transition) return [];

  const inputArcs = petriNet.arcs.filter(
    a => (a.targetId === transitionId || a.target === transitionId) &&
         (a.sourceType === 'place' || !a.sourceType)
  );

  const placesById = Object.fromEntries(petriNet.places.map(p => [p.id, p]));
  const guardAst = cache.guardAstByTransition.get(transitionId);
  const bindingAstsByArc = cache.bindingAstsByArc;

  // If subuniformity disabled, return single binding
  if (!enableSubuniformity) {
    const evaluators = await getEvaluators();
    const result = await findRepresentativeBindings({
      transition,
      inputArcs,
      placesById,
      bindingAstsByArc,
      guardAst,
      partitions: null,
      evaluators,
      maxTokensPerPlace: simulator._config?.maxTokensPerPlace || 20
    });
    return result;
  }

  // Phase 1: Analyze guard to extract conditions (with ADT support)
  const conditions = analyzeGuard(guardAst, inputArcs, bindingAstsByArc, {
    adtRegistry,
    placesById
  });

  // Phase 2: Generate partitions (equivalence class representatives)
  const partitions = generatePartitions(conditions, {
    maxRepresentatives,
    includeBoundaries,
    adtRegistry,
    maxDepth
  });

  // Get evaluators once
  const evaluators = await getEvaluators();

  // If no partitions (trivial case), return single binding
  if (partitions.size === 0) {
    const result = await findRepresentativeBindings({
      transition,
      inputArcs,
      placesById,
      bindingAstsByArc,
      guardAst,
      partitions: null,
      evaluators,
      maxTokensPerPlace: simulator._config?.maxTokensPerPlace || 20
    });
    return result;
  }

  // Phase 3: Find satisfying bindings for each representative
  const results = await findRepresentativeBindings({
    transition,
    inputArcs,
    placesById,
    bindingAstsByArc,
    guardAst,
    partitions,
    evaluators,
    maxTokensPerPlace: simulator._config?.maxTokensPerPlace || 20
  });

  // Phase 4: Generate documentation
  const doc = generateAbstractionDoc(conditions, partitions);

  // Attach documentation to each result
  return results.map(r => ({ ...r, doc }));
}

/**
 * Get evaluator functions needed for binding resolution
 * @private
 */
async function getEvaluators() {
  // Dynamic imports to avoid circular dependencies
  const z3Arith = await import('../../utils/z3-arith.js');
  const arithParser = await import('../../utils/arith-parser.js');
  const astEval = await import('../../utils/ast-eval.js');
  const algebraicHelpers = await import('../../features/simulation/algebraic/algebraicHelpers.js');

  return {
    parseArithmetic: z3Arith.parseArithmetic,
    evaluateBooleanPredicate: algebraicHelpers.evaluateBooleanPredicateWithPool,
    matchPattern: arithParser.matchPattern,
    evaluateArithmeticWithBindings: z3Arith.evaluateArithmeticWithBindings,
    evaluateBooleanWithBindings: z3Arith.evaluateBooleanWithBindings,
    evaluatePatternLiteral: astEval.evaluatePatternLiteral
  };
}

/**
 * Compute subuniformity statistics for reporting
 * @param {Array} results - Results from computeSubuniformTransitions
 * @returns {Object} Statistics object
 */
export function computeSubuniformityStats(results) {
  if (!results || results.length === 0) {
    return {
      classCount: 0,
      hasDocumentation: false
    };
  }

  const doc = results[0]?.doc;
  const reprs = results.map(r => r.repr);

  return {
    classCount: results.length,
    representatives: reprs,
    bounded: doc?.bounded?.length || 0,
    unbounded: doc?.unbounded?.length || 0,
    summary: doc?.summary || 'No documentation available',
    hasDocumentation: !!doc
  };
}

/**
 * Check if subuniformity is applicable for a transition
 * @param {Object} guardAst - Guard AST
 * @param {Array} inputArcs - Input arcs
 * @returns {boolean} True if subuniformity can be applied
 */
export function isSubuniformityApplicable(guardAst, inputArcs) {
  // Subuniformity is always applicable, but may be trivial (1 class)
  // It's beneficial when:
  // 1. Guard has conditions (not just true)
  // 2. Multiple tokens available for binding
  // 3. Variables in guard/bindings
  
  if (!guardAst) {
    // No guard - may still partition by available tokens
    return inputArcs.length > 0;
  }

  return true; // Always try, let partition generator decide
}
