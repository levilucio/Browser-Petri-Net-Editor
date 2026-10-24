export function createSimulationWorker() {
  try {
    if (typeof window === 'undefined') return null;
    if (typeof Worker === 'undefined') return null;
    // Avoid creating workers during Jest tests
    if (typeof process !== 'undefined' && process.env && (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test')) {
      return null;
    }
    
    // Standard Vite syntax for worker import
    return new Worker(new URL('./simulation.worker.js', import.meta.url), { type: 'module' });
  } catch (err) {
    console.error('Failed to create simulation worker:', err);
    return null;
  }
}

export function createPtValidationWorker() {
  try {
    if (typeof window === 'undefined') return null;
    if (typeof Worker === 'undefined') return null;
    // Avoid creating workers during Jest tests
    if (typeof process !== 'undefined' && process.env && (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test')) {
      return null;
    }

    return new Worker(new URL('./pt-validation.worker.js', import.meta.url), { type: 'module' });
  } catch (err) {
    console.error('Failed to create pt validation worker:', err);
    return null;
  }
}


/** Return null only for unsupported environments; startup failures are errors. */
export function createSatelWorker() {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  // Z3's Node SDK installs a worker_threads global during Jest execution.
  if (typeof process !== 'undefined' && process.env?.JEST_WORKER_ID) return null;
  return new Worker(new URL('./satel-generator.worker.js', import.meta.url), { type: 'module' });
}
