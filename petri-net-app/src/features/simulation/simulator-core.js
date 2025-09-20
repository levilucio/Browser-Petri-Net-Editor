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

  determineNetMode(petriNet, options) { const m = options?.netMode || petriNet?.netMode; if (m) return (m === 'algebraic-int') ? 'algebraic' : m; return this.detectNetModeFromContent(petriNet); }
  detectNetModeFromContent(petriNet) {
    const net = petriNet || {};
    const transitions = Array.isArray(net.transitions) ? net.transitions : [];
    const arcs = Array.isArray(net.arcs) ? net.arcs : [];
    const places = Array.isArray(net.places) ? net.places : [];
    // Heuristics: any guard/action with arithmetic or boolean operators, or any typed binding, or any place valueTokens
    for (const t of transitions) {
      if (typeof t.guard === 'string' && t.guard.trim().length > 0) return 'algebraic';
      if (typeof t.action === 'string' && t.action.trim().length > 0) return 'algebraic';
    }
    for (const a of arcs) {
      const bs = Array.isArray(a.bindings) ? a.bindings : (a.binding ? [a.binding] : []);
      if (bs.some(b => typeof b === 'string' && (/:[ ]*(integer|boolean)/i.test(b) || b === 'T' || b === 'F' || /[+\-*/()]/.test(b)))) return 'algebraic';
    }
    if (places.some(p => Array.isArray(p.valueTokens) && p.valueTokens.length > 0)) return 'algebraic';
    return 'pt';
  }
}

export const simulatorCore = new SimulatorCore();
export default simulatorCore;
