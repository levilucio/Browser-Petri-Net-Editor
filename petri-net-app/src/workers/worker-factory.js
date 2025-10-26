export function createSimulationWorker() {
  try {
    if (typeof window === 'undefined') return null;
    if (typeof Worker === 'undefined') return null;
    // Avoid creating workers during Jest tests
    if (typeof process !== 'undefined' && process.env && (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test')) {
      return null;
    }
    // Use dynamic Function string to avoid "import.meta" parse errors in CJS/Jest
    // eslint-disable-next-line no-new-func
    const factory = new Function(
      'return new Worker(new URL("../workers/simulation.worker.js", import.meta.url), { type: "module" })'
    );
    const w = factory();
    return w || null;
  } catch (err) {
    try {
      // Fallback: try absolute path (works in some dev servers)
      const w2 = new Worker('/src/workers/simulation.worker.js', { type: 'module' });
      return w2 || null;
    } catch (_) {
      return null;
    }
  }
}


