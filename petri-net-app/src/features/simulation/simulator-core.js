/**
 * Core Simulator Interface
 * Provides the main interface for Petri net simulation operations
 * Coordinates between Python and JavaScript simulators
 */

import { loadPyodideInstance } from '../../utils/pyodide-loader';
import { JsPetriNetSimulator } from './js-simulator';
import { PythonSimulator } from './python-simulator';
import { ConflictResolver } from './conflict-resolver';

// Global state management
let pyodideInstance = null;
let simulator = null;
let pyodideLoading = null;
let currentPetriNet = null;
let useJsFallback = false;
let pyodideLoadError = null;
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
    if (isInitializing) {
      console.log('Simulator initialization already in progress, skipping...');
      return;
    }

    const now = Date.now();
    if (lastInitTime && (now - lastInitTime) < MIN_INIT_INTERVAL) {
      console.log('Simulator initialization too recent, skipping...');
      return;
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
      currentPetriNet = petriNet;
      console.log('Initializing simulator with Petri net:', petriNet.places?.length || 0, 'places,', petriNet.transitions?.length || 0, 'transitions');
      
      // Reset fallback flag for new initialization
      useJsFallback = false;
      
      try {
        // Try Python simulator first
        if (!useJsFallback) {
          const pythonSim = new PythonSimulator();
          await pythonSim.initialize(petriNet, options);
          simulator = pythonSim;
          console.log('Python simulator initialized successfully');
          return;
        }
      } catch (error) {
        console.warn('Python simulator failed, falling back to JavaScript:', error);
        useJsFallback = true;
      }

      // Fallback to JavaScript simulator
      try {
        simulator = new JsPetriNetSimulator(petriNet, options);
        console.log('JavaScript simulator initialized as fallback');
      } catch (error) {
        console.error('JavaScript simulator also failed:', error);
        throw error;
      }
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
    return await simulator.getEnabledTransitions();
  }

  /**
   * Check if a transition is enabled
   */
  async isTransitionEnabled(transitionId) {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    return await simulator.isTransitionEnabled(transitionId);
  }

  /**
   * Fire a single transition
   */
  async fireTransition(transitionId) {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    return await simulator.fireTransition(transitionId);
  }

  /**
   * Fire multiple transitions
   */
  async fireMultipleTransitions(transitionIds) {
    if (!simulator) {
      throw new Error('Simulator not initialized');
    }
    return await simulator.fireMultipleTransitions(transitionIds);
  }

  /**
   * Check for conflicts between transitions
   */
  async areTransitionsInConflict(transition1Id, transition2Id, places, arcs) {
    return this.conflictResolver.areTransitionsInConflict(
      transition1Id, transition2Id, places, arcs
    );
  }

  /**
   * Find non-conflicting transitions
   */
  async findNonConflictingTransitions(enabledTransitions, places, arcs) {
    return this.conflictResolver.findNonConflictingTransitions(
      enabledTransitions, places, arcs
    );
  }

  /**
   * Update simulator with new Petri net state
   */
  async update(petriNet) {
    currentPetriNet = petriNet;
    if (simulator && simulator.update) {
      await simulator.update(petriNet);
    }
  }

  /**
   * Get the type of simulator currently in use
   */
  getSimulatorType() {
    if (!simulator) {
      return 'none';
    }
    
    if (simulator instanceof PythonSimulator) {
      return 'python';
    } else if (simulator instanceof JsPetriNetSimulator) {
      return 'javascript';
    } else {
      return 'unknown';
    }
  }

  /**
   * Get simulator status for debugging
   */
  getSimulatorStatus() {
    return {
      simulatorType: this.getSimulatorType(),
      isInitializing,
      lastInitTime,
      hasCurrentPetriNet: !!currentPetriNet,
      useJsFallback,
      simulationActive,
      simulatorStatus: simulator?.getStatus ? simulator.getStatus() : null
    };
  }

  /**
   * Check if using fallback
   */
  isUsingFallback() {
    return useJsFallback;
  }

  /**
   * Initialize simulator for simulation mode
   */
  async _initializeForSimulation() {
    if (!currentPetriNet) {
      throw new Error('No Petri net available for simulation');
    }

    try {
      if (!useJsFallback) {
        const pythonSim = new PythonSimulator();
        await pythonSim.initialize(currentPetriNet, { maxTokens: 20 });
        simulator = pythonSim;
        console.log('Python simulator initialized for simulation mode');
        return;
      }
    } catch (error) {
      console.warn('Python simulator failed during simulation initialization:', error);
      useJsFallback = true;
    }

    // Fallback to JavaScript simulator
    try {
      simulator = new JsPetriNetSimulator(currentPetriNet, { maxTokens: 20 });
      console.log('JavaScript simulator initialized as fallback for simulation');
    } catch (error) {
      console.error('JavaScript simulator failed during simulation initialization:', error);
      throw error;
    }
  }

  /**
   * Activate simulation mode
   */
  async activateSimulation(forceInitialize = true) {
    simulationActive = true;
    console.log('Simulation mode activated');
    
    // Reset fallback flag to try Pyodide first
    useJsFallback = false;
    
    if (currentPetriNet) {
      try {
        // Check if we already have a working simulator
        if (simulator && simulator.getStatus && simulator.getStatus().isInitialized) {
          console.log('Using existing working simulator instance - no initialization needed');
          return;
        }
        
        if (forceInitialize || !simulator) {
          console.log(`${forceInitialize ? 'Force initializing' : 'Initializing'} simulator for simulation mode`);
          await this._initializeForSimulation();
          console.log('Simulator initialized for simulation mode');
        } else {
          console.log('Using existing simulator instance - skipping initialization');
        }
      } catch (error) {
        console.error('Error initializing simulator for simulation:', error);
        // Create a minimal fallback simulator
        simulator = {
          getEnabledTransitions: () => [],
          fireTransition: () => currentPetriNet,
          isTransitionEnabled: () => false,
          update: () => Promise.resolve(),
          getStatus: () => ({ isInitialized: false, type: 'fallback' })
        };
      }
    }
    return null;
  }

  /**
   * Deactivate simulation mode
   */
  deactivateSimulation() {
    simulationActive = false;
    console.log('Simulation mode deactivated');
    
    if (useJsFallback && !pyodideLoadError) {
      useJsFallback = false;
    }
    
    if (currentPetriNet) {
      simulator = new JsPetriNetSimulator(currentPetriNet);
    }
    
    return null;
  }

  /**
   * Check if simulation is active
   */
  isSimulationActive() {
    return simulationActive;
  }

  /**
   * Get current Petri net
   */
  getCurrentPetriNet() {
    return currentPetriNet;
  }
}

// Export singleton instance
export const simulatorCore = new SimulatorCore();

// Legacy export for backward compatibility
export { simulatorCore as default };
