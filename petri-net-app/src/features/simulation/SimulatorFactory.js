/**
 * Factory for creating simulator instances based on Petri net type
 */
import { PTSimulator } from './pt-simulator.js';
import { AlgebraicSimulator } from './algebraic-simulator.js';

export class SimulatorFactory {
  /**
   * Create a simulator instance based on the Petri net type
   * @param {string} netMode - The net mode ('pt' or 'algebraic')
   * @returns {BaseSimulator} Simulator instance
   */
  static createSimulator(netMode) {
    switch (netMode) {
      case 'pt':
        return new PTSimulator();
      case 'algebraic':
        return new AlgebraicSimulator();
      default:
        throw new Error(`Unknown net mode: ${netMode}`);
    }
  }

  /**
   * Get available simulator types
   * @returns {Array<string>} Array of available simulator types
   */
  static getAvailableTypes() {
    return ['pt', 'algebraic'];
  }

  /**
   * Check if a simulator type is supported
   * @param {string} netMode - The net mode to check
   * @returns {boolean} True if supported
   */
  static isSupported(netMode) {
    return this.getAvailableTypes().includes(netMode);
  }
}
