/**
 * SATEL Test Generator Web Worker
 * Runs test generation in background to avoid blocking UI
 */

import { generateTestSuite } from '../satel/core/TestGenerator.js';
import { AlgebraicSimulator } from '../features/simulation/algebraic-simulator.js';

let currentAbortController = null;

self.onmessage = async function(e) {
  const { type, payload } = e.data;
  
  if (type === 'GENERATE') {
    try {
      // Create abort controller for cancellation
      currentAbortController = new AbortController();
      
      const { testIntentions, petriNet, options } = payload;
      
      // Create simulator instance
      const simulator = new AlgebraicSimulator();
      
      // Send progress updates
      let processedIntentions = 0;
      const totalIntentions = testIntentions.length;
      
      // Wrap options with progress callback
      const wrappedOptions = {
        ...options,
        signal: currentAbortController.signal,
        onProgress: (progress) => {
          self.postMessage({
            type: 'PROGRESS',
            payload: {
              current: progress.current || processedIntentions,
              total: totalIntentions,
              message: progress.message || `Processing intention ${processedIntentions + 1}/${totalIntentions}`
            }
          });
        }
      };
      
      // Generate test suite
      const suite = await generateTestSuite(
        testIntentions,
        petriNet,
        simulator,
        wrappedOptions
      );
      
      self.postMessage({
        type: 'SUCCESS',
        payload: suite
      });
      
    } catch (error) {
      if (error.name === 'AbortError') {
        self.postMessage({
          type: 'CANCELLED'
        });
      } else {
        self.postMessage({
          type: 'ERROR',
          payload: {
            message: error.message,
            stack: error.stack
          }
        });
      }
    } finally {
      currentAbortController = null;
    }
  } else if (type === 'CANCEL') {
    if (currentAbortController) {
      currentAbortController.abort();
    }
  }
};
