/**
 * Base class for all Petri net simulators
 * Provides a common interface and shared functionality
 */
import { SimulationEvents } from './SimulationEventBus.js';

export class BaseSimulator {
  constructor() {
    this.isInitialized = false;
    this.petriNet = null;
    this.eventBus = null;
    this.simulationMode = 'single'; // 'single' or 'maximal'
  }

  /**
   * Initialize the simulator with a Petri net
   * @param {Object} petriNet - The Petri net structure
   * @param {Object} options - Configuration options
   */
  async initialize(petriNet, options = {}) {
    if (!this.validatePetriNet(petriNet)) {
      throw new Error('Invalid Petri net structure');
    }
    
    this.petriNet = petriNet;
    this.isInitialized = true;
    this.simulationMode = options.simulationMode || 'single';
    
    // Initialize simulator-specific logic
    await this.initializeSpecific(petriNet, options);
  }

  /**
   * Simulator-specific initialization
   * Override in subclasses
   */
  async initializeSpecific(petriNet, options) {
    // Override in subclasses
  }

  /**
   * Update the Petri net structure
   * @param {Object} petriNet - Updated Petri net structure
   */
  async update(petriNet) {
    if (!this.isInitialized) {
      throw new Error('Simulator not initialized');
    }
    
    if (!this.validatePetriNet(petriNet)) {
      throw new Error('Invalid Petri net structure');
    }
    
    this.petriNet = petriNet;
    await this.updateSpecific(petriNet);
  }

  /**
   * Simulator-specific update logic
   * Override in subclasses
   */
  async updateSpecific(petriNet) {
    // Override in subclasses
  }

  /**
   * Get enabled transitions
   * @returns {Array} Array of enabled transition IDs
   */
  async getEnabledTransitions() {
    if (!this.isInitialized) {
      return [];
    }
    return await this.getEnabledTransitionsSpecific();
  }

  /**
   * Simulator-specific enabled transitions logic
   * Override in subclasses
   */
  async getEnabledTransitionsSpecific() {
    return [];
  }

  /**
   * Fire a specific transition
   * @param {string} transitionId - ID of the transition to fire
   * @returns {Object} Updated Petri net structure
   */
  async fireTransition(transitionId) {
    if (!this.isInitialized) {
      throw new Error('Simulator not initialized');
    }
    
    const enabled = await this.getEnabledTransitions();
    if (!enabled.includes(transitionId)) {
      throw new Error(`Transition ${transitionId} is not enabled`);
    }
    
    return await this.fireTransitionSpecific(transitionId);
  }

  /**
   * Simulator-specific transition firing logic
   * Override in subclasses
   */
  async fireTransitionSpecific(transitionId) {
    // Override in subclasses
    return this.petriNet;
  }

  /**
   * Execute one simulation step
   * @returns {Object} Updated Petri net structure
   */
  async stepSimulation() {
    if (!this.isInitialized) {
      throw new Error('Simulator not initialized');
    }
    
    return await this.stepSimulationSpecific();
  }

  /**
   * Simulator-specific step simulation logic
   * Override in subclasses
   */
  async stepSimulationSpecific() {
    // Override in subclasses
    return this.petriNet;
  }

  /**
   * Reset the simulator
   */
  reset() {
    this.isInitialized = false;
    this.petriNet = null;
    this.simulationMode = 'single';
    this.resetSpecific();
  }

  /**
   * Simulator-specific reset logic
   * Override in subclasses
   */
  resetSpecific() {
    // Override in subclasses
  }

  /**
   * Set the event bus for communication
   * @param {Object} eventBus - Event bus instance
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Emit transitionsChanged in a consistent shape via the shared event bus
   * @param {{enabled: string[], previouslyEnabled?: string[], hasEnabled?: boolean}} payload
   */
  emitTransitionsChanged(payload = {}) {
    if (!this.eventBus) return;
    const enabled = Array.isArray(payload.enabled) ? payload.enabled : [];
    const previouslyEnabled = Array.isArray(payload.previouslyEnabled) ? payload.previouslyEnabled : [];
    const hasEnabled = typeof payload.hasEnabled === 'boolean' ? payload.hasEnabled : enabled.length > 0;
    this.eventBus.emit(SimulationEvents.transitionsChanged, { enabled, previouslyEnabled, hasEnabled });
  }

  /**
   * Emit transitionFired in a consistent shape via the shared event bus
   * @param {{transitionId: string, newPetriNet?: object}} payload
   */
  emitTransitionFired(payload = {}) {
    if (!this.eventBus) return;
    const { transitionId, newPetriNet } = payload || {};
    if (!transitionId) return;
    this.eventBus.emit(SimulationEvents.transitionFired, { transitionId, newPetriNet });
  }

  /**
   * Get simulator type
   * @returns {string} Simulator type identifier
   */
  getType() {
    throw new Error('getType() must be implemented by subclasses');
  }

  /**
   * Validate Petri net structure
   * @param {Object} petriNet - Petri net to validate
   * @returns {boolean} True if valid
   */
  validatePetriNet(petriNet) {
    if (!petriNet || typeof petriNet !== 'object') {
      return false;
    }
    
    const { places, transitions, arcs } = petriNet;
    
    if (!Array.isArray(places) || !Array.isArray(transitions) || !Array.isArray(arcs)) {
      return false;
    }
    
    // Basic validation - can be extended by subclasses
    return true;
  }

  /**
   * Check if simulator is ready
   * @returns {boolean} True if ready
   */
  isReady() {
    return this.isInitialized && this.petriNet !== null;
  }

  /**
   * Get simulation statistics
   * @returns {Object} Simulation statistics
   */
  getSimulationStats() {
    if (!this.isInitialized) {
      return { enabledTransitions: [], totalTokens: 0, totalPlaces: 0, totalTransitions: 0 };
    }
    
    const { places, transitions } = this.petriNet;
    const totalTokens = places.reduce((sum, place) => sum + (place.tokens || 0), 0);
    
    return {
      enabledTransitions: [],
      totalTokens,
      totalPlaces: places.length,
      totalTransitions: transitions.length
    };
  }
}
