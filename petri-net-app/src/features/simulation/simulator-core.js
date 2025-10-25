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
  async runToCompletion({ mode = 'single', maxSteps = 100000, timeBudgetMs = 30000, yieldEvery = 100, onProgress, shouldCancel, batchMax = 0 } = {}) {
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

      const getEnabledIds = async () => {
        const enabled = await this.currentSimulator.getEnabledTransitions();
        return (enabled || []).map(t => (typeof t === 'string') ? t : (t && t.id) ? t.id : String(t));
      };
      while (steps < maxSteps) {
        if (shouldCancel && shouldCancel()) break;
        const enabledIds = await getEnabledIds();
        if (!enabledIds || enabledIds.length === 0) break;

        if (mode === 'maximal' && batchMax > 0) {
          const net = this.currentSimulator.petriNet || {};
          const batch = chooseGreedyNonConflicting(enabledIds, net.arcs || [], batchMax);
          for (const id of batch) {
            if (shouldCancel && shouldCancel()) break;
            await this.currentSimulator.fireTransition(id);
            steps++;
          }
        } else {
          const pick = enabledIds[Math.floor(Math.random() * enabledIds.length)];
          await this.currentSimulator.fireTransition(pick);
          steps++;
        }

        if (steps % yieldEvery === 0) {
          if (onProgress) { onProgress({ steps, elapsedMs: now() - startTs }); }
          // Yield to browser to keep UI responsive and allow paints
          try { await new Promise((res) => setTimeout(res, 0)); } catch (_) {}
          try {
            if (typeof requestAnimationFrame !== 'undefined') {
              await new Promise((res) => requestAnimationFrame(() => res()));
            }
          } catch (_) {}
          if ((now() - startTs) > timeBudgetMs) break;
        }
      }
      return this.currentSimulator.petriNet || null;
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
