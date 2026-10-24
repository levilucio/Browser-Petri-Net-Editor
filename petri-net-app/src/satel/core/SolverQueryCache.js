import { checkCancelled, DomainError } from '../../domain/diagnostics.js';

// Refuse lossy JSON keys (NaN, undefined fields, exotic objects, etc.). Such
// requests still reach the adapter, but can neither read nor populate the cache.
const exactJSON = value => JSON.stringify(value, function (key, v) {
  if (this[key] !== v || v === undefined || typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint' ||
    typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0)) ||
    v && typeof v === 'object' && !Array.isArray(v) && ![Object.prototype, null].includes(Object.getPrototypeOf(v))) {
    throw new Error('Not a lossless JSON cache value');
  }
  return v;
});

/** Per-adapter LRU of complete answers, never promises or Z3 handles. Algebra
 * and solver settings must be fixed by the owner. Keys retain names, sorts,
 * term/condition order, graph structure and witness mode; no semantic merging.
 * The character cap covers serialized keys + answers, not JS heap overhead. */
export function withSolverQueryCache(backend, validateWitness, options = {}) {
  const setting = options.solverQueryCache;
  if (setting !== undefined && typeof setting !== 'boolean' && (!setting || typeof setting !== 'object' || Array.isArray(setting))) {
    throw new DomainError('invalid-options', 'solverQueryCache must be a Boolean or cache limits');
  }
  const enabled = setting !== false;
  const maxEntries = setting?.maxEntries ?? 128, maxCharacters = setting?.maxCharacters ?? 1000000;
  if (![maxEntries, maxCharacters].every(n => Number.isSafeInteger(n) && n > 0)) {
    throw new DomainError('invalid-options', 'Solver cache limits must be positive safe integers');
  }
  const entries = new Map(), stats = { enabled, maxEntries, maxCharacters, requests: 0, hits: 0,
    misses: 0, backendCalls: 0, stores: 0, evictions: 0, bypasses: 0, validationFailures: 0,
    entries: 0, retainedCharacters: 0, peakRetainedCharacters: 0 };
  const remove = key => {
    stats.retainedCharacters -= entries.get(key).size;
    entries.delete(key); stats.entries = entries.size;
  };
  const call = async query => {
    stats.backendCalls++;
    const result = await backend(query);
    checkCancelled(options.signal);
    return result;
  };
  const solve = async query => {
    checkCancelled(options.signal); stats.requests++;
    if (!enabled) { stats.bypasses++; return call(query); }
    let key, snapshot;
    try {
      const { terms, conditions, variables, witness = true } = query;
      if (typeof witness !== 'boolean') throw new Error('Non-Boolean witness mode');
      key = exactJSON({ ...(terms === undefined ? {} : { terms }), conditions, variables, witness });
      if (key.length > maxCharacters) throw new Error('Oversized cache key');
      snapshot = JSON.parse(key);
    } catch { stats.bypasses++; return call(query); }
    const cached = entries.get(key);
    if (cached) {
      const result = JSON.parse(cached.answer);
      if (result.bindings) result.bindings = new Map(result.bindings);
      try {
        // A witness hit still checks all used variable sorts and the original
        // conditions, including lazy term-graph definedness.
        if (result.status === 'sat' && snapshot.witness) validateWitness(snapshot, result.bindings);
        checkCancelled(options.signal);
        entries.delete(key); entries.set(key, cached);
        stats.hits++;
        return result;
      } catch (error) {
        if (error.code === 'cancelled') throw error;
        remove(key); stats.validationFailures++;
      }
    }
    stats.misses++;
    const result = await call(snapshot);
    if (result.status !== 'sat' && result.status !== 'unsat') return result;
    // Only the owner can establish SAT/UNSAT. Witnesses have already passed its
    // independent validation on a miss; capture copies before returning them.
    let answer;
    try {
      answer = exactJSON({ ...result, ...(result.bindings ? { bindings: [...result.bindings] } : {}) });
    } catch { return result; }
    const size = key.length + answer.length;
    if (size > maxCharacters) return result;
    // Concurrent identical requests are solved independently. Replace, rather
    // than double-account, an answer installed while this call was awaiting Z3.
    if (entries.has(key)) remove(key);
    while (entries.size >= maxEntries || stats.retainedCharacters + size > maxCharacters) {
      remove(entries.keys().next().value); stats.evictions++;
    }
    entries.set(key, { answer, size }); stats.entries = entries.size;
    stats.retainedCharacters += size; stats.stores++;
    stats.peakRetainedCharacters = Math.max(stats.peakRetainedCharacters, stats.retainedCharacters);
    return result;
  };
  Object.defineProperty(solve, 'cacheStats', { get: () => ({ ...stats }) });
  return solve;
}
