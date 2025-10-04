/**
 * Algebraic Petri Net Simulator (ints)
 * Pure JS implementation using Z3 for guards/bindings evaluation.
 * Extends BaseSimulator for consistent interface.
 */

import { BaseSimulator } from './BaseSimulator.js';
import { parseArithmetic, parsePattern, matchPattern } from '../../utils/arith-parser';
import {
  evaluateAction,
  evaluateArithmeticWithBindings,
  evaluatePredicate,
  solveEquation,
  solveInequality,
  parsePredicate,
  // Boolean support
  parseBooleanExpr,
  evaluateBooleanWithBindings,
  evaluateBooleanPredicate,
} from '../../utils/z3-arith.js';

export class AlgebraicSimulator extends BaseSimulator {
  constructor() {
    super();
    this.lastEnabledTransitions = [];
    this.cache = {
      guardAstByTransition: new Map(),
      bindingAstsByArc: new Map(),
    };
    this._cacheSignature = null;
  }

  /**
   * Get simulator type
   */
  getType() {
    return 'algebraic';
  }

  async initializeSpecific(petriNet, options = {}) {
    this.petriNet = deepCloneNet(petriNet);
    await this.buildCaches();
    await this.checkTransitionStateChanges();
  }

  async buildCaches() {
    this.cache.guardAstByTransition.clear();
    this.cache.bindingAstsByArc.clear();

    for (const t of (this.petriNet.transitions || [])) {
      if (t.guard && typeof t.guard === 'string') {
        try {
          // Prefer full bool parser (supports and/or/not, literals and comparisons)
          const ast = parseBooleanExpr(String(t.guard), parseArithmetic);
          this.cache.guardAstByTransition.set(t.id, ast);
        } catch (_) {
          try {
            // Fallback to legacy comparison-only predicate
            const ast = parsePredicate(String(t.guard), parseArithmetic);
            this.cache.guardAstByTransition.set(t.id, ast);
          } catch (_) {
            // ignore parse errors here; guard will simply be false if unparsable
          }
        }
      }
    }

    for (const a of (this.petriNet.arcs || [])) {
      const key = a.id;
      const bindings = Array.isArray(a.bindings) ? a.bindings : (a.binding ? [a.binding] : []);
      const asts = [];
      for (const b of bindings) {
        const text = String(b);
        
        // First try pattern matching (for deconstruction like (F, x))
        try {
          const pattern = parsePattern(text);
          asts.push({ kind: 'pattern', ast: pattern });
          continue;
        } catch (_) {
          // Not a pattern, continue with other parsing methods
        }
        
        // Prefer arithmetic, but if variable annotated as bool, store as bool kind
        let parsed = null;
        const tf = (text === 'T') ? true : (text === 'F') ? false : null;
        try { parsed = parseArithmetic(text); } catch (_) { parsed = null; }
        // If parsed as a function call, ensure it's one of the arithmetic/string/list functions we support.
        // Otherwise, treat it as a boolean expression (e.g., not(x)).
        if (parsed && parsed.type === 'funcall') {
          const allowedArithFuncs = new Set(['concat', 'substring', 'length', 'head', 'tail', 'append', 'sublist', 'isSublistOf', 'isSubstringOf']);
          if (!allowedArithFuncs.has(parsed.name)) {
            parsed = null; // fall back to boolean parsing below
          }
        }
        if (parsed) {
          if (parsed.type === 'var' && parsed.varType === 'bool') {
            // Represent as bool variable for uniformity
            asts.push({ kind: 'bool', ast: { type: 'boolVar', name: parsed.name, varType: 'bool' } });
          } else if (parsed.type === 'var' && parsed.varType === 'pair') {
            // Pair-typed variable binding
            asts.push({ kind: 'pair', ast: { type: 'pairVar', name: parsed.name, varType: 'pair' } });
          } else {
            asts.push({ kind: 'arith', ast: parsed });
          }
          continue;
        }
        if (tf !== null) { asts.push({ kind: 'bool', ast: { type: 'boolLit', value: tf } }); continue; }
        try { asts.push({ kind: 'bool', ast: parseBooleanExpr(text, parseArithmetic) }); continue; } catch (_) {}
        // Skip invalid
      }
      if (asts.length) this.cache.bindingAstsByArc.set(key, asts);
    }

    // Update cache signature to reflect current guards/bindings
    this._cacheSignature = computeCacheSignature(this.petriNet);
  }

  // Eventing is now handled via BaseSimulator helpers and shared SimulationEventBus

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      hasPyodide: false,
      hasSimulator: true,
      hasPetriNet: !!this.petriNet,
      simulationMode: this.simulationMode,
      petriNetSize: this.petriNet ? {
        places: this.petriNet.places?.length || 0,
        transitions: this.petriNet.transitions?.length || 0,
        arcs: this.petriNet.arcs?.length || 0,
      } : null,
    };
  }

  async setSimulationMode(mode) {
    if (mode === 'single' || mode === 'maximal') {
      this.simulationMode = mode;
    } else {
      throw new Error("Mode must be 'single' or 'maximal'");
    }
  }

  async updateSpecific(petriNet) {
    // Rebuild caches if guards or bindings changed
    const incomingSignature = computeCacheSignature(petriNet);
    const shouldRebuildCaches = incomingSignature !== this._cacheSignature;
    this.petriNet = deepCloneNet(petriNet);
    if (shouldRebuildCaches) {
      await this.buildCaches();
    }
    await this.checkTransitionStateChanges();
  }

  async getEnabledTransitionsSpecific() {
    const enabled = [];
    for (const t of (this.petriNet.transitions || [])) {
      const ok = await this.isTransitionEnabled(t.id);
      if (ok) enabled.push(String(t.id));
    }
    return enabled;
  }

  async checkForUnboundVariables(transitionId, inputArcs) {
    // Get all variables that can be bound from input arcs
    const boundVariables = new Set();
    
    // Collect variables from input arc bindings (including nested variables in patterns)
    for (const arc of inputArcs) {
      const bindingAsts = this.cache.bindingAstsByArc.get(arc.id) || [];
      for (const astObj of bindingAsts) {
        const { kind, ast } = astObj;
        if (kind === 'pattern') {
          const variables = this.extractVariablesFromPattern(ast);
          variables.forEach(varName => boundVariables.add(varName));
        }
      }
    }

    // Check guard for unbound variables
    const guardAst = this.cache.guardAstByTransition.get(transitionId);
    if (guardAst) {
      const guardVars = this.extractVariablesFromExpression(guardAst);
      for (const varName of guardVars) {
        if (!boundVariables.has(varName)) {
          console.log('Unbound variable in guard:', varName);
          return true; // Has unbound variables
        }
      }
    }

    // Check output arcs for unbound variables and empty bindings
    const outputArcs = (this.petriNet.arcs || []).filter(a => a.sourceId === transitionId && (a.targetType === 'place' || !a.targetType));
    
    for (const arc of outputArcs) {
      const bindingAsts = this.cache.bindingAstsByArc.get(arc.id) || [];
      
      // If output arc has no bindings at all, disable transition (no token can be produced)
      if (bindingAsts.length === 0) {
        console.log('Output arc has no bindings, disabling transition');
        return true; // Disable transition
      }
      
      for (const astObj of bindingAsts) {
        const { kind, ast } = astObj;
        if (kind === 'pattern' && ast.type === 'var') {
          // Only check variables - literals like 'int', 'boolLit', 'pairPattern' are always valid
          if (!boundVariables.has(ast.name)) {
            console.log('Unbound variable in output arc:', ast.name);
            return true; // Has unbound variables
          }
        }
      }
    }

    return false; // No unbound variables and all output arcs have bindings
  }

  extractVariablesFromPattern(ast) {
    const variables = new Set();
    
    function traverse(node) {
      if (!node) return;
      
      switch (node.type) {
        case 'var':
          variables.add(node.name);
          break;
        case 'pairPattern':
          traverse(node.fst);
          traverse(node.snd);
          break;
        case 'tuplePattern':
          if (node.elements) {
            node.elements.forEach(traverse);
          }
          break;
      }
    }
    
    traverse(ast);
    return Array.from(variables);
  }

  extractVariablesFromExpression(ast) {
    const variables = new Set();
    
    function traverse(node) {
      if (!node) return;
      
      switch (node.type) {
        case 'var':
        case 'boolVar':
        case 'pairVar':
          variables.add(node.name);
          break;
        case 'binop':
        case 'cmp':
          traverse(node.left);
          traverse(node.right);
          break;
        case 'unop':
          traverse(node.operand);
          break;
        case 'call':
          if (node.args) {
            node.args.forEach(traverse);
          }
          break;
        case 'pairPattern':
          traverse(node.fst);
          traverse(node.snd);
          break;
        case 'tuplePattern':
          if (node.elements) {
            node.elements.forEach(traverse);
          }
          break;
        case 'pairLit':
          traverse(node.fst);
          traverse(node.snd);
          break;
      }
    }
    
    traverse(ast);
    return Array.from(variables);
  }

  async isTransitionEnabled(transitionId) {
    if (!this.isInitialized) return false;
    const t = (this.petriNet.transitions || []).find(x => x.id === transitionId);
    if (!t) return false;

    // Gather input arcs (place -> transition)
    const inputArcs = (this.petriNet.arcs || []).filter(a => a.targetId === transitionId && (a.sourceType === 'place' || !a.sourceType));
    if (inputArcs.length === 0) return true; // degenerate: no inputs

    // Check for unbound variables in guard and output arcs
    const hasUnboundVariables = await this.checkForUnboundVariables(transitionId, inputArcs);
    if (hasUnboundVariables) {
      console.log('Transition disabled due to unbound variables:', transitionId);
      return false;
    }

    // Pre-parse guard
    const guardAst = this.cache.guardAstByTransition.get(transitionId);

    // Heuristic: try to find any matching selection of tokens satisfying bindings + guard
    const placesById = Object.fromEntries((this.petriNet.places || []).map(p => [p.id, p]));

    // Backtracking search with caps
    const MAX_TOKENS_PER_PLACE = 20;
    const chosen = [];

    const tryArc = async (arcIndex, bindings, env) => {
      if (arcIndex >= inputArcs.length) {
        // Check guard: prefer pure evaluation when all variables are bound; use Z3 only if free vars remain
        if (!guardAst) return true;
        const free = getUnboundBooleanGuardVars(guardAst, env);
        if (free.length > 0) {
          return evaluateBooleanPredicate(guardAst, env, parseArithmetic);
        }
        return evalBooleanGuardPure(guardAst, env);
      }
      const arc = inputArcs[arcIndex];
      const arcId = arc.id;
      const srcId = arc.sourceId || arc.source;
      const place = placesById[srcId];
      const tokens = getTokensForPlace(place, MAX_TOKENS_PER_PLACE);
      const bindingAsts = this.cache.bindingAstsByArc.get(arcId) || [];
      const needed = bindingAsts.length || (arc.weight ? Math.max(1, arc.weight | 0) : 0);
      if (needed === 0) return tryArc(arcIndex + 1, bindings, env);
      if (tokens.length < needed) return false;

      // Simple combination generation up to first satisfying assignment
      const used = new Array(tokens.length).fill(false);

      const tryBind = async (k, localEnv) => {
        if (k >= needed) return tryArc(arcIndex + 1, bindings, localEnv);
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
              // Pattern matching for deconstruction
              const bindings = matchPattern(ast, tok);
              if (bindings === null) {
                ok = false;
              } else {
                // Check for conflicts with existing bindings
                for (const [varName, varValue] of Object.entries(bindings)) {
                  if (nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, varName) && nextEnv[varName] !== varValue) {
                    ok = false;
                    break;
                  }
                }
                if (ok) {
                  nextEnv = { ...(nextEnv || {}), ...bindings };
                }
              }
            } else if (ast.type === 'var' || ast.type === 'boolVar' || ast.type === 'pairVar') {
              if (nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, ast.name) && nextEnv[ast.name] !== tok) {
                ok = false;
              } else {
                // Respect optional type annotation
                if (typeof tok === 'boolean' && ast.varType && ast.varType !== 'bool') ok = false;
                if (typeof tok === 'number' && ast.varType && ast.varType !== 'int') ok = false;
                if (typeof tok === 'string' && ast.varType && ast.varType !== 'string') ok = false;
                if (Array.isArray(tok) && ast.varType && ast.varType !== 'list') ok = false;
                if (isPair(tok) && ast.varType && ast.varType !== 'pair') ok = false;
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
                if (typeof tok !== 'bool' || val !== tok) ok = false;
              } catch (_) { ok = false; }
            } else if (kind === 'pair') {
              try {
                // Simple pair literal evaluation
                if (ast.type === 'pairLit') {
                  const litEval = (node) => {
                    if (node.type === 'pairLit') return { __pair__: true, fst: litEval(node.fst), snd: litEval(node.snd) };
                    if (node.type === 'boolLit') return !!node.value;
                    if (node.type === 'int') return node.value | 0;
                    if (node.type === 'boolVar' || node.type === 'var') return (localEnv || {})[node.name];
                    return null;
                  };
                  const v = litEval(ast);
                  if (!isPair(tok) || JSON.stringify(v) !== JSON.stringify(tok)) ok = false;
                }
              } catch (_) { ok = false; }
            }
          }
          if (ok) {
            chosen.push({ arcId: arc.id, tokenIndex: i, value: tok });
            const res = await tryBind(k + 1, nextEnv);
            if (res) return true;
            chosen.pop();
          }
          used[i] = false;
        }
        return false;
      };

      return tryBind(0, env || {});
    };

    const sat = await tryArc(0, [], {});
    return !!sat;
  }

  async stepSimulationSpecific() {
    // Step semantics are centralized in useSimulationManager / simulator-core.
    return this.getCurrentState();
  }

  async fireTransitionSpecific(transitionId) {
    // Capture previous enabled transitions for parity payload
    const previouslyEnabled = await this.getEnabledTransitionsSpecific();
    // A simple re-evaluation: find one satisfying assignment and apply
    const t = (this.petriNet.transitions || []).find(x => x.id === transitionId);
    if (!t) return this.getCurrentState();
    const inputArcs = (this.petriNet.arcs || []).filter(a => a.targetId === transitionId && (a.sourceType === 'place' || !a.sourceType));
    const outputArcs = (this.petriNet.arcs || []).filter(a => a.sourceId === transitionId && (a.targetType === 'place' || !a.targetType));
    const placesById = Object.fromEntries((this.petriNet.places || []).map(p => [p.id, p]));
    const guardAst = this.cache.guardAstByTransition.get(transitionId);

    // Find env + concrete token picks (reuse logic from enable, but record indices)
    const MAX_TOKENS_PER_PLACE = 20;
    const picks = [];

    const tryArc = async (arcIndex, env) => {
      if (arcIndex >= inputArcs.length) {
        if (!guardAst) return { env, picks };
        const free = getUnboundBooleanGuardVars(guardAst, env);
        if (free.length > 0) {
          const ok = await evaluateBooleanPredicate(guardAst, env, parseArithmetic);
          return ok ? { env, picks } : null;
        }
        const ok = await evalBooleanGuardPure(guardAst, env);
        return ok ? { env, picks } : null;
      }
      const arc = inputArcs[arcIndex];
      const arcId = arc.id;
      const srcId = arc.sourceId;
      const place = placesById[srcId];
      const tokens = getTokensForPlace(place, MAX_TOKENS_PER_PLACE);
      const bindingAsts = this.cache.bindingAstsByArc.get(arcId) || [];
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
              // Pattern matching for deconstruction
              const bindings = matchPattern(ast, tok);
              if (bindings === null) {
                ok = false;
              } else {
                // Check for conflicts with existing bindings
                for (const [varName, varValue] of Object.entries(bindings)) {
                  if (nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, varName) && nextEnv[varName] !== varValue) {
                    ok = false;
                    break;
                  }
                }
                if (ok) {
                  nextEnv = { ...(nextEnv || {}), ...bindings };
                }
              }
            } else if (ast.type === 'var' || ast.type === 'boolVar' || ast.type === 'pairVar') {
              if (nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, ast.name) && nextEnv[ast.name] !== tok) {
                ok = false;
              } else {
                if (typeof tok === 'boolean' && ast.varType && ast.varType !== 'bool') ok = false;
                if (typeof tok === 'number' && ast.varType && ast.varType !== 'int') ok = false;
                if (isPair(tok) && ast.varType && ast.varType !== 'pair') ok = false;
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
                if (typeof tok !== 'bool' || val !== tok) ok = false;
              } catch (_) { ok = false; }
            } else if (kind === 'pair') {
              try {
                // Simple pair literal evaluation
                if (ast.type === 'pairLit') {
                  const litEval = (node) => {
                    if (node.type === 'pairLit') return { __pair__: true, fst: litEval(node.fst), snd: litEval(node.snd) };
                    if (node.type === 'boolLit') return !!node.value;
                    if (node.type === 'int') return node.value | 0;
                    if (node.type === 'boolVar' || node.type === 'var') return (localEnv || {})[node.name];
                    return null;
                  };
                  const v = litEval(ast);
                  if (!isPair(tok) || JSON.stringify(v) !== JSON.stringify(tok)) ok = false;
                }
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

    const result = await tryArc(0, {});
    if (!result) throw new Error(`Transition ${transitionId} is not enabled`);
    let env = result.env || {};

    // If guard has free variables, try to solve the guard to bind them before producing outputs
    if (guardAst) {
      const free = getUnboundBooleanGuardVars(guardAst, env);
      if (free.length > 0) {
        try {
          // Use SAT check to see if any assignment exists; if so, keep env as-is
          const ok = await evaluateBooleanPredicate(guardAst, env, parseArithmetic);
          if (!ok) throw new Error('Guard unsatisfied under any extension');
        } catch (_) { /* ignore */ }
      }
    }

    // Consume tokens
    // When multiple tokens from the same place are consumed, remove by descending
    // indices to avoid index-shift bugs.
    const picksByPlace = new Map();
    for (const p of picks) {
      if (!p.srcId) continue;
      if (!picksByPlace.has(p.srcId)) picksByPlace.set(p.srcId, []);
      picksByPlace.get(p.srcId).push(p);
    }
    for (const [srcId, arr] of picksByPlace.entries()) {
      const place = placesById[srcId];
      if (!place) continue;
      const fallbackCount = arr.filter(p => p.countFallback).length;
      if (fallbackCount > 0) {
        const current = Number(place.tokens || 0);
        place.tokens = Math.max(0, current - fallbackCount);
      }
      const indexed = arr.filter(p => !p.countFallback);
      if (Array.isArray(place.valueTokens) && indexed.length > 0) {
        // Sort by descending index so earlier removals do not shift later ones
        indexed.sort((a, b) => b.tokenIndex - a.tokenIndex);
        for (const p of indexed) {
          if (p.tokenIndex >= 0 && p.tokenIndex < place.valueTokens.length) {
            place.valueTokens.splice(p.tokenIndex, 1);
          }
        }
        place.tokens = place.valueTokens.length;
      }
    }

    // Produce tokens on outputs
    for (const arc of outputArcs) {
      const tgtId = arc.targetId;
      const place = placesById[tgtId];
      if (!place) continue;
      if (!Array.isArray(place.valueTokens)) place.valueTokens = [];
      const bindingAsts = this.cache.bindingAstsByArc.get(arc.id) || [];
      if (bindingAsts.length > 0) {
        // Push one token per binding evaluation
        for (const astObj of bindingAsts) {
          try {
            let v;
            const { kind, ast } = astObj;
            if (ast && (ast.type === 'var' || ast.type === 'boolVar' || ast.type === 'pairVar')) {
              v = (env || {})[ast.name];
            } else if (kind === 'arith') {
              v = evaluateArithmeticWithBindings(ast, env);
            } else if (kind === 'bool') {
              v = evaluateBooleanWithBindings(ast, env, parseArithmetic);
            } else if (kind === 'pattern') {
              // Evaluate pattern literal (like (T,2)) or simple literals
              if (ast.type === 'pairPattern') {
                const litEval = (node) => {
                  if (node.type === 'pairPattern') return { __pair__: true, fst: litEval(node.fst), snd: litEval(node.snd) };
                  if (node.type === 'boolLit') return !!node.value;
                  if (node.type === 'int') return node.value | 0;
                  if (node.type === 'var') return (env || {})[node.name];
                  return null;
                };
                v = litEval(ast);
              } else if (ast.type === 'tuplePattern') {
                // Future: handle tuple patterns
                const components = ast.components.map(comp => {
                  if (comp.type === 'boolLit') return !!comp.value;
                  if (comp.type === 'int') return comp.value | 0;
                  if (comp.type === 'var') return (env || {})[comp.name];
                  return null;
                });
                v = components;
              } else if (ast.type === 'int') {
                // Simple int literal
                v = ast.value | 0;
              } else if (ast.type === 'boolLit') {
                // Simple bool literal
                v = !!ast.value;
              } else if (ast.type === 'var') {
                // Simple variable
                v = (env || {})[ast.name];
              }
            } else if (kind === 'pair') {
              // Evaluate pair literal
              if (ast.type === 'pairLit') {
                const litEval = (node) => {
                  if (node.type === 'pairLit') return { __pair__: true, fst: litEval(node.fst), snd: litEval(node.snd) };
                  if (node.type === 'boolLit') return !!node.value;
                  if (node.type === 'int') return node.value | 0;
                  if (node.type === 'boolVar' || node.type === 'var') return (env || {})[node.name];
                  return null;
                };
                v = litEval(ast);
              }
            }
            if (!Array.isArray(place.valueTokens)) place.valueTokens = [];
            if (typeof v === 'number') {
              place.valueTokens.push(v | 0);
            }
            else if (typeof v === 'boolean') {
              place.valueTokens.push(v);
            }
            else if (typeof v === 'string') {
              place.valueTokens.push(v);
            }
            else if (isPair(v)) {
              place.valueTokens.push(v);
            }
            else if (Array.isArray(v)) {
              // If it's from arith evaluation (list token), push as-is
              // If it's from tuple destructuring, spread it
              if (kind === 'arith' || kind === 'pair' || (ast && ast.type === 'list')) {
                place.valueTokens.push(v); // Push list as single token
              } else {
                place.valueTokens.push(...v); // Spread tuple elements
              }
            }
          } catch (e) { 
            // Skip invalid bindings
          }
        }
      } else if (arc.weight && (arc.weight | 0) > 0) {
        // If no bindings, push 'weight' copies of a default variable if any env var exists; otherwise 1s
        const n = arc.weight | 0;
        for (let i = 0; i < n; i++) {
          // Prefer a bound variable value if exactly one variable exists in env
          const vals = Object.values(env || {});
          if (Array.isArray(place.valueTokens)) {
            const first = vals[0];
            place.valueTokens.push(typeof first === 'boolean' ? !!first : (Number.isFinite(first) ? (first | 0) : 1));
          } else {
            place.tokens = (Number(place.tokens || 0) + 1) | 0;
          }
        }
      } else {
        // Default single token of value 1
        if (Array.isArray(place.valueTokens)) {
          place.valueTokens.push(1);
        } else {
          place.tokens = (Number(place.tokens || 0) + 1) | 0;
        }
      }
      if (Array.isArray(place.valueTokens)) {
        place.tokens = place.valueTokens.length;
      }
    }

    // Apply transition action if provided: action like "y = x + 1, z = x - 1"
    if (t.action && typeof t.action === 'string') {
      try {
        const assignments = evaluateAction(t.action, env, parseArithmetic);
        // No direct store for variables; actions only affect produced token expressions above.
        // If future semantics require, we could apply assignments to outputs here.
      } catch (_) { /* ignore action errors */ }
    }

    await this.checkTransitionStateChanges();
    const newState = this.getCurrentState();
    // Emit transitionFired via shared event bus
    this.emitTransitionFired({ transitionId, newPetriNet: newState });
    // Emit transitionsChanged with parity payload
    const enabledAfter = await this.getEnabledTransitionsSpecific();
    this.emitTransitionsChanged({ enabled: enabledAfter, previouslyEnabled });
    return newState;
  }

  getCurrentState() {
    // Normalize return shape as in PyodideSimulator.validateResult
    const places = (this.petriNet.places || []).map(p => ({
      id: p.id,
      label: p.label || '',
      tokens: Number(Array.isArray(p.valueTokens) ? p.valueTokens.length : (p.tokens || 0)),
      x: Number(p.x || 0),
      y: Number(p.y || 0),
      name: p.name || '',
      type: 'place',
      valueTokens: Array.isArray(p.valueTokens) ? [...p.valueTokens] : undefined,
    }));
    const transitions = (this.petriNet.transitions || []).map(t => ({
      id: t.id,
      label: t.label || '',
      x: Number(t.x || 0),
      y: Number(t.y || 0),
      name: t.name || '',
      type: 'transition',
      guard: t.guard,
      action: t.action,
    }));
    const placeIds = new Set(places.map(p => p.id));
    const transitionIds = new Set(transitions.map(t => t.id));
    const arcs = (this.petriNet.arcs || []).map(a => {
      const s = a.sourceId || a.source;
      const t = a.targetId || a.target;
      const inferredSourceType = placeIds.has(s) ? 'place' : (transitionIds.has(s) ? 'transition' : (a.sourceType || 'place'));
      const inferredTargetType = placeIds.has(t) ? 'place' : (transitionIds.has(t) ? 'transition' : (a.targetType || 'transition'));
      const type = a.type || `${inferredSourceType}-to-${inferredTargetType}`;
      return {
        id: a.id,
        sourceId: s,
        targetId: t,
        source: s,
        target: t,
        weight: Number(a.weight || 1),
        sourceType: inferredSourceType,
        targetType: inferredTargetType,
        type,
        bindings: Array.isArray(a.bindings) ? [...a.bindings] : (a.binding ? [a.binding] : []),
      };
    });
    return { places, transitions, arcs };
  }

  async checkTransitionStateChanges() {
    if (!this.isInitialized) return;
    try {
      const currentEnabled = await this.getEnabledTransitionsSpecific();
      const changed = JSON.stringify([...currentEnabled].sort()) !== JSON.stringify([...this.lastEnabledTransitions].sort());
      if (changed) {
        const prev = [...this.lastEnabledTransitions];
        this.lastEnabledTransitions = [...currentEnabled];
        this.emitTransitionsChanged({
          enabled: currentEnabled,
          previouslyEnabled: prev,
        });
      }
    } catch (_) { /* ignore */ }
  }

  /**
   * Reset simulator-specific state
   */
  resetSpecific() {
    this.lastEnabledTransitions = [];
    this.cache.guardAstByTransition.clear();
    this.cache.bindingAstsByArc.clear();
    this._cacheSignature = null;
  }
}

function deepCloneNet(net) {
  return JSON.parse(JSON.stringify(net || { places: [], transitions: [], arcs: [] }));
}

function evalBooleanGuardPure(guardAst, env) {
  try {
    return evaluateBooleanWithBindings(guardAst, env || {}, parseArithmetic);
  } catch (_) { return false; }
}

function getUnboundBooleanGuardVars(ast, env) {
  const names = new Set();
  function collect(node) {
    if (!node) return;
    switch (node.type) {
      case 'boolVar': names.add(node.name); break;
      case 'pairVar': names.add(node.name); break;
      case 'and': case 'or': collect(node.left); collect(node.right); break;
      case 'not': collect(node.expr); break;
      case 'cmp': collectArith(node.left); collectArith(node.right); break;
      default: break;
    }
  }
  function collectArith(ast) {
    if (!ast) return;
    if (ast.type === 'var') names.add(ast.name);
    if (ast.type === 'boolVar') names.add(ast.name);
    if (ast.type === 'pairVar') names.add(ast.name);
    else if (ast.type === 'bin') { collectArith(ast.left); collectArith(ast.right); }
    else if (ast.type === 'pairLit') { collectArith(ast.fst); collectArith(ast.snd); }
  }
  collect(ast);
  const bound = new Set(Object.keys(env || {}));
  return Array.from(names).filter(n => !bound.has(n));
}

function substituteBindings(ast, env) {
  if (!ast) return ast;
  if (ast.type === 'var') {
    if (Object.prototype.hasOwnProperty.call(env || {}, ast.name)) {
      return { type: 'int', value: env[ast.name] | 0 };
    }
    return ast;
  }
  if (ast.type === 'bin') {
    return { type: 'bin', op: ast.op, left: substituteBindings(ast.left, env), right: substituteBindings(ast.right, env) };
  }
  return ast;
}

// Utility: obtain tokens for a place in algebraic mode.
// If explicit int tokens are not provided (valueTokens), fall back to PT count by
// materializing that many tokens with value 1. This keeps APNs usable when only counts are set.
export function getTokensForPlace(place, cap = 20) {
  if (!place) return [];
  if (Array.isArray(place.valueTokens)) {
    return place.valueTokens.slice(0, cap);
  }
  const n = Number(place.tokens || 0);
  if (Number.isFinite(n) && n > 0) {
    return Array.from({ length: Math.min(n, cap) }, () => 1);
  }
  return [];
}

function isPair(v) {
  return !!(v && typeof v === 'object' && v.__pair__ === true && 'fst' in v && 'snd' in v);
}

// Build a lightweight signature over guards/bindings (and actions) to detect semantic changes
function computeCacheSignature(net) {
  try {
    const transitions = Array.isArray(net?.transitions) ? net.transitions.slice() : [];
    const arcs = Array.isArray(net?.arcs) ? net.arcs.slice() : [];
    transitions.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    arcs.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const tSig = transitions.map(t => `${t.id}|g:${String(t.guard || '')}|a:${String(t.action || '')}`).join(';');
    const aSig = arcs.map(a => `${a.id}|b:${Array.isArray(a.bindings) ? a.bindings.join(',') : (a.binding ? String(a.binding) : '')}`).join(';');
    return `${tSig}||${aSig}`;
  } catch (_) {
    return String(Math.random());
  }
}



