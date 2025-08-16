/**
 * Core Simulator Interface
 * Provides the main interface for Petri net simulation operations
 * Only uses the Python simulator via Pyodide
 */

import { PyodideSimulator } from './pyodide-simulator';
import { ConflictResolver } from './conflict-resolver';

// Global state management
let simulator = null;
let currentPetriNet = null;
let simulationActive = false;

// Configuration
const MIN_INIT_INTERVAL = 2000; // Minimum time between initialization attempts
let isInitializing = false;
let lastInitTime = 0;

/**
 * Core simulator interface
 */
export class SimulatorCore {
  constructor() {
    this.conflictResolver = new ConflictResolver();
  }

  /**
   * Initialize the simulator with a Petri net
   */
  async initialize(petriNet, options = {}) {
    // Only initialize when we have actual Petri net elements and at least one arc
    if (!petriNet || !petriNet.places || !petriNet.transitions || !petriNet.arcs ||
        petriNet.places.length === 0 || petriNet.transitions.length === 0 || petriNet.arcs.length === 0) {
      console.log('Insufficient Petri net data for initialization, skipping...');
      return;
    }
    
    console.log('Initializing simulator with Petri net data...');
    
    // Use provided Petri net data
    const netData = petriNet;

    // If already initializing, wait for it to complete or force restart
    if (isInitializing) {
      console.log('Simulator initialization already in progress, waiting for completion...');
      // Wait a bit for current initialization to complete
      let waitCount = 0;
      while (isInitializing && waitCount < 50) { // Wait up to 5 seconds
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      
      // If still initializing after waiting, force restart
      if (isInitializing) {
        console.log('Initialization taking too long, forcing restart...');
        this.reset();
      }
    }

    const now = Date.now();
    if (lastInitTime && (now - lastInitTime) < MIN_INIT_INTERVAL) {
      console.log('Simulator initialization too recent, but forcing restart due to new data...');
      // Don't skip - force restart for new data
    }

    // Check if we already have a working simulator with the same Petri net
    if (simulator && currentPetriNet && 
        simulator.getStatus && 
        simulator.getStatus().isInitialized &&
        JSON.stringify(currentPetriNet) === JSON.stringify(petriNet)) {
      console.log('Simulator already initialized with same Petri net, skipping...');
      return;
    }

    isInitializing = true;
    lastInitTime = now;
    
    try {
      currentPetriNet = netData;
      console.log('Initializing Pyodide simulator with Petri net:', netData.places?.length || 0, 'places,', netData.transitions?.length || 0, 'transitions');
      
      // Only use Pyodide simulator
      const pyodideSim = new PyodideSimulator();
      await pyodideSim.initialize(netData, options);
      
      // Verify the simulator is actually ready before assigning it
      if (!pyodideSim.isInitialized) {
        throw new Error('Pyodide simulator initialization completed but isInitialized is false');
      }
      
      simulator = pyodideSim;
      console.log('Pyodide simulator initialized successfully');
      
    } catch (error) {
      console.error('Pyodide simulator initialization failed:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  }

  /**
   * Get enabled transitions
   */
  async getEnabledTransitions() {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }

    try {
      return await simulator.getEnabledTransitions();
    } catch (error) {
      console.error('Error getting enabled transitions:', error);
      throw error;
    }
  }

  /**
   * Check if a transition is enabled
   */
  async isTransitionEnabled(transitionId) {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }

    try {
      return await simulator.isTransitionEnabled(transitionId);
    } catch (error) {
      console.error('Error checking transition enabled:', error);
      throw error;
    }
  }

  /**
   * Fire a transition
   */
  async fireTransition(transitionId) {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }

    try {
      return await simulator.fireTransition(transitionId);
    } catch (error) {
      console.error('Error firing transition:', error);
      throw error;
    }
  }

  /**
   * Execute one simulation step
   */
  async stepSimulation() {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }

    try {
      return await simulator.stepSimulation();
    } catch (error) {
      console.error('Error executing simulation step:', error);
      throw error;
    }
  }

  /**
   * Fire multiple transitions
   */
  async fireMultipleTransitions(transitionIds) {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }

    try {
      return await simulator.fireMultipleTransitions(transitionIds);
    } catch (error) {
      console.error('Error firing multiple transitions:', error);
      throw error;
    }
  }

  /**
   * Update simulator with new Petri net state
   */
  async update(petriNet) {
    // Check if we have valid Petri net data before proceeding
    if (!petriNet || !petriNet.places || !petriNet.transitions || !petriNet.arcs ||
        petriNet.places.length === 0 || petriNet.transitions.length === 0 || petriNet.arcs.length === 0) {
      console.log('Insufficient Petri net data for update, skipping...');
      return;
    }

    if (!simulator) {
      console.log('No simulator instance, initializing...');
      try {
        await this.initialize(petriNet, { maxTokens: 20 });
        return;
      } catch (error) {
        console.error('Failed to initialize simulator during update:', error);
        // Don't throw error for insufficient data - this is expected during Petri net construction
        if (error.message.includes('insufficient Petri net data') || 
            error.message.includes('invalid Petri net structure') ||
            error.message.includes('missing required IDs')) {
          console.log('Simulator initialization skipped due to incomplete Petri net data');
          return;
        }
        throw new Error('Simulator initialization failed during update');
      }
    }

    if (!this.isReady()) {
      console.log('Simulator not ready, attempting to reinitialize...');
      try {
        // Reset and reinitialize
        this.reset();
        await this.initialize(petriNet, { maxTokens: 20 });
        return;
      } catch (error) {
        console.error('Failed to reinitialize simulator during update:', error);
        throw new Error('Simulator not ready and reinitialization failed');
      }
    }

    // Check if the Petri net has actually changed
    // More reliable change detection - check if the core structure has actually changed
    if (currentPetriNet && 
        currentPetriNet.places && petriNet.places &&
        currentPetriNet.transitions && petriNet.transitions &&
        currentPetriNet.arcs && petriNet.arcs &&
        currentPetriNet.places.length === petriNet.places.length &&
        currentPetriNet.transitions.length === petriNet.transitions.length &&
        currentPetriNet.arcs.length === petriNet.arcs.length) {
      console.log('Petri net structure unchanged, skipping update');
      return;
    }

    try {
      console.log('Updating simulator with new Petri net state...');
      await simulator.update(petriNet);
      currentPetriNet = petriNet;
      console.log('Simulator update completed successfully');
    } catch (error) {
      console.error('Error updating simulator:', error);
      // Try to reinitialize if update fails
      try {
        console.log('Update failed, attempting to reinitialize...');
        this.reset();
        await this.initialize(petriNet, { maxTokens: 20 });
      } catch (reinitError) {
        console.error('Reinitialization after update failure also failed:', reinitError);
        throw new Error('Simulator update failed and reinitialization failed');
      }
    }
  }

  /**
   * Activate simulation mode
   */
  async activateSimulation(continuous = false) {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }

    simulationActive = true;
    console.log('Simulation mode activated');
  }

  /**
   * Deactivate simulation mode
   */
  deactivateSimulation() {
    simulationActive = false;
    console.log('Simulation mode deactivated');
  }

  /**
   * Get simulator type
   */
  getSimulatorType() {
    // Always return 'pyodide' if we have any simulator instance
    // This prevents the UI from getting stuck waiting for 'none'
    if (simulator) {
      return 'pyodide';
    }
    
    // If no simulator exists yet, return 'pyodide' to indicate it's available
    // This allows the initialization process to proceed
    return 'pyodide';
  }

  /**
   * Get simulator status
   */
  getSimulatorStatus() {
    return {
      simulatorType: this.getSimulatorType(),
      isInitializing,
      lastInitTime,
      hasCurrentPetriNet: !!currentPetriNet,
      simulationActive,
      simulatorStatus: simulator?.getStatus ? {
        ...simulator.getStatus(),
        simulator: simulator // Expose the simulator instance for event listening
      } : null
    };
  }

  /**
   * Check if simulator is ready
   */
  async isReady() {
    if (!simulator) {
      return false;
    }
    
    if (!simulator.getStatus) {
      return false;
    }
    
    const status = simulator.getStatus();
    
    // Simulator is ready if it has basic components
    // The simulation panel activation is now handled by event listeners
    return status.isInitialized && 
           status.hasPyodide &&
           status.hasSimulator;
  }

  /**
   * Get current Petri net
   */
  getCurrentPetriNet() {
    return currentPetriNet;
  }

  /**
   * Set simulation mode
   */
  async setSimulationMode(mode) {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }

    try {
      await simulator.setSimulationMode(mode);
      console.log('Simulation mode changed to:', mode);
    } catch (error) {
      console.error('Error setting simulation mode:', error);
      throw error;
    }
  }

  /**
   * Get current simulation mode
   */
  getSimulationMode() {
    if (!simulator) {
      return 'single';
    }
    return simulator.simulationMode || 'single';
  }

  /**
   * Reset simulator state
   */
  reset() {
    simulator = null;
    currentPetriNet = null;
    simulationActive = false;
    isInitializing = false;
    lastInitTime = 0;
    console.log('Simulator state reset');
  }

  /**
   * Force create a basic simulator instance
   * Only creates simulator when there are enabled transitions to simulate
   */
  async forceCreateSimulator() {
    if (simulator) {
      console.log('Simulator already exists, skipping creation');
      return;
    }
    
    console.log('forceCreateSimulator called, but simulator will only be created when there are enabled transitions');
    // Don't create simulator yet - wait for actual Petri net with enabled transitions
  }
}

// Export singleton instance
export default new SimulatorCore();
