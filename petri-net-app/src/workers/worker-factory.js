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


