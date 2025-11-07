/**
 * Simulator Core - Factory-based, pure JS implementation
 * Replaces legacy Pyodide-based core
 */

import { SimulatorFactory } from './SimulatorFactory.js';
import { logger } from '../../utils/logger.js';
import { runHeadlessSimulation } from './core/headlessRunner.js';
import {
  determineNetMode as determineCoreNetMode,
  detectNetModeFromContent as detectCoreNetMode,
} from './core/netModeDetection.js';

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
      logger.debug('SimulatorCore.initialize called with:', { petriNet, options });
      const netMode = determineCoreNetMode(petriNet, options);
      
      // Always create a fresh simulator to avoid stale state
      // This ensures proper reinitialization when loading the same net multiple times
      this.currentSimulator = SimulatorFactory.createSimulator(netMode);
      
      this.netMode = netMode;
      if (this.eventBus) this.currentSimulator.setEventBus(this.eventBus);
      await this.currentSimulator.initialize(petriNet, options);
      this._ready = true;
      this.setupPendingListeners();
      logger.debug(`Simulator initialized with ${netMode} simulator`);
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
  async runToCompletion({
    mode = 'single',
    maxSteps = 100000,
    timeBudgetMs = 30000,
    yieldEvery = 100,
    onProgress,
    shouldCancel,
    batchMax = 0,
    progressEveryMs = 0,
    yieldEveryMs = 0,
  } = {}) {
    if (!this.currentSimulator) throw new Error('Simulator not initialized');
    // Detach event bus to suppress per-step emissions
    const prevBus = this.currentSimulator.eventBus || null;
    try {
      if (this.currentSimulator.setEventBus) this.currentSimulator.setEventBus(null);
    } catch (_) {}

    try {
      if (this.currentSimulator.setSimulationMode) this.currentSimulator.simulationMode = mode;
      return await runHeadlessSimulation({
        simulator: this.currentSimulator,
        mode,
        maxSteps,
        timeBudgetMs,
        yieldEvery,
        onProgress,
        shouldCancel,
        batchMax,
        progressEveryMs,
        yieldEveryMs,
      });
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
    logger.debug(`Simulation activated (continuous: ${continuous})`);
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
    return determineCoreNetMode(petriNet, options);
  }

  detectNetModeFromContent(petriNet) {
    return detectCoreNetMode(petriNet);
  }

}

export const simulatorCore = new SimulatorCore();
export default simulatorCore;
