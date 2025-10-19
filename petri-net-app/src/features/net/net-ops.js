// Centralized net operations (pure functions)

export function deleteNodesAndIncidentArcs(state, nodeIdsOrSelection) {
  const nodeIds = new Set(Array.isArray(nodeIdsOrSelection)
    ? nodeIdsOrSelection.map(x => (typeof x === 'string' ? x : x.id))
    : []);
  const next = { ...state };
  next.places = (state.places || []).filter(p => !nodeIds.has(p.id));
  next.transitions = (state.transitions || []).filter(t => !nodeIds.has(t.id));
  next.arcs = (state.arcs || []).filter(a => !nodeIds.has(a.source) && !nodeIds.has(a.target));
  return next;
}

export function copySelection(state, selection) {
  const selectedNodeIds = new Set((selection || [])
    .filter(se => se.type === 'place' || se.type === 'transition')
    .map(se => se.id));
  const places = (state.places || []).filter(p => selectedNodeIds.has(p.id));
  const transitions = (state.transitions || []).filter(t => selectedNodeIds.has(t.id));
  const arcs = (state.arcs || []).filter(a => selectedNodeIds.has(a.source) && selectedNodeIds.has(a.target));
  return { places, transitions, arcs };
}

export function pasteClipboard(state, clipboard, idFactory, offset = { x: 40, y: 40 }) {
  if (!clipboard) return { next: state, newSelection: [] };
  const idMap = new Map();
  const dx = (offset && typeof offset.x === 'number') ? offset.x : (offset?.dx || 0);
  const dy = (offset && typeof offset.y === 'number') ? offset.y : (offset?.dy || 0);
  const newSelection = [];

  const newPlaces = (clipboard.places || []).map(p => {
    const nid = idFactory();
    idMap.set(p.id, nid);
    const np = { ...p, id: nid, x: p.x + dx, y: p.y + dy };
    newSelection.push({ id: nid, type: 'place' });
    return np;
  });
  const newTransitions = (clipboard.transitions || []).map(t => {
    const nid = idFactory();
    idMap.set(t.id, nid);
    const nt = { ...t, id: nid, x: t.x + dx, y: t.y + dy };
    newSelection.push({ id: nid, type: 'transition' });
    return nt;
  });
  const newArcs = (clipboard.arcs || []).map(a => ({
    ...a,
    id: idFactory(),
    source: idMap.get(a.source),
    target: idMap.get(a.target),
  }));

  const next = {
    ...state,
    places: [...(state.places || []), ...newPlaces],
    transitions: [...(state.transitions || []), ...newTransitions],
    arcs: [...(state.arcs || []), ...newArcs],
  };
  return { next, newSelection };
}

export default {
  deleteNodesAndIncidentArcs,
  copySelection,
  pasteClipboard,
};


