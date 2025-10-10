// Helpers to normalize Petri net model defaults

export function normalizeNet(petriNet) {
  const net = { places: [], transitions: [], arcs: [], ...(petriNet || {}) };
  net.places = (net.places || []).map(p => ({
    id: p.id,
    x: Number(p.x || 0),
    y: Number(p.y || 0),
    label: p.label || p.name || '',
    name: p.name || p.label || '',
    tokens: Number(Array.isArray(p.valueTokens) ? (p.valueTokens.length) : (p.tokens || 0)),
    valueTokens: Array.isArray(p.valueTokens) ? [...p.valueTokens] : undefined,
  }));
  net.transitions = (net.transitions || []).map(t => ({
    id: t.id,
    x: Number(t.x || 0),
    y: Number(t.y || 0),
    label: t.label || t.name || '',
    name: t.name || t.label || '',
    guard: t.guard,
    action: t.action,
  }));
  net.arcs = (net.arcs || []).map(a => ({
    id: a.id,
    source: a.source || a.sourceId,
    target: a.target || a.targetId,
    weight: Number(a.weight || 1),
    bindings: Array.isArray(a.bindings) ? [...a.bindings] : (a.binding ? [a.binding] : []),
  }));
  return net;
}


