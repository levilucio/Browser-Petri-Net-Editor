/**
 * Representative Finder - Find satisfying bindings for equivalence class representatives
 * 
 * Given representative values for each variable, find actual token bindings
 * that satisfy the guard and bindings for that equivalence class.
 */

import { getTokensForPlace } from '../../utils/token-utils.js';

/**
 * Find all satisfying bindings for a transition using subuniformity
 * @param {Object} params - Parameters
 * @param {Object} params.transition - Transition object
 * @param {Array} params.inputArcs - Input arcs
 * @param {Object} params.placesById - Places by ID map
 * @param {Map} params.bindingAstsByArc - Binding ASTs cache
 * @param {Object} params.guardAst - Guard AST
 * @param {Map} params.partitions - Variable -> representatives map
 * @param {Object} params.evaluators - Evaluation functions
 * @param {number} params.maxTokensPerPlace - Max tokens to consider per place
 * @returns {Promise<Array>} Array of {binding, repr} objects
 */
export async function findRepresentativeBindings({
  transition,
  inputArcs,
  placesById,
  bindingAstsByArc,
  guardAst,
  partitions,
  evaluators,
  maxTokensPerPlace = 20
}) {
  const {
    parseArithmetic,
    evaluateBooleanPredicate,
    matchPattern,
    evaluateArithmeticWithBindings,
    evaluateBooleanWithBindings,
    evaluatePatternLiteral
  } = evaluators;

  // If no partitions (no variables or trivial guards), fall back to simple binding
  if (!partitions || partitions.size === 0) {
    const result = await findSingleBinding({
      inputArcs,
      placesById,
      bindingAstsByArc,
      guardAst,
      evaluators,
      maxTokensPerPlace
    });
    return result ? [{ binding: result.env, picks: result.picks, repr: {} }] : [];
  }

  // Generate all combinations of representative values
  const varNames = Array.from(partitions.keys());
  const reprCombinations = generateCombinations(varNames, partitions);

  const results = [];

  // For each representative combination, try to find a satisfying binding
  for (const repr of reprCombinations) {
    const result = await findBindingForRepresentative({
      inputArcs,
      placesById,
      bindingAstsByArc,
      guardAst,
      representative: repr,
      evaluators,
      maxTokensPerPlace
    });

    if (result) {
      results.push({
        binding: result.env,
        picks: result.picks,
        repr
      });
    }
  }

  return results;
}

/**
 * Generate all combinations of representative values
 * @private
 */
function generateCombinations(varNames, partitions) {
  if (varNames.length === 0) return [{}];
  
  const [first, ...rest] = varNames;
  const firstReprs = partitions.get(first) || [1];
  const restCombinations = generateCombinations(rest, partitions);
  
  const combinations = [];
  for (const value of firstReprs) {
    for (const restCombo of restCombinations) {
      combinations.push({ [first]: value, ...restCombo });
    }
  }
  
  return combinations;
}

/**
 * Find a binding that matches a specific representative value assignment
 * @private
 */
async function findBindingForRepresentative({
  inputArcs,
  placesById,
  bindingAstsByArc,
  guardAst,
  representative,
  evaluators,
  maxTokensPerPlace
}) {
  const {
    parseArithmetic,
    evaluateBooleanPredicate,
    matchPattern,
    evaluateArithmeticWithBindings,
    evaluateBooleanWithBindings,
    evaluatePatternLiteral
  } = evaluators;

  const picks = [];

  const tryArc = async (arcIndex, env) => {
    if (arcIndex >= inputArcs.length) {
      // Check guard with current environment
      if (!guardAst) return { env, picks };
      
      try {
        const pureOk = evaluateBooleanWithBindings(guardAst, env || {}, parseArithmetic);
        if (!pureOk) return null;
        return { env, picks };
      } catch (err) {
        try {
          const ok = await evaluateBooleanPredicate(guardAst, env || {}, parseArithmetic);
          return ok ? { env, picks } : null;
        } catch (_) {
          return null;
        }
      }
    }

    const arc = inputArcs[arcIndex];
    const srcId = arc.sourceId || arc.source;
    const place = placesById[srcId];
    const tokens = getTokensForPlace(place, maxTokensPerPlace);
    const bindingAsts = bindingAstsByArc.get(arc.id) || [];
    const needed = bindingAsts.length || (arc.weight ? Math.max(1, arc.weight | 0) : 0);
    
    if (needed === 0) return tryArc(arcIndex + 1, env);
    if (tokens.length < needed) return null;

    const used = new Array(tokens.length).fill(false);

    const tryBind = async (k, localEnv) => {
      if (k >= needed) return tryArc(arcIndex + 1, localEnv);
      
      for (let i = 0; i < tokens.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        
        const tok = tokens[i];
        let ok = true;
        let nextEnv = localEnv;
        const astObj = bindingAsts[k];
        
        if (astObj) {
          const { kind, ast } = astObj;
          
          if (kind === 'pattern') {
            const bindings = matchPattern(ast, tok);
            if (bindings === null) {
              ok = false;
            } else {
              // Check if bindings match representative values
              for (const [varName, varValue] of Object.entries(bindings)) {
                // If this variable has a representative, check it matches
                if (representative.hasOwnProperty(varName)) {
                  if (varValue !== representative[varName]) {
                    ok = false;
                    break;
                  }
                }
                // Check consistency with existing environment
                if (nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, varName)) {
                  if (nextEnv[varName] !== varValue) {
                    ok = false;
                    break;
                  }
                }
              }
              if (ok) nextEnv = { ...(nextEnv || {}), ...bindings };
            }
          } else if (ast && (ast.type === 'var' || ast.type === 'boolVar' || ast.type === 'pairVar')) {
            // Variable binding - must match representative if specified
            if (representative.hasOwnProperty(ast.name)) {
              if (tok !== representative[ast.name]) {
                ok = false;
              }
            }
            
            if (ok && nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, ast.name)) {
              if (nextEnv[ast.name] !== tok) {
                ok = false;
              }
            }
            
            if (ok) {
              nextEnv = { ...(nextEnv || {}), [ast.name]: tok };
            }
          } else if (kind === 'arith') {
            try {
              const val = evaluateArithmeticWithBindings(ast, localEnv || {});
              if (typeof tok !== 'number' || val !== (tok | 0)) ok = false;
            } catch (_) { ok = false; }
          } else if (kind === 'bool') {
            try {
              const val = evaluateBooleanWithBindings(ast, localEnv || {}, parseArithmetic);
              if (typeof tok !== 'boolean' || val !== tok) ok = false;
            } catch (_) { ok = false; }
          }
        }
        
        if (ok) {
          picks.push({ 
            arcId: arc.id, 
            srcId, 
            tokenIndex: i, 
            value: tok, 
            countFallback: !Array.isArray(place?.valueTokens) 
          });
          
          const res = await tryBind(k + 1, nextEnv);
          if (res) return res;
          picks.pop();
        }
        
        used[i] = false;
      }
      return null;
    };

    return tryBind(0, env || {});
  };

  return tryArc(0, {});
}

/**
 * Find a single satisfying binding (fallback when no partitions)
 * @private
 */
async function findSingleBinding({
  inputArcs,
  placesById,
  bindingAstsByArc,
  guardAst,
  evaluators,
  maxTokensPerPlace
}) {
  const {
    parseArithmetic,
    evaluateBooleanPredicate,
    matchPattern,
    evaluateArithmeticWithBindings,
    evaluateBooleanWithBindings,
    evaluatePatternLiteral
  } = evaluators;

  const picks = [];

  const tryArc = async (arcIndex, env) => {
    if (arcIndex >= inputArcs.length) {
      if (!guardAst) return { env, picks };
      
      try {
        const pureOk = evaluateBooleanWithBindings(guardAst, env || {}, parseArithmetic);
        if (!pureOk) return null;
        return { env, picks };
      } catch (err) {
        try {
          const ok = await evaluateBooleanPredicate(guardAst, env || {}, parseArithmetic);
          return ok ? { env, picks } : null;
        } catch (_) {
          return null;
        }
      }
    }

    const arc = inputArcs[arcIndex];
    const srcId = arc.sourceId || arc.source;
    const place = placesById[srcId];
    const tokens = getTokensForPlace(place, maxTokensPerPlace);
    const bindingAsts = bindingAstsByArc.get(arc.id) || [];
    const needed = bindingAsts.length || (arc.weight ? Math.max(1, arc.weight | 0) : 0);
    
    if (needed === 0) return tryArc(arcIndex + 1, env);
    if (tokens.length < needed) return null;

    const used = new Array(tokens.length).fill(false);

    const tryBind = async (k, localEnv) => {
      if (k >= needed) return tryArc(arcIndex + 1, localEnv);
      
      for (let i = 0; i < tokens.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        
        const tok = tokens[i];
        let ok = true;
        let nextEnv = localEnv;
        const astObj = bindingAsts[k];
        
        if (astObj) {
          const { kind, ast } = astObj;
          
          if (kind === 'pattern') {
            const bindings = matchPattern(ast, tok);
            if (bindings === null) {
              ok = false;
            } else {
              for (const [varName, varValue] of Object.entries(bindings)) {
                if (nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, varName) && nextEnv[varName] !== varValue) {
                  ok = false;
                  break;
                }
              }
              if (ok) nextEnv = { ...(nextEnv || {}), ...bindings };
            }
          } else if (ast && (ast.type === 'var' || ast.type === 'boolVar' || ast.type === 'pairVar')) {
            if (nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, ast.name) && nextEnv[ast.name] !== tok) {
              ok = false;
            } else {
              if (ok) nextEnv = { ...(nextEnv || {}), [ast.name]: tok };
            }
          } else if (kind === 'arith') {
            try {
              const val = evaluateArithmeticWithBindings(ast, localEnv || {});
              if (typeof tok !== 'number' || val !== (tok | 0)) ok = false;
            } catch (_) { ok = false; }
          } else if (kind === 'bool') {
            try {
              const val = evaluateBooleanWithBindings(ast, localEnv || {}, parseArithmetic);
              if (typeof tok !== 'boolean' || val !== tok) ok = false;
            } catch (_) { ok = false; }
          }
        }
        
        if (ok) {
          picks.push({ arcId: arc.id, srcId, tokenIndex: i, value: tok, countFallback: !Array.isArray(place?.valueTokens) });
          const res = await tryBind(k + 1, nextEnv);
          if (res) return res;
          picks.pop();
        }
        
        used[i] = false;
      }
      return null;
    };

    return tryBind(0, env || {});
  };

  return tryArc(0, {});
}
