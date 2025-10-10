// Normalize Petri net state to a consistent shape across simulators

export function getCurrentStateNormalized(petriNet) {
  const places = (petriNet.places || []).map(p => ({
    id: p.id,
    label: p.label || '',
    tokens: Number(Array.isArray(p.valueTokens) ? p.valueTokens.length : (p.tokens || 0)),
    x: Number(p.x || 0),
    y: Number(p.y || 0),
    name: p.name || '',
    type: 'place',
    valueTokens: Array.isArray(p.valueTokens) ? [...p.valueTokens] : undefined,
  }));
  const transitions = (petriNet.transitions || []).map(t => ({
    id: t.id,
    label: t.label || '',
    x: Number(t.x || 0),
    y: Number(t.y || 0),
    name: t.name || '',
    type: 'transition',
    guard: t.guard,
    action: t.action,
  }));
  const placeIds = new Set(places.map(p => p.id));
  const transitionIds = new Set(transitions.map(t => t.id));
  const arcs = (petriNet.arcs || []).map(a => {
    const s = a.sourceId || a.source;
    const t = a.targetId || a.target;
    const inferredSourceType = placeIds.has(s) ? 'place' : (transitionIds.has(s) ? 'transition' : (a.sourceType || 'place'));
    const inferredTargetType = placeIds.has(t) ? 'place' : (transitionIds.has(t) ? 'transition' : (a.targetType || 'transition'));
    const type = a.type || `${inferredSourceType}-to-${inferredTargetType}`;
    return {
      id: a.id,
      sourceId: s,
      targetId: t,
      source: s,
      target: t,
      weight: Number(a.weight || 1),
      sourceType: inferredSourceType,
      targetType: inferredTargetType,
      type,
      bindings: Array.isArray(a.bindings) ? [...a.bindings] : (a.binding ? [a.binding] : []),
    };
  });
  return { places, transitions, arcs };
}


