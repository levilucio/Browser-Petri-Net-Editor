/**
 * Detect net mode from imported JSON content.
 * Returns 'algebraic-int' if algebraic features are found, otherwise 'pt'.
 */
export function detectNetModeFromContent(net) {
  if (!net || typeof net !== 'object') return 'pt';
  const places = Array.isArray(net.places) ? net.places : [];
  const transitions = Array.isArray(net.transitions) ? net.transitions : [];
  const arcs = Array.isArray(net.arcs) ? net.arcs : [];

  const hasAlgebraic = (
    places.some(p => (Array.isArray(p.valueTokens) && p.valueTokens.length > 0) || !!p.type) ||
    transitions.some(t => !!t.guard || !!t.action) ||
    arcs.some(a => (Array.isArray(a.bindings) && a.bindings.length > 0) || !!a.binding)
  );
  return hasAlgebraic ? 'algebraic-int' : 'pt';
}


