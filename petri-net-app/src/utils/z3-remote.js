let workerPool = [];
let nextId = 1;
const pending = new Map();
let poolSize = 0;
let idleTimer = null;

// Default config; will be overridden from UI
const z3Config = {
  minWorkers: 1,
  maxWorkers: 2,
  idleTimeoutMs: 300000,
  prewarmOnAlgebraicMode: true,
};

export function setZ3WorkerConfig(cfg = {}) {
  if (typeof cfg.minWorkers === 'number') z3Config.minWorkers = Math.max(0, cfg.minWorkers | 0);
  if (typeof cfg.maxWorkers === 'number') z3Config.maxWorkers = Math.max(1, cfg.maxWorkers | 0);
  if (typeof cfg.idleTimeoutMs === 'number') z3Config.idleTimeoutMs = Math.max(1000, cfg.idleTimeoutMs | 0);
  if (typeof cfg.prewarmOnAlgebraicMode === 'boolean') z3Config.prewarmOnAlgebraicMode = cfg.prewarmOnAlgebraicMode;
  ensureMinWorkers();
}

function createWorker() {
  const w = new Worker(new URL('../workers/z3.worker.js', import.meta.url), { type: 'module' });
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

function ensureMinWorkers() {
  while (workerPool.length < Math.min(z3Config.minWorkers, z3Config.maxWorkers)) {
    workerPool.push(createWorker());
  }
}

function getWorker() {
  if (workerPool.length === 0) {
    workerPool.push(createWorker());
  }
  // simple round-robin
  const w = workerPool[poolSize % workerPool.length];
  poolSize++;
  return w;
}

function tickIdleTimer() {
  if (z3Config.idleTimeoutMs <= 0) return;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    // Keep minWorkers alive
    while (workerPool.length > Math.min(z3Config.minWorkers, z3Config.maxWorkers)) {
      const w = workerPool.pop();
      try { w.terminate(); } catch (_) {}
    }
  }, z3Config.idleTimeoutMs);
}

function call(op, ...args) {
  const w = getWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try { w.postMessage({ id, op, args }); } catch (err) { pending.delete(id); reject(err); }
    tickIdleTimer();
  });
}

// Public API mirroring local z3-arith exports
export const parseBooleanExpr = (s) => call('parseBooleanExpr', s);
export const evaluateBooleanPredicate = (astOrStr, env, _parseArithmeticIgnored) => call('evaluateBooleanPredicate', astOrStr, env);
export const evaluateArithmeticWithBindings = (astOrStr, env, _parseArithmeticIgnored) => call('evaluateArithmeticWithBindings', astOrStr, env);
export const evaluateAction = (text, env) => call('evaluateAction', text, env);
export const solveEquation = (l, r) => call('solveEquation', l, r);
export const solveInequality = (l, r) => call('solveInequality', l, r);


