/**
 * SATEL - Semi-Automatic Testing Language for Algebraic Petri Nets
 * Main exports
 */

// Core modules
export { generateTestSuite } from './core/TestGenerator.js';

// Increment 1: explicit, bounded oracle-validated path (not the legacy generator).
export { observeBoundedTrace } from './core/BoundedOracleAdapter.js';
export { deriveSymbolicSubdomains } from './core/SymbolicSubuniformity.js';
export {
  generateValidatedSubuniformitySuite, validateOracleCandidates, replayOracleTest,
  evaluateOracleSuite, evaluateSpecMutants,
} from './core/ValidatedSubuniformity.js';

// I/O interface
export {
  markIOType,
  getIOType,
  isInput,
  isOutput,
  getInputPlaces,
  getOutputPlaces,
  getInputTransitions,
  getOutputTransitions,
  extractInterface,
  validateInterface,
  createStimulation,
  createObservation
} from './io/IOInterface.js';

// Test execution
export { executeTestSuite } from './core/TestExecutor.js';
