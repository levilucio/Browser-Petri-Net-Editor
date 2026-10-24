import { evaluateGround, substitute, variablesIn } from './SymbolicTerms.js';

// A deliberately small exact fragment. Strings, ADT selectors, operation calls
// and validity predicates fall back to Z3 rather than widening this proof rule.
const binary = new Set(['+', '-', '*', '==', '!=', '<', '<=', '>', '>=', 'and', 'or', 'xor', 'implies', 'iff']);
function supported(t, before) {
  if (typeof t === 'boolean' || Number.isSafeInteger(t)) return true;
  if (!t || typeof t !== 'object' || Array.isArray(t)) return false;
  const keys = Object.keys(t);
  if (keys.length === 1 && typeof t.var === 'string') return true;
  if (keys.length === 1 && Array.isArray(t.termGraph)) return t.termGraph.every((node, index) => supported(node, index));
  if (keys.length === 1 && Number.isSafeInteger(t.graphRef) && t.graphRef >= 0 && t.graphRef < before) return true;
  if (keys.length === 3 && Object.hasOwn(t, 'if') && Object.hasOwn(t, 'then') && Object.hasOwn(t, 'else')) {
    return supported(t.if, before) && supported(t.then, before) && supported(t.else, before);
  }
  if (t.op === 'not' && keys.length === 2 && Object.hasOwn(t, 'left')) return supported(t.left, before);
  return binary.has(t.op) && keys.length === 3 && Object.hasOwn(t, 'left') && Object.hasOwn(t, 'right') && supported(t.left, before) && supported(t.right, before);
}

/** Refute only the joint numeric-value-1 preference, never the original query.
 * A whole conjunct must be independent of every unfixed variable. Inconclusive
 * evaluation (including exact-integer overflow) is not an UNSAT proof.
 */
export function refutesNumericPreference(conditions, names) {
  const ones = new Map(names.map(name => [name, 1]));
  for (const condition of conditions) {
    try {
      if (!supported(condition) || [...variablesIn(condition)].some(name => !ones.has(name))) continue;
      if (evaluateGround(substitute(condition, ones)) === false) return true;
    } catch { /* Unsupported, partial or unrepresentable: retain the SMT fallback. */ }
  }
  return false;
}
