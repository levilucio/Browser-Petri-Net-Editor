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
    this._config = { maxTokensPerPlace: 20 };
  }

  /**
   * Get simulator type
   */
  getType() {
    return 'algebraic';
  }

  async initializeSpecific(petriNet, options = {}) {
    this.petriNet = deepCloneNet(petriNet);
    if (options && typeof options.maxTokensPerPlace === 'number') {
      this._config.maxTokensPerPlace = options.maxTokensPerPlace | 0;
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
        if (process.env.NODE_ENV !== 'production') {
          console.log('Output arc has no bindings, disabling transition');
        }
        return true; // Disable transition
      }
      
      for (const astObj of bindingAsts) {
        const { kind, ast } = astObj;
        if (kind === 'pattern' && ast.type === 'var') {
          // Only check variables - literals like 'int', 'boolLit', 'pairPattern' are always valid
          if (!boundVariables.has(ast.name)) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('Unbound variable in output arc:', ast.name);
            }
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
        case 'listPattern':
          if (Array.isArray(node.elements)) {
            node.elements.forEach(traverse);
          }
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
      evaluateBooleanPredicate,
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

    const result = await findSatisfyingAssignment({
      transition: t,
      inputArcs,
      placesById,
      bindingAstsByArc: this.cache.bindingAstsByArc,
      guardAst,
      parseArithmetic,
      evaluateBooleanPredicate,
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
          const ok = await evaluateBooleanPredicate(guardAst, env, parseArithmetic);
          if (!ok) throw new Error('Guard unsatisfied under any extension');
        } catch (_) { /* ignore */ }
      }
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



