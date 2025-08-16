/**
 * Simulation Module Index
 * Exports all simulation-related functionality
 */

// Core simulator
import simulatorCoreInstance, { SimulatorCore } from './simulator-core';
export { simulatorCoreInstance as simulatorCore, SimulatorCore };

// Individual simulators
export { PyodideSimulator } from './pyodide-simulator';

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

// Legacy export for backward compatibility
export { default } from './simulator-core';
