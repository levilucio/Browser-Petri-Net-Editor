/**
 * Algebraic Petri Net Simulator (ints)
 * Pure JS implementation using Z3 for guards/bindings evaluation.
 * Extends BaseSimulator for consistent interface.
 */

import { BaseSimulator } from './BaseSimulator.js';
import { parseArithmetic, parsePattern, matchPattern } from '../../utils/arith-parser';
import { getTokensForPlace, isPair } from '../../utils/token-utils';
import { evaluatePatternLiteral } from '../../utils/ast-eval';
import { ensureOutputBindingsTypeCompatible } from './type-check';
import { allowedOps } from './ops/registry';
import { buildGuardCache, buildBindingCache } from './cache';
import { findSatisfyingAssignment } from './assignment';
import { consumeTokens, produceTokens } from './token-io';
import { extractVariablesFromPattern, extractVariablesFromExpression, checkForUnboundVariables as checkUnbound } from './guard-utils';
import { getCurrentStateNormalized } from './state-normalizer';
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
  evaluateBooleanPredicate as evaluateBooleanPredicateDirect,
} from '../../utils/z3-arith.js';
import * as z3Pool from '../../utils/z3-remote.js';

const evaluateBooleanPredicateWithPool = async (guardAst, env, parseArithmeticFn) => {
  try {
    const poolEnabled = typeof z3Pool.isWorkerPoolEnabled === 'function' ? z3Pool.isWorkerPoolEnabled() : false;
    if (poolEnabled && typeof z3Pool.evaluateBooleanPredicate === 'function') {
      try {
        return await z3Pool.evaluateBooleanPredicate(guardAst, env, parseArithmeticFn);
      } catch (_) {
        // fall through to inline evaluation
      }
    }
  } catch (_) {}
  return await evaluateBooleanPredicateDirect(guardAst, env, parseArithmeticFn);
};

export class AlgebraicSimulator extends BaseSimulator {
  constructor() {
    super();
    this.lastEnabledTransitions = [];
    this.cache = {
      guardAstByTransition: new Map(),
      bindingAstsByArc: new Map(),
    };
    this._cacheSignature = null;
    this._config = { maxTokensPerPlace: Infinity };
    this._enabledCache = new Map(); // transitionId -> boolean (enabled state)
  }

  /**
   * Get simulator type
   */
  getType() {
    return 'algebraic';
  }

  async initializeSpecific(petriNet, options = {}) {
    this.petriNet = deepCloneNet(petriNet);
    if (options && typeof options.maxTokensPerPlace === 'number' && options.maxTokensPerPlace >= 0) {
      this._config.maxTokensPerPlace = options.maxTokensPerPlace | 0;
    } else {
      this._config.maxTokensPerPlace = Infinity;
    }
    await this.buildCaches();
    await this.checkTransitionStateChanges();
  }

  async buildCaches() {
    this.cache.guardAstByTransition.clear();
    this.cache.bindingAstsByArc.clear();

    this.cache.guardAstByTransition = buildGuardCache(
      this.petriNet,
      parseArithmetic,
      parseBooleanExpr,
      parsePredicate
    );

    this.cache.bindingAstsByArc = buildBindingCache(
      this.petriNet,
      parsePattern,
      parseArithmetic,
      parseBooleanExpr,
      allowedOps
    );

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

  // Internal: verify that output arc bindings with explicit type annotations
  // are compatible with the current environment of bound variables.
  _outputBindingsTypeCompatible(transitionId, env) {
    return ensureOutputBindingsTypeCompatible(this.petriNet, this.cache, transitionId, env);
  }

  /**
   * Invalidate enabled cache for transitions connected to the given places.
   * @param {Set<string>} changedPlaces - Set of place IDs that changed
   */
  _invalidateEnabledCache(changedPlaces) {
    if (!changedPlaces || changedPlaces.size === 0) {
      return;
    }
    const arcs = this.petriNet.arcs || [];
    for (const arc of arcs) {
      // Check if this arc comes from a changed place to a transition
      const placeId = arc.sourceId || arc.source;
      const isPlaceToTransition = (arc.type === 'place-to-transition') || (arc.sourceType === 'place');
      if (isPlaceToTransition && changedPlaces.has(placeId)) {
        const tId = String(arc.targetId || arc.target);
        this._enabledCache.delete(tId);
      }
    }
  }

  /**
   * Clear the entire enabled cache (e.g., on net update or reset).
   */
  _clearEnabledCache() {
    this._enabledCache.clear();
  }

  async updateSpecific(petriNet) {
    // Rebuild caches if guards or bindings changed
    const incomingSignature = computeCacheSignature(petriNet);
    const shouldRebuildCaches = incomingSignature !== this._cacheSignature;
    this.petriNet = deepCloneNet(petriNet);
    if (shouldRebuildCaches) {
      await this.buildCaches();
    }
    // Clear enabled cache since net structure may have changed
    this._clearEnabledCache();
    await this.checkTransitionStateChanges();
  }

  async getEnabledTransitionsSpecific() {
    const transitions = Array.isArray(this.petriNet.transitions) ? this.petriNet.transitions : [];
    if (transitions.length === 0) return [];

    // Separate cached and uncached transitions
    const toCheck = [];
    const toCheckIndices = [];
    for (let i = 0; i < transitions.length; i++) {
      const tId = String(transitions[i].id);
      if (!this._enabledCache.has(tId)) {
        toCheck.push(transitions[i]);
        toCheckIndices.push(i);
      }
    }

    // If we have transitions to check, evaluate them in parallel
    if (toCheck.length > 0) {
      const poolSize = (typeof z3Pool.getConfiguredPoolSize === 'function')
        ? Number(z3Pool.getConfiguredPoolSize() || 0)
        : 0;
      const concurrency = Math.max(1, Math.min(toCheck.length, poolSize > 0 ? poolSize : 1));

      if (concurrency <= 1) {
        // Sequential evaluation for uncached transitions
        for (const t of toCheck) {
          try {
            const ok = await this.isTransitionEnabled(t.id);
            this._enabledCache.set(String(t.id), ok);
          } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn('Failed to evaluate transition', t?.id, err);
            }
            this._enabledCache.set(String(t.id), false);
          }
        }
      } else {
        // Parallel evaluation for uncached transitions
        const flags = new Array(toCheck.length).fill(false);
        let nextIndex = 0;
        const runSlot = async () => {
          while (true) {
            const idx = nextIndex++;
            if (idx >= toCheck.length) break;
            const t = toCheck[idx];
            try {
              const ok = await this.isTransitionEnabled(t.id);
              flags[idx] = ok;
            } catch (err) {
              if (process.env.NODE_ENV !== 'production') {
                console.warn('Failed to evaluate transition', t?.id, err);
              }
            }
          }
        };

        const workers = Array.from({ length: concurrency }, () => runSlot());
        await Promise.all(workers);

        // Update cache with results
        for (let i = 0; i < toCheck.length; i++) {
          this._enabledCache.set(String(toCheck[i].id), flags[i]);
        }
      }
    }

    // Collect all enabled transitions from cache
    const enabled = [];
    for (const t of transitions) {
      const tId = String(t.id);
      if (this._enabledCache.get(tId) === true) {
        enabled.push(tId);
      }
    }
    return enabled;
  }

  async checkForUnboundVariables(transitionId, inputArcs) {
    return checkUnbound(
      this.petriNet,
      this.cache.bindingAstsByArc,
      this.cache.guardAstByTransition,
      transitionId,
      inputArcs
    );
  }

  // Deprecated helpers retained for compatibility if referenced externally
  extractVariablesFromPattern(ast) { return extractVariablesFromPattern(ast); }
  extractVariablesFromExpression(ast) { return extractVariablesFromExpression(ast); }

  async isTransitionEnabled(transitionId) {
    if (!this.isInitialized) return false;
    const t = (this.petriNet.transitions || []).find(x => x.id === transitionId);
    if (!t) return false;

    // Gather input arcs (place -> transition)
    const inputArcs = (this.petriNet.arcs || []).filter(a => (a.targetId === transitionId || a.target === transitionId) && (a.sourceType === 'place' || !a.sourceType));
    if (inputArcs.length === 0) return true; // degenerate: no inputs

    // Check for unbound variables in guard and output arcs
    const hasUnboundVariables = await this.checkForUnboundVariables(transitionId, inputArcs);
    if (hasUnboundVariables) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('Transition disabled due to unbound variables:', transitionId);
      }
      return false;
    }

    const guardAst = this.cache.guardAstByTransition.get(transitionId);
    const placesById = Object.fromEntries((this.petriNet.places || []).map(p => [p.id, p]));

    const res = await findSatisfyingAssignment({
      transition: t,
      inputArcs,
      placesById,
      bindingAstsByArc: this.cache.bindingAstsByArc,
      guardAst,
      parseArithmetic,
      evaluateBooleanPredicate: evaluateBooleanPredicateWithPool,
      matchPattern,
      getTokensForPlace,
      evaluateArithmeticWithBindings,
      evaluateBooleanWithBindings,
      evaluatePatternLiteral,
      maxTokensPerPlace: this._config.maxTokensPerPlace,
    });
    if (!res) return false;
    return this._outputBindingsTypeCompatible(transitionId, res.env || {});
  }

  async stepSimulationSpecific() {
    // Step semantics are centralized in useSimulationManager / simulator-core.
    return this.getCurrentState();
  }

  async fireTransitionSpecific(transitionId, options = {}) {
    // Skip expensive enabled checks if firing in batch mode (caller will handle after all fires complete)
    const skipEnabledCheck = options.skipEnabledCheck || false;
    // Capture previous enabled transitions for parity payload
    const previouslyEnabled = skipEnabledCheck ? [] : await this.getEnabledTransitionsSpecific();
    // A simple re-evaluation: find one satisfying assignment and apply
    const t = (this.petriNet.transitions || []).find(x => x.id === transitionId);
    if (!t) return this.getCurrentState();
    const inputArcs = (this.petriNet.arcs || []).filter(a => (a.targetId === transitionId || a.target === transitionId) && (a.sourceType === 'place' || !a.sourceType));
    const outputArcs = (this.petriNet.arcs || []).filter(a => (a.sourceId === transitionId || a.source === transitionId) && (a.targetType === 'place' || !a.targetType));
    const placesById = Object.fromEntries((this.petriNet.places || []).map(p => [p.id, p]));
    const guardAst = this.cache.guardAstByTransition.get(transitionId);

    const result = await findSatisfyingAssignment({
      transition: t,
      inputArcs,
      placesById,
      bindingAstsByArc: this.cache.bindingAstsByArc,
      guardAst,
      parseArithmetic,
      evaluateBooleanPredicate: evaluateBooleanPredicateWithPool,
      matchPattern,
      getTokensForPlace,
      evaluateArithmeticWithBindings,
      evaluateBooleanWithBindings,
      evaluatePatternLiteral,
      maxTokensPerPlace: this._config.maxTokensPerPlace,
    });
    if (!result) throw new Error(`Transition ${transitionId} is not enabled`);
    let env = result.env || {};
    const picks = result.picks || [];

    // If guard has free variables, try to solve the guard to bind them before producing outputs
    if (guardAst) {
      const free = getUnboundBooleanGuardVars(guardAst, env);
      if (free.length > 0) {
        try {
          // Use SAT check to see if any assignment exists; if so, keep env as-is
          const ok = await evaluateBooleanPredicateWithPool(guardAst, env, parseArithmetic);
          if (!ok) throw new Error('Guard unsatisfied under any extension');
        } catch (_) { /* ignore */ }
      }
    }

    // Track which places will change for cache invalidation
    const changedPlaces = new Set();
    for (const pick of picks) {
      changedPlaces.add(pick.srcId);
    }
    for (const arc of outputArcs) {
      changedPlaces.add(arc.targetId || arc.target);
    }

    // Consume tokens
    // When multiple tokens from the same place are consumed, remove by descending
    // indices to avoid index-shift bugs.
    consumeTokens(picks, placesById);

    // Produce tokens on outputs
    produceTokens(
      outputArcs,
      this.cache.bindingAstsByArc,
      env,
      placesById,
      {
        evaluateArithmeticWithBindings,
        evaluateBooleanWithBindings,
        evaluatePatternLiteral,
        parseArithmetic,
      }
    );

    // Apply transition action if provided: action like "y = x + 1, z = x - 1"
    if (t.action && typeof t.action === 'string') {
      try {
        const assignments = evaluateAction(t.action, env, parseArithmetic);
        // No direct store for variables; actions only affect produced token expressions above.
        // If future semantics require, we could apply assignments to outputs here.
      } catch (_) { /* ignore action errors */ }
    }

    // Invalidate enabled cache for transitions connected to changed places
    this._invalidateEnabledCache(changedPlaces);

    // Skip expensive checks if firing in batch mode (caller will handle after all fires complete)
    if (!skipEnabledCheck) {
      await this.checkTransitionStateChanges();
      const newState = this.getCurrentState();
      // Emit transitionFired via shared event bus
      this.emitTransitionFired({ transitionId, newPetriNet: newState });
      // Emit transitionsChanged with parity payload
      const enabledAfter = await this.getEnabledTransitionsSpecific();
      this.emitTransitionsChanged({ enabled: enabledAfter, previouslyEnabled });
      return newState;
    }

    return this.getCurrentState();
  }

  getCurrentState() {
    return getCurrentStateNormalized(this.petriNet);
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
    this._config.maxTokensPerPlace = Infinity;
    this._clearEnabledCache();
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
// getTokensForPlace, isPair now imported from ../../utils/token-utils

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



