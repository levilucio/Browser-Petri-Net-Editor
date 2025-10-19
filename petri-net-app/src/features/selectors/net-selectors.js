export function isAlgebraicNetFromMode(mode) {
  return mode === 'algebraic-int' || mode === 'algebraic';
}

export function isAlgebraicNetFromElements(elements) {
  if (!elements || !Array.isArray(elements.places)) return false;
  return elements.places.some(p => Array.isArray(p.valueTokens));
}

export function isAlgebraicNet(modeOrElements) {
  return typeof modeOrElements === 'string'
    ? isAlgebraicNetFromMode(modeOrElements)
    : isAlgebraicNetFromElements(modeOrElements);
}

export function selectDisplayTokens(place, netMode, formatTokensList) {
  const isAlg = isAlgebraicNetFromMode(netMode) || Array.isArray(place.valueTokens);
  if (isAlg) return formatTokensList(Array.isArray(place.valueTokens) ? place.valueTokens : []);
  return String(Number(place.tokens || 0));
}

export default {
  isAlgebraicNetFromMode,
  isAlgebraicNetFromElements,
  isAlgebraicNet,
  selectDisplayTokens,
};



