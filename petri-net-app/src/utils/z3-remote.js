let workerPool = [];
let nextId = 1;
const pending = new Map();
let roundRobinIndex = 0;
let idleTimer = null;

const workerSupported = typeof Worker !== 'undefined';

// Check if SharedArrayBuffer is available (required for Z3 workers)
const sharedArrayBufferSupported = typeof SharedArrayBuffer !== 'undefined';

const z3Config = {
  poolSize: 0,
  idleTimeoutMs: 300000,
  prewarmOnAlgebraicMode: true,
  solverTimeoutMs: 10000,
};

function publishConfig() {
  try {
    if (typeof globalThis !== 'undefined') {
      const target = globalThis;
      target.__Z3_SETTINGS__ = { ...(target.__Z3_SETTINGS__ || {}), ...z3Config };
    }
  } catch (_) {}
}

function normalizePoolSize(value) {
  return Math.max(0, (Number.isFinite(value) ? value : 0) | 0);
}

export function setZ3WorkerConfig(cfg = {}) {
  if (typeof cfg.poolSize === 'number') z3Config.poolSize = normalizePoolSize(cfg.poolSize);
  if (typeof cfg.idleTimeoutMs === 'number') z3Config.idleTimeoutMs = Math.max(1000, cfg.idleTimeoutMs | 0);
  if (typeof cfg.prewarmOnAlgebraicMode === 'boolean') z3Config.prewarmOnAlgebraicMode = cfg.prewarmOnAlgebraicMode;
  if (typeof cfg.solverTimeoutMs === 'number') z3Config.solverTimeoutMs = Math.max(0, cfg.solverTimeoutMs | 0);
  ensurePoolCapacity();
}

function createWorker() {
  if (!workerSupported) throw new Error('Z3 worker pool unavailable in this environment');
  if (!sharedArrayBufferSupported) {
    throw new Error('SharedArrayBuffer not available. COOP/COEP headers may not be set correctly.');
  }
  const w = new Worker(new URL('../../workers/z3.worker.js', import.meta.url), { type: 'module' });
  w.onerror = (err) => {
    console.error('Z3 worker error:', err);
  };
  w.onmessage = ({ data }) => {
    const { id, ok, result, error } = data || {};
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    ok ? entry.resolve(result) : entry.reject(new Error(error));
    tickIdleTimer();
  };
  return w;
}

function ensurePoolCapacity() {
  publishConfig();
  if (!workerSupported) {
    return;
  }
  const target = normalizePoolSize(z3Config.poolSize);
  while (workerPool.length < target) {
    workerPool.push(createWorker());
  }
  while (workerPool.length > target) {
    const w = workerPool.pop();
    try { w.terminate(); } catch (_) {}
  }
}

function getWorker() {
  if (!workerSupported) throw new Error('Z3 worker pool unavailable in this environment');
  const target = normalizePoolSize(z3Config.poolSize);
  if (target <= 0) throw new Error('Z3 worker pool disabled');
  if (workerPool.length === 0) {
    workerPool.push(createWorker());
  }
  const w = workerPool[roundRobinIndex % workerPool.length];
  roundRobinIndex++;
  return w;
}

function tickIdleTimer() {
  if (!workerSupported) return;
  if (z3Config.idleTimeoutMs <= 0) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    const target = normalizePoolSize(z3Config.poolSize);
    while (workerPool.length > target) {
      const w = workerPool.pop();
      try { w.terminate(); } catch (_) {}
    }
  }, z3Config.idleTimeoutMs);
}

function call(op, ...args) {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Z3 worker operation "${op}" timed out after ${z3Config.solverTimeoutMs}ms`));
    }, z3Config.solverTimeoutMs || 10000);
    
    pending.set(id, { 
      resolve: (result) => {
        clearTimeout(timeout);
        resolve(result);
      }, 
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    });
    
    try {
      w.postMessage({ id, op, args });
    } catch (err) {
      clearTimeout(timeout);
      pending.delete(id);
      reject(err);
      return;
    }
    tickIdleTimer();
  });
}

export function getConfiguredPoolSize() {
  return normalizePoolSize(z3Config.poolSize);
}

export function isWorkerPoolEnabled() {
  return workerSupported && sharedArrayBufferSupported && normalizePoolSize(z3Config.poolSize) > 0;
}

export function isSharedArrayBufferAvailable() {
  return sharedArrayBufferSupported;
}

export const parseBooleanExpr = (s) => call('parseBooleanExpr', s);
export const evaluateBooleanPredicate = (astOrStr, env, _parseArithmeticIgnored) => call('evaluateBooleanPredicate', astOrStr, env);
export const evaluateArithmeticWithBindings = (astOrStr, env, _parseArithmeticIgnored) => call('evaluateArithmeticWithBindings', astOrStr, env);
export const evaluateAction = (text, env) => call('evaluateAction', text, env);
export const solveEquation = (l, r) => call('solveEquation', l, r);
export const solveInequality = (l, r, op) => call('solveInequality', l, r, op);


