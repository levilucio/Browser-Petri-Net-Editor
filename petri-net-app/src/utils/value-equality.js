/** Structural equality of algebraic values, independent of JS object identity. */
export function equalValues(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => equalValues(x, b[i]));
  if (a?.__pair__ || b?.__pair__) return !!a?.__pair__ && !!b?.__pair__ && equalValues(a.fst, b.fst) && equalValues(a.snd, b.snd);
  if (a?.__adt__ || b?.__adt__) return !!a?.__adt__ && !!b?.__adt__ && a.constructor === b.constructor && equalValues(a.args || [], b.args || []);
  return a === b;
}
