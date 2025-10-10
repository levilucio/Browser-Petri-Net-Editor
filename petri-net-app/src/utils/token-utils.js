// Utilities for working with algebraic tokens

export function getTokensForPlace(place, cap = 20) {
  if (!place) return [];
  if (Array.isArray(place.valueTokens)) {
    return place.valueTokens.slice(0, cap);
  }
  const n = Number(place.tokens || 0);
  if (Number.isFinite(n) && n > 0) {
    return Array.from({ length: Math.min(n, cap) }, () => 1);
  }
  return [];
}

export function isPair(v) {
  return !!(v && typeof v === 'object' && v.__pair__ === true && 'fst' in v && 'snd' in v);
}


