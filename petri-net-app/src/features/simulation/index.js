/**
 * Simulation Module Index
 * Exports all simulation-related functionality
 */

// Primary exports (new core under legacy names)
export { default as simulatorCore } from './simulator-core.js';
export { default as useSimulationManager } from './useSimulationManager.js';
export { simulationEventBus } from './SimulationEventBus.js';
export { SimulatorFactory } from './SimulatorFactory.js';
export { BaseSimulator } from './BaseSimulator.js';
export { PTSimulator } from './pt-simulator.js';
export { AlgebraicSimulator } from './algebraic-simulator.js';

// Conflict resolution
export { ConflictResolver } from './conflict-resolver';

// Utilities
export {
  validatePetriNet,
  deepClonePetriNet,
  comparePetriNetStates,
  getMarkingVector,
  isDeadlock,
  toPNML,
  fromPNML,
  getSimulationStats
} from './simulation-utils';

// Legacy exports no longer needed; Pyodide removed
