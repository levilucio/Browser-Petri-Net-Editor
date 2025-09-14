/**
 * Simulation Module Index
 * Exports all simulation-related functionality
 */

// NEW ARCHITECTURE - Primary exports
export { newSimulatorCore as simulatorCore } from './NewSimulatorCore.js';
export { default as useSimulationManager } from './NewSimulationManager.js';
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

// Legacy exports for backward compatibility
import simulatorCoreInstance, { SimulatorCore } from './simulator-core';
export { simulatorCoreInstance as legacySimulatorCore, SimulatorCore as LegacySimulatorCore };
export { default as legacySimulatorCoreDefault } from './simulator-core';
export { PyodideSimulator } from './pyodide-simulator';
