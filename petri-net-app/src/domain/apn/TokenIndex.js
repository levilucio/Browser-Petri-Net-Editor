import { instantiateKnown } from './BoundGuards.js';
import { evaluateMethodTerm } from './MethodTerms.js';
import { foldGroundTerms } from '../algebra/GroundTerms.js';
import { variablesIn } from '../algebra/SymbolicTerms.js';

const accessors = new Set(['_pair_fst', '_pair_snd', '_asInt', '_asBool', '_asString', '_asPair', '_asList']);
const scalarKey = value => ['number', 'boolean', 'string'].includes(typeof value) &&
  (typeof value !== 'number' || Number.isFinite(value)) ? `${typeof value}:${JSON.stringify(value)}` : null;
const selector = (term, variable) => term?.var === variable ||
  accessors.has(term?.call) && term.args?.length === 1 && selector(term.args[0], variable);

/** Necessary equality lookup, never a witness choice. Unknown keys stay in the
 * candidate set. Arrays must be immutable for this invocation-local cache.
 * Occurrence indices and their order are preserved, including duplicates. */
export function createTokenIndex({ symbolic = false, algebra, check = () => {}, profile } = {}) {
  const arrays = new WeakMap(), projections = new WeakMap();
  const reduce = (term, env) => symbolic ? foldGroundTerms(instantiateKnown(term, env), algebra) : evaluateMethodTerm(term, env);
  const safeReduce = (term, env) => { try { return reduce(term, env); } catch { return undefined; } };
  return function candidates(tokens, variable, checks, env, enabled = true) {
    check();
    const fallback = () => { if (profile) profile.indexFallbacks++; return tokens.entries(); };
    if (!enabled) return fallback();
    for (const { term, variables } of checks) {
      // Concrete evaluation is ordered: do not hide an error in an earlier
      // conjunct by rejecting a token using a later equality.
      if (!symbolic && variables.every(v => Object.hasOwn(env, v))) {
        if (safeReduce(term, env) !== true) return fallback();
        continue;
      }
      if (term?.op === '==') for (const [field, other] of [[term.left, term.right], [term.right, term.left]]) {
        if (!selector(field, variable) || [...variablesIn(other)].some(v => v === variable || !Object.hasOwn(env, v))) continue;
        const wanted = scalarKey(safeReduce(other, env));
        if (wanted === null) continue;
        const normalized = instantiateKnown(field, { [variable]: { var: '@token' } });
        const id = JSON.stringify(normalized);
        let indexes = arrays.get(tokens);
        if (!indexes) arrays.set(tokens, indexes = new Map());
        let index = indexes.get(id);
        if (!index) {
          const start = profile ? performance.now() : 0;
          index = { buckets: new Map(), unknown: [] };
          for (let i = 0; i < tokens.length; i++) {
            check();
            const token = tokens[i];
            let cache = token && typeof token === 'object' ? projections.get(token) : null;
            let key;
            if (cache?.has(id)) { key = cache.get(id); if (profile) profile.projectionCacheHits++; }
            else {
              key = scalarKey(safeReduce(normalized, { '@token': token }));
              if (token && typeof token === 'object') {
                if (!cache) projections.set(token, cache = new Map());
                cache.set(id, key);
              }
            }
            if (key === null) index.unknown.push(i);
            else { if (!index.buckets.has(key)) index.buckets.set(key, []); index.buckets.get(key).push(i); }
          }
          indexes.set(id, index);
          if (profile) { profile.indexBuilds++; profile.indexTokens += tokens.length; profile.indexBuildMs += performance.now() - start; }
        }
        const indices = [...(index.buckets.get(wanted) || []), ...index.unknown].sort((a, b) => a - b);
        if (profile) { profile.indexLookups++; profile.indexCandidates += indices.length; profile.indexExcluded += tokens.length - indices.length; }
        return indices.map(i => [i, tokens[i]]);
      }
      if (!symbolic) return fallback();
    }
    return fallback();
  };
}
