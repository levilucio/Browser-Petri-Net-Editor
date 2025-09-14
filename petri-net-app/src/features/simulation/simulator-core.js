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
    try { return await this.currentSimulator.stepSimulation(); }
    catch (error) { console.error('Failed to step simulation:', error); throw error; }
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

  determineNetMode(petriNet, options) { if (options?.netMode) return options.netMode; if (petriNet?.netMode) return petriNet.netMode; return this.detectNetModeFromContent(petriNet); }
  detectNetModeFromContent(petriNet) { const { transitions = [] } = petriNet || {}; for (const t of transitions) { if (t.guard && typeof t.guard === 'string' && (t.guard.includes('+') || t.guard.includes('-') || t.guard.includes('*') || t.guard.includes('/') || t.guard.includes('=') || t.guard.includes('<') || t.guard.includes('>') || t.guard.includes('!='))) return 'algebraic'; if (t.action && typeof t.action === 'string' && (t.action.includes('+') || t.action.includes('-') || t.action.includes('*') || t.action.includes('/') || t.action.includes('='))) return 'algebraic'; } return 'pt'; }
}

export const simulatorCore = new SimulatorCore();
export default simulatorCore;
