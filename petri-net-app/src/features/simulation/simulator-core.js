/**
 * Simulator Core - Factory-based, pure JS implementation
 * Replaces legacy Pyodide-based core
 */

import { SimulatorFactory } from './SimulatorFactory.js';

export class SimulatorCore {
  constructor() {
    this.currentSimulator = null;
    this._ready = false;
    this.netMode = null;
    this.eventBus = null;
    this.pendingListeners = new Map();
  }

  async initialize(petriNet, options = {}) {
    try {
      console.log('SimulatorCore.initialize called with:', { petriNet, options });
      const netMode = this.determineNetMode(petriNet, options);
      const currentType = this.currentSimulator?.getType?.() || null;
      const expectedType = netMode === 'algebraic' ? 'algebraic' : 'pt';
      if (!currentType || currentType !== expectedType) {
        this.currentSimulator = SimulatorFactory.createSimulator(netMode);
      }
      this.netMode = netMode;
      if (this.eventBus) this.currentSimulator.setEventBus(this.eventBus);
      await this.currentSimulator.initialize(petriNet, options);
      this._ready = true;
      this.setupPendingListeners();
      console.log(`Simulator initialized with ${netMode} simulator`);
      return { success: true, netMode, simulatorType: this.currentSimulator.getType() };
    } catch (error) {
      console.error('Failed to initialize simulator:', error);
      this._ready = false;
      this.currentSimulator = null;
      throw error;
    }
  }

  async update(petriNet) {
    if (!this.currentSimulator) return { success: true };
    try {
      await this.currentSimulator.update(petriNet);
      return { success: true };
    } catch (error) {
      console.error('Failed to update simulator:', error);
      throw error;
    }
  }

  async getEnabledTransitions() {
    if (!this.currentSimulator) return [];
    try { return await this.currentSimulator.getEnabledTransitions(); }
    catch (error) { console.error('Failed to get enabled transitions:', error); return []; }
  }

  async fireTransition(transitionId) {
    if (!this.currentSimulator) throw new Error('Simulator not initialized');
    try { return await this.currentSimulator.fireTransition(transitionId); }
    catch (error) { console.error(`Failed to fire transition ${transitionId}:`, error); throw error; }
  }

  async stepSimulation() {
    if (!this.currentSimulator) throw new Error('Simulator not initialized');
    try {
      // Centralized single-step semantics: choose one enabled transition and fire it
      const enabled = await this.currentSimulator.getEnabledTransitions();
      if (!enabled || enabled.length === 0) {
        // No-op: return current state if available
        return this.currentSimulator.petriNet || null;
      }
      const pick = enabled[Math.floor(Math.random() * enabled.length)];
      const transitionId = (typeof pick === 'string') ? pick : (pick && pick.id) ? pick.id : String(pick);
      return await this.currentSimulator.fireTransition(transitionId);
    } catch (error) {
      console.error('Failed to step simulation:', error);
      throw error;
    }
  }

  // Headless run to completion without per-step UI events
  async runToCompletion({ mode = 'single', maxSteps = 100000, timeBudgetMs = 30000, yieldEvery = 100, onProgress, shouldCancel, batchMax = 0, progressEveryMs = 0, yieldEveryMs = 0 } = {}) {
    if (!this.currentSimulator) throw new Error('Simulator not initialized');
    // Detach event bus to suppress per-step emissions
    const prevBus = this.currentSimulator.eventBus || null;
    try {
      if (this.currentSimulator.setEventBus) this.currentSimulator.setEventBus(null);
    } catch (_) {}

    try {
      if (this.currentSimulator.setSimulationMode) this.currentSimulator.simulationMode = mode;
      const now = (typeof performance !== 'undefined' && performance.now) ? () => performance.now() : () => Date.now();
      const startTs = now();
      let steps = 0;
      let lastProgressTs = startTs;
      let lastYieldTs = startTs;

      const tinyYield = async () => {
        try { await new Promise((res) => setTimeout(res, 0)); } catch (_) {}
        try {
          if (typeof requestAnimationFrame !== 'undefined') {
            await new Promise((res) => requestAnimationFrame(() => res()));
          }
        } catch (_) {}
      };

      let lastReported = -1;

      const emitProgress = (ts) => {
        if (!onProgress) return;
        const elapsed = ts - startTs;
        const bucket = progressEveryMs > 0 ? Math.floor(elapsed / progressEveryMs) : 0;
        if (bucket === lastReported) return;
        lastReported = bucket;
        try {
          onProgress({ steps, elapsedMs: elapsed });
        } catch (_) {}
      };

      const handleStepProgress = async () => {
        if (shouldCancel && shouldCancel()) return false;
        const currentTs = now();
        const elapsed = currentTs - startTs;

        if (yieldEvery > 0 && steps % yieldEvery === 0) {
          const beforeYield = now();
          emitProgress(beforeYield);
          await tinyYield();
          const afterYield = now();
          lastYieldTs = afterYield;
          lastProgressTs = afterYield;
          if (progressEveryMs > 0) emitProgress(afterYield);
          if (timeBudgetMs > 0 && (afterYield - startTs) > timeBudgetMs) return false;
          if (shouldCancel && shouldCancel()) return false;
          return true;
        }

        if (progressEveryMs > 0 && (currentTs - lastProgressTs) >= progressEveryMs) {
          emitProgress(currentTs);
          lastProgressTs = currentTs;
        }

        if (yieldEveryMs > 0 && (currentTs - lastYieldTs) >= yieldEveryMs) {
          await tinyYield();
          const afterYield = now();
          lastYieldTs = afterYield;
          if (progressEveryMs > 0 && (afterYield - lastProgressTs) >= progressEveryMs) {
            emitProgress(afterYield);
            lastProgressTs = afterYield;
          }
          if (timeBudgetMs > 0 && (afterYield - startTs) > timeBudgetMs) return false;
          if (shouldCancel && shouldCancel()) return false;
        }

        if (timeBudgetMs > 0 && elapsed > timeBudgetMs) return false;
        if (shouldCancel && shouldCancel()) return false;
        return true;
      };

      // Pre-compute isolated transitions (no inputs and no outputs) so that
      // headless runs can ignore them and terminate if only isolated nodes remain.
      const computeIsolatedTransitions = (net) => {
        const isolated = new Set();
        if (!net || !Array.isArray(net.transitions)) return isolated;
        const arcs = Array.isArray(net.arcs) ? net.arcs : [];
        const places = Array.isArray(net.places) ? net.places : [];
        const placeIds = new Set(places.map(p => String(p.id)));
        
        for (const t of net.transitions) {
          const tId = String(t.id);
          let hasInput = false;
          let hasOutput = false;
          for (const a of arcs) {
            const src = String(a.sourceId || a.source);
            const tgt = String(a.targetId || a.target);
            
            // Check if this arc connects to the transition
            if (tgt === tId && src !== tId && placeIds.has(src)) {
              // This is an input arc (place -> transition)
              hasInput = true;
            }
            if (src === tId && tgt !== tId && placeIds.has(tgt)) {
              // This is an output arc (transition -> place)
              hasOutput = true;
            }
            if (hasInput && hasOutput) break;
          }
          if (!hasInput && !hasOutput) isolated.add(tId);
        }
        return isolated;
      };

      // Compute once; net structure (arcs/transitions) does not change during run
      const isolatedIds = computeIsolatedTransitions(this.currentSimulator.petriNet || {});

      const getEnabledIds = async () => {
        const enabled = await this.currentSimulator.getEnabledTransitions();
        const ids = (enabled || []).map(t => (typeof t === 'string') ? t : (t && t.id) ? t.id : String(t));
        return ids.filter((id) => !isolatedIds.has(String(id)));
      };

      let continueRunning = true;
      while (continueRunning && steps < maxSteps) {
        if (shouldCancel && shouldCancel()) break;
        const enabledIds = await getEnabledIds();
        if (!enabledIds || enabledIds.length === 0) break;

        if (mode === 'maximal') {
          const net = this.currentSimulator.petriNet || {};
          const cap = (batchMax > 0) ? batchMax : Number.POSITIVE_INFINITY;
          let batch = chooseGreedyNonConflicting(enabledIds, net.arcs || [], cap);
          if (!batch || batch.length === 0) {
            const fallback = enabledIds[Math.floor(Math.random() * enabledIds.length)];
            batch = fallback ? [fallback] : [];
          }
          // Fire all non-conflicting transitions in parallel for maximum throughput
          if (shouldCancel && shouldCancel()) { continueRunning = false; break; }
          // Skip enabled checks during parallel firing to avoid cache thrashing
          await Promise.all(batch.map(id => this.currentSimulator.fireTransition(id, { skipEnabledCheck: true })));
          steps += batch.length;
          continueRunning = await handleStepProgress();
        } else {
          const pick = enabledIds[Math.floor(Math.random() * enabledIds.length)];
          await this.currentSimulator.fireTransition(pick);
          steps++;
          continueRunning = await handleStepProgress();
        }
      }

      if (onProgress) {
        try { onProgress({ steps, elapsedMs: now() - startTs }); } catch (_) {}
      }
      return { petriNet: this.currentSimulator.petriNet || null, steps };
    } finally {
      try { if (this.currentSimulator.setEventBus) this.currentSimulator.setEventBus(prevBus); } catch (_) {}
    }
  }

  reset() {
    if (this.currentSimulator) this.currentSimulator.reset();
    this.currentSimulator = null;
    this._ready = false;
    this.netMode = null;
    this.pendingListeners.clear();
  }

  deactivateSimulation() { this._active = false; }

  activateSimulation(continuous = false) {
    if (!this.currentSimulator) throw new Error('Simulator not initialized');
    console.log(`Simulation activated (continuous: ${continuous})`);
  }

  async isReady() { return this._ready && this.currentSimulator && this.currentSimulator.isReady(); }

  getSimulatorStatus() { return { isReady: this._ready, netMode: this.netMode, simulatorType: this.currentSimulator?.getType() || 'none', simulatorStatus: { simulator: this.currentSimulator } }; }

  getSimulatorType() { return this.currentSimulator?.getType() || 'none'; }

  getSimulationMode() { return this.currentSimulator?.simulationMode || 'single'; }
  setSimulationMode(mode) { if (this.currentSimulator) this.currentSimulator.simulationMode = mode; }

  setEventBus(eventBus) { this.eventBus = eventBus; if (this.currentSimulator) this.currentSimulator.setEventBus(eventBus); }
  __queueListener(event, callback) { if (!this.pendingListeners.has(event)) this.pendingListeners.set(event, []); this.pendingListeners.get(event).push(callback); }
  setupPendingListeners() { if (!this.currentSimulator || !this.eventBus) return; for (const [event, cbs] of this.pendingListeners) { for (const cb of cbs) this.eventBus.on(event, cb); } this.pendingListeners.clear(); }

  determineNetMode(petriNet, options) { 
    console.log('determineNetMode called with:', { petriNet, options });
    const m = options?.netMode || petriNet?.netMode; 
    console.log('Found netMode from options/petriNet:', m);
    if (m) {
      const result = (m === 'algebraic-int') ? 'algebraic' : m;
      console.log('Using configured netMode:', result);
      return result;
    }
    console.log('No configured netMode, detecting from content');
    return this.detectNetModeFromContent(petriNet); 
  }
  detectNetModeFromContent(petriNet) {
    const net = petriNet || {};
    const transitions = Array.isArray(net.transitions) ? net.transitions : [];
    const arcs = Array.isArray(net.arcs) ? net.arcs : [];
    const places = Array.isArray(net.places) ? net.places : [];
    
    console.log('Net mode detection:', { places, transitions, arcs });
    
    // Heuristics: any guard/action with arithmetic or boolean operators, or any typed binding, or any place valueTokens
    for (const t of transitions) {
      if (typeof t.guard === 'string' && t.guard.trim().length > 0) {
        console.log('Found guard, using algebraic mode');
        return 'algebraic';
      }
      if (typeof t.action === 'string' && t.action.trim().length > 0) {
        console.log('Found action, using algebraic mode');
        return 'algebraic';
      }
    }
    for (const a of arcs) {
      const bs = Array.isArray(a.bindings) ? a.bindings : (a.binding ? [a.binding] : []);
      console.log('Checking arc bindings:', bs);
      if (bs.some(b => typeof b === 'string' && (/:[ ]*(integer|boolean)/i.test(b) || b === 'T' || b === 'F' || /[+\-*/()]/.test(b)))) {
        console.log('Found algebraic binding, using algebraic mode');
        return 'algebraic';
      }
    }
    if (places.some(p => Array.isArray(p.valueTokens) && p.valueTokens.length > 0)) {
      console.log('Found valueTokens, using algebraic mode');
      return 'algebraic';
    }
    console.log('Using P/T mode');
    return 'pt';
  }

}

// Greedy non-conflicting set: avoid transitions that share input places
function chooseGreedyNonConflicting(enabledIds, arcs, batchMax) {
  const byT = new Map(); // tId -> Set(inputPlaceIds)
  for (const tId of enabledIds) byT.set(tId, new Set());
  for (const a of (arcs || [])) {
    const tgt = a.targetId || a.target;
    const src = a.sourceId || a.source;
    const placeToTransition = (a.type === 'place-to-transition') || (a.sourceType === 'place');
    if (placeToTransition && byT.has(tgt)) {
      byT.get(tgt).add(src);
    }
  }
  const order = enabledIds.slice();
  for (let i = order.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0; const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  const used = new Set();
  const out = [];
  for (const tId of order) {
    const inputs = byT.get(tId) || new Set();
    let ok = true; for (const p of inputs) { if (used.has(p)) { ok = false; break; } }
    if (!ok) continue;
    out.push(tId);
    for (const p of inputs) used.add(p);
    if (batchMax > 0 && out.length >= batchMax) break;
  }
  return out;
}

export const simulatorCore = new SimulatorCore();
export default simulatorCore;
