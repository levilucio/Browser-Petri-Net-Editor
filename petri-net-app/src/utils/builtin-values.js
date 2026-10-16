import { equalValues } from './value-equality.js';

export const methodSorts = ['Nat', 'Int', 'Bool', 'String', 'Pair', 'List'];
export const defaultMethodValue = sort => ({ Nat: 0, Int: 0, Bool: false, String: '', List: [], Pair: { __pair__: true, fst: 0, snd: 0 } })[sort];
export function validBuiltinValue(value, sort, depth = 0) {
  if (depth > 64) return false;
  if (sort === 'Nat' || sort === 'Int') return Number.isInteger(value) && value <= 2147483647 && value >= (sort === 'Nat' ? 0 : -2147483648);
  if (sort === 'Bool') return typeof value === 'boolean';
  if (sort === 'String') return typeof value === 'string';
  if (sort === 'List') return Array.isArray(value) && value.every(v => validBuiltinValue(v, 'Any', depth + 1));
  if (sort === 'Pair') return !!value && !Array.isArray(value) && value.__pair__ === true && Object.keys(value).length === 3 && validBuiltinValue(value.fst, 'Any', depth + 1) && validBuiltinValue(value.snd, 'Any', depth + 1);
  if (sort === 'Any') return methodSorts.slice(1).some(s => validBuiltinValue(value, s, depth + 1));
  return false;
}
export function symbolicToValue(t) {
  if (t?.ctor?.startsWith('_Any')) return symbolicToValue(t.args[0]);
  if (t?.ctor === '_ListNil') return [];
  if (t?.ctor === '_ListCons') return [symbolicToValue(t.args[0]), ...symbolicToValue(t.args[1])];
  if (t?.ctor === '_Pair') return { __pair__: true, fst: symbolicToValue(t.args[0]), snd: symbolicToValue(t.args[1]) };
  if (t?.ctor) return { __adt__: true, constructor: t.ctor, args: t.args.map(symbolicToValue) };
  return t;
}
// Place markings are multisets: order is irrelevant, multiplicity is significant.
export function equalTokenBags(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const remaining = [...b];
  return a.every(value => { const index = remaining.findIndex(v => equalValues(value, v)); if (index < 0) return false; remaining.splice(index, 1); return true; });
}

export function builtinValueKey(value) {
  const canonical = v => Array.isArray(v) ? v.map(canonical) : v?.__pair__ ? { __pair__: true, fst: canonical(v.fst), snd: canonical(v.snd) } : v;
  return JSON.stringify(canonical(value));
}
