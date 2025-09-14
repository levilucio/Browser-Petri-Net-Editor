/**
 * New Simulator Core - Simplified architecture using factory pattern
 * Replaces the old simulator-core.js with a cleaner implementation
 */
import { SimulatorFactory } from './SimulatorFactory.js';

class NewSimulatorCore {
  constructor() {
    this.currentSimulator = null;
    this._ready = false;
    this.netMode = null;
    this.eventBus = null;
    this.pendingListeners = new Map();
  }

  /**
   * Initialize the simulator with a Petri net
   * @param {Object} petriNet - The Petri net structure
   * @param {Object} options - Configuration options
   */
  async initialize(petriNet, options = {}) {
    try {
      // Determine net mode
      const netMode = this.determineNetMode(petriNet, options);
      
      // If an existing simulator is of a different type, discard it
      const currentType = this.currentSimulator?.getType?.() || null;
      if (!currentType || currentType !== (netMode === 'algebraic' ? 'algebraic' : 'pt')) {
        this.currentSimulator = SimulatorFactory.createSimulator(netMode);
      }
      this.netMode = netMode;
      
      // Set event bus if available
      if (this.eventBus) {
        this.currentSimulator.setEventBus(this.eventBus);
      }
      
      // Initialize the simulator
      await this.currentSimulator.initialize(petriNet, options);
      
      this._ready = true;
      
      // Set up pending listeners
      this.setupPendingListeners();
      
      console.log(`Simulator initialized with ${netMode} simulator`);
      
      return {
        success: true,
        netMode,
        simulatorType: this.currentSimulator.getType()
      };
    } catch (error) {
      console.error('Failed to initialize simulator:', error);
      this._ready = false;
      this.currentSimulator = null;
      throw error;
    }
  }

  /**
   * Update the Petri net structure
   * @param {Object} petriNet - Updated Petri net structure
   */
  async update(petriNet) {
    if (!this.currentSimulator) {
      // No simulator initialized, this is normal when canvas is empty
      return { success: true };
    }
    
    try {
      await this.currentSimulator.update(petriNet);
      return { success: true };
    } catch (error) {
      console.error('Failed to update simulator:', error);
      throw error;
    }
  }

  /**
   * Get enabled transitions
   * @returns {Array} Array of enabled transition IDs
   */
  async getEnabledTransitions() {
    if (!this.currentSimulator) {
      return [];
    }
    
    try {
      return await this.currentSimulator.getEnabledTransitions();
    } catch (error) {
      console.error('Failed to get enabled transitions:', error);
      return [];
    }
  }

  /**
   * Fire a specific transition
   * @param {string} transitionId - ID of the transition to fire
   * @returns {Object} Updated Petri net structure
   */
  async fireTransition(transitionId) {
    if (!this.currentSimulator) {
      throw new Error('Simulator not initialized');
    }
    
    try {
      return await this.currentSimulator.fireTransition(transitionId);
    } catch (error) {
      console.error(`Failed to fire transition ${transitionId}:`, error);
      throw error;
    }
  }

  /**
   * Execute one simulation step
   * @returns {Object} Updated Petri net structure
   */
  async stepSimulation() {
    if (!this.currentSimulator) {
      throw new Error('Simulator not initialized');
    }
    
    try {
      return await this.currentSimulator.stepSimulation();
    } catch (error) {
      console.error('Failed to step simulation:', error);
      throw error;
    }
  }

  /**
   * Reset the simulator
   */
  reset() {
    if (this.currentSimulator) {
      this.currentSimulator.reset();
    }
    this.currentSimulator = null;
    this._ready = false;
    this.netMode = null;
    this.pendingListeners.clear();
  }

  /**
   * Deactivate simulation
   */
  deactivateSimulation() {
    // No-op for now; keep simulator initialized so UI remains interactive
    // Future: toggle an internal active flag if needed
    this._active = false;
  }

  /**
   * Activate simulation
   * @param {boolean} continuous - Whether to run continuously
   */
  activateSimulation(continuous = false) {
    if (!this.currentSimulator) {
      throw new Error('Simulator not initialized');
    }
    
    // Activation logic can be added here if needed
    console.log(`Simulation activated (continuous: ${continuous})`);
  }

  /**
   * Check if simulator is ready
   * @returns {boolean} True if ready
   */
  async isReady() {
    return this._ready && this.currentSimulator && this.currentSimulator.isReady();
  }

  /**
   * Get simulator status
   * @returns {Object} Simulator status information
   */
  getSimulatorStatus() {
    return {
      isReady: this._ready,
      netMode: this.netMode,
      simulatorType: this.currentSimulator?.getType() || 'none',
      simulatorStatus: {
        simulator: this.currentSimulator
      }
    };
  }

  /**
   * Get simulator type
   * @returns {string} Simulator type
   */
  getSimulatorType() {
    return this.currentSimulator?.getType() || 'none';
  }

  /**
   * Get simulation mode
   * @returns {string} Simulation mode
   */
  getSimulationMode() {
    return this.currentSimulator?.simulationMode || 'single';
  }

  /**
   * Set simulation mode
   * @param {string} mode - Simulation mode ('single' or 'maximal')
   */
  setSimulationMode(mode) {
    if (this.currentSimulator) {
      this.currentSimulator.simulationMode = mode;
    }
  }

  /**
   * Set event bus
   * @param {Object} eventBus - Event bus instance
   */
  setEventBus(eventBus) {
    this.eventBus = eventBus;
    if (this.currentSimulator) {
      this.currentSimulator.setEventBus(eventBus);
    }
  }

  /**
   * Queue a listener for when simulator is ready
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  __queueListener(event, callback) {
    if (!this.pendingListeners.has(event)) {
      this.pendingListeners.set(event, []);
    }
    this.pendingListeners.get(event).push(callback);
  }

  /**
   * Set up pending listeners
   */
  setupPendingListeners() {
    if (!this.currentSimulator || !this.eventBus) return;
    
    for (const [event, callbacks] of this.pendingListeners) {
      for (const callback of callbacks) {
        this.eventBus.on(event, callback);
      }
    }
    this.pendingListeners.clear();
  }

  /**
   * Determine the net mode from Petri net or options
   * @param {Object} petriNet - Petri net structure
   * @param {Object} options - Configuration options
   * @returns {string} Net mode
   */
  determineNetMode(petriNet, options) {
    // Priority: options.netMode > petriNet.netMode > content detection
    if (options?.netMode) {
      return options.netMode;
    }
    
    if (petriNet?.netMode) {
      return petriNet.netMode;
    }
    
    // Fallback to content detection
    return this.detectNetModeFromContent(petriNet);
  }

  /**
   * Detect net mode from content
   * @param {Object} petriNet - Petri net structure
   * @returns {string} Detected net mode
   */
  detectNetModeFromContent(petriNet) {
    const { transitions } = petriNet;
    
    // Check for algebraic expressions
    for (const transition of transitions) {
      if (transition.guard && typeof transition.guard === 'string' && 
          (transition.guard.includes('+') || transition.guard.includes('-') || 
           transition.guard.includes('*') || transition.guard.includes('/') ||
           transition.guard.includes('=') || transition.guard.includes('<') ||
           transition.guard.includes('>') || transition.guard.includes('!='))) {
        return 'algebraic';
      }
      
      if (transition.action && typeof transition.action === 'string' && 
          (transition.action.includes('+') || transition.action.includes('-') || 
           transition.action.includes('*') || transition.action.includes('/') ||
           transition.action.includes('='))) {
        return 'algebraic';
      }
    }
    
    // Default to P/T
    return 'pt';
  }
}

// Export singleton instance
export const newSimulatorCore = new NewSimulatorCore();
export default newSimulatorCore;
