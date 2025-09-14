/**
 * Algebraic Petri Net Simulator (integers)
 * Pure JS implementation using Z3 for guards/bindings evaluation.
 * Extends BaseSimulator for consistent interface.
 */

import { BaseSimulator } from './BaseSimulator.js';
import { parseArithmetic } from '../../utils/arith-parser';
import {
  evaluateAction,
  evaluateArithmeticWithBindings,
  evaluatePredicate,
  solveEquation,
  solveInequality,
  parsePredicate
} from '../../utils/z3-arith.js';

export class AlgebraicSimulator extends BaseSimulator {
  constructor() {
    super();
    this.eventListeners = new Map();
    this.lastEnabledTransitions = [];
    this.cache = {
      guardAstByTransition: new Map(),
      bindingAstsByArc: new Map(),
    };
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
          const ast = parsePredicate(String(t.guard), parseArithmetic);
          this.cache.guardAstByTransition.set(t.id, ast);
        } catch (_) {
          // ignore parse errors here; guard will simply be false if unparsable
        }
      }
    }

    for (const a of (this.petriNet.arcs || [])) {
      const key = a.id;
      const bindings = Array.isArray(a.bindings) ? a.bindings : (a.binding ? [a.binding] : []);
      const asts = [];
      for (const b of bindings) {
        try { asts.push(parseArithmetic(String(b))); } catch (_) { /* skip invalid */ }
      }
      if (asts.length) this.cache.bindingAstsByArc.set(key, asts);
    }
  }

  addEventListener(eventType, callback) {
    if (!this.eventListeners.has(eventType)) this.eventListeners.set(eventType, []);
    this.eventListeners.get(eventType).push(callback);
  }

  removeEventListener(eventType, callback) {
    if (!this.eventListeners.has(eventType)) return;
    const arr = this.eventListeners.get(eventType);
    const idx = arr.indexOf(callback);
    if (idx >= 0) arr.splice(idx, 1);
  }

  emitEvent(eventType, data) {
    const arr = this.eventListeners.get(eventType) || [];
    for (const cb of arr) {
      try { cb(data); } catch (e) { /* swallow */ }
    }
  }

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
    // Only rebuild caches if structure changed
    const changed = JSON.stringify(this.petriNet) !== JSON.stringify(petriNet);
    this.petriNet = deepCloneNet(petriNet);
    if (changed) {
      await this.buildCaches();
      await this.checkTransitionStateChanges();
    } else {
      // Even if structure didn't change, when reloading a file we need to recalc enabled transitions
      await this.checkTransitionStateChanges();
    }
  }

  async getEnabledTransitionsSpecific() {
    const enabled = [];
    for (const t of (this.petriNet.transitions || [])) {
      const ok = await this.isTransitionEnabled(t.id);
      if (ok) enabled.push(String(t.id));
    }
    return enabled;
  }

  async isTransitionEnabled(transitionId) {
    if (!this.isInitialized) return false;
    const t = (this.petriNet.transitions || []).find(x => x.id === transitionId);
    if (!t) return false;

    // Gather input arcs (place -> transition)
    const inputArcs = (this.petriNet.arcs || []).filter(a => (a.targetId || a.target) === transitionId && (a.sourceType === 'place' || !a.sourceType));
    if (inputArcs.length === 0) return true; // degenerate: no inputs

    // Pre-parse guard
    const guardAst = this.cache.guardAstByTransition.get(transitionId);

    // Heuristic: try to find any matching selection of tokens satisfying bindings + guard
    const placesById = Object.fromEntries((this.petriNet.places || []).map(p => [p.id, p]));

    // Backtracking search with caps
    const MAX_TOKENS_PER_PLACE = 20;
    const chosen = [];

    const tryArc = async (arcIndex, bindings, env) => {
      if (arcIndex >= inputArcs.length) {
        // Check guard
        if (!guardAst) return true;
        const free = getUnboundGuardVars(guardAst, env);
        if (free.length > 0) {
          return evaluatePredicate(guardAst, env, parseArithmetic);
        }
        return evalGuardPure(guardAst, env);
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
          const ast = bindingAsts[k];
          if (ast) {
            if (ast.type === 'var') {
              if (nextEnv && nextEnv.hasOwnProperty(ast.name) && (nextEnv[ast.name] | 0) !== (tok | 0)) {
                ok = false;
              } else {
                nextEnv = { ...(nextEnv || {}), [ast.name]: tok | 0 };
              }
            } else {
              // If we can evaluate purely with current bindings, require equality; otherwise skip this token
              try {
                const val = evaluateArithmeticWithBindings(ast, localEnv || {});
                if ((val | 0) !== (tok | 0)) ok = false;
              } catch (_) {
                ok = false;
              }
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
    const enabled = await this.getEnabledTransitionsSpecific();
    if (!enabled || enabled.length === 0) return this.getCurrentState();
    const pick = enabled[Math.floor(Math.random() * enabled.length)];
    return this.fireTransitionSpecific(pick);
  }

  async fireTransitionSpecific(transitionId) {
    // A simple re-evaluation: find one satisfying assignment and apply
    const t = (this.petriNet.transitions || []).find(x => x.id === transitionId);
    if (!t) return this.getCurrentState();
    const inputArcs = (this.petriNet.arcs || []).filter(a => (a.targetId || a.target) === transitionId && (a.sourceType === 'place' || !a.sourceType));
    const outputArcs = (this.petriNet.arcs || []).filter(a => (a.sourceId || a.source) === transitionId && (a.targetType === 'place' || !a.targetType));
    const placesById = Object.fromEntries((this.petriNet.places || []).map(p => [p.id, p]));
    const guardAst = this.cache.guardAstByTransition.get(transitionId);

    // Find env + concrete token picks (reuse logic from enable, but record indices)
    const MAX_TOKENS_PER_PLACE = 20;
    const picks = [];

    const tryArc = async (arcIndex, env) => {
      if (arcIndex >= inputArcs.length) {
        if (!guardAst) return { env, picks };
        const free = getUnboundGuardVars(guardAst, env);
        if (free.length > 0) {
          const ok = await evaluatePredicate(guardAst, env, parseArithmetic);
          return ok ? { env, picks } : null;
        }
        const ok = await evalGuardPure(guardAst, env);
        return ok ? { env, picks } : null;
      }
      const arc = inputArcs[arcIndex];
      const arcId = arc.id;
      const srcId = arc.sourceId || arc.source;
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
          const ast = bindingAsts[k];
          if (ast) {
            if (ast.type === 'var') {
              if (nextEnv && nextEnv.hasOwnProperty(ast.name) && (nextEnv[ast.name] | 0) !== (tok | 0)) {
                ok = false;
              } else {
                nextEnv = { ...(nextEnv || {}), [ast.name]: tok | 0 };
              }
            } else {
              try {
                const val = evaluateArithmeticWithBindings(ast, localEnv || {});
                if ((val | 0) !== (tok | 0)) ok = false;
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
      const free = getUnboundGuardVars(guardAst, env);
      if (free.length > 0) {
        try {
          const leftSub = substituteBindings(guardAst.left, env);
          const rightSub = substituteBindings(guardAst.right, env);
          
          let solutions = [];
          if (guardAst.op === '==') {
            // Handle equality
            const result = await solveEquation(leftSub, rightSub, 5);
            solutions = result.solutions || [];
          } else if (['<', '<=', '>', '>=', '!='].includes(guardAst.op)) {
            // Handle inequalities
            const result = await solveInequality(leftSub, rightSub, guardAst.op, 5);
            solutions = result.solutions || [];
          }
          
          // If we found solutions, pick one randomly
          if (solutions.length > 0) {
            const randomSolution = solutions[Math.floor(Math.random() * solutions.length)];
            env = { ...env, ...randomSolution };
          }
        } catch (_) { /* ignore */ }
      }
    }

    // Consume tokens
    for (const pick of picks) {
      const place = placesById[pick.srcId];
      if (pick.countFallback) {
        const current = Number(place.tokens || 0);
        place.tokens = Math.max(0, current - 1);
      } else {
        if (!Array.isArray(place.valueTokens)) place.valueTokens = [];
        place.valueTokens.splice(pick.tokenIndex, 1);
        place.tokens = (place.valueTokens || []).length;
      }
    }

    // Produce tokens on outputs
    for (const arc of outputArcs) {
      const tgtId = arc.targetId || arc.target;
      const place = placesById[tgtId];
      if (!place) continue;
      if (!Array.isArray(place.valueTokens)) place.valueTokens = [];
      const bindingAsts = this.cache.bindingAstsByArc.get(arc.id) || [];
      if (bindingAsts.length > 0) {
        // Push one token per binding evaluation
        for (const ast of bindingAsts) {
          try {
            const v = evaluateArithmeticWithBindings(ast, env);
            if (!Array.isArray(place.valueTokens)) place.valueTokens = [];
            place.valueTokens.push(v | 0);
          } catch (_) { /* skip */ }
        }
      } else if (arc.weight && (arc.weight | 0) > 0) {
        // If no bindings, push 'weight' copies of a default variable if any env var exists; otherwise 1s
        const n = arc.weight | 0;
        for (let i = 0; i < n; i++) {
          // Prefer a bound variable value if exactly one variable exists in env
          const vals = Object.values(env || {});
          if (Array.isArray(place.valueTokens)) {
            place.valueTokens.push(Number.isFinite(vals[0]) ? (vals[0] | 0) : 1);
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
    return this.getCurrentState();
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
        this.emitEvent('transitionsChanged', {
          enabled: currentEnabled,
          previouslyEnabled: prev,
          hasEnabled: currentEnabled.length > 0,
        });
      }
    } catch (_) { /* ignore */ }
  }

  /**
   * Reset simulator-specific state
   */
  resetSpecific() {
    this.eventListeners.clear();
    this.lastEnabledTransitions = [];
    this.cache.guardAstByTransition.clear();
    this.cache.bindingAstsByArc.clear();
  }
}

function deepCloneNet(net) {
  return JSON.parse(JSON.stringify(net || { places: [], transitions: [], arcs: [] }));
}

function evalGuardPure(guardAst, env) {
  try {
    // Simple pure evaluation: rewrite to arithmetic with boolean compare
    // Reconstruct l op r using evaluateArithmeticWithBindings
    const l = evaluateArithmeticWithBindings(guardAst.left, env || {});
    const r = evaluateArithmeticWithBindings(guardAst.right, env || {});
    switch (guardAst.op) {
      case '==': return (l | 0) === (r | 0);
      case '!=': return (l | 0) !== (r | 0);
      case '<': return (l | 0) < (r | 0);
      case '<=': return (l | 0) <= (r | 0);
      case '>': return (l | 0) > (r | 0);
      case '>=': return (l | 0) >= (r | 0);
      default: return false;
    }
  } catch (_) {
    return false;
  }
}

function getUnboundGuardVars(guardAst, env) {
  const names = new Set();
  collectVars(guardAst.left, names);
  collectVars(guardAst.right, names);
  const bound = new Set(Object.keys(env || {}));
  return Array.from(names).filter(n => !bound.has(n));
}

function collectVars(ast, acc) {
  if (!ast) return;
  if (ast.type === 'var') { acc.add(ast.name); return; }
  if (ast.type === 'bin') { collectVars(ast.left, acc); collectVars(ast.right, acc); }
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
// If explicit integer tokens are not provided (valueTokens), fall back to PT count by
// materializing that many tokens with value 1. This keeps APNs usable when only counts are set.
function getTokensForPlace(place, cap = 20) {
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


