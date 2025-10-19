// Pure utilities for selection and multi-drag calculations

export function isCenterInRect(point, rect) {
  if (!point || !rect) return false;
  const minX = Math.min(rect.x, rect.x + rect.w);
  const minY = Math.min(rect.y, rect.y + rect.h);
  const maxX = Math.max(rect.x, rect.x + rect.w);
  const maxY = Math.max(rect.y, rect.y + rect.h);
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

export function buildSelectionFromRect(elements, rect) {
  if (!elements || !rect) return [];
  const selection = [];
  (elements.places || []).forEach(p => {
    if (isCenterInRect({ x: p.x, y: p.y }, rect)) selection.push({ id: p.id, type: 'place' });
  });
  (elements.transitions || []).forEach(t => {
    if (isCenterInRect({ x: t.x, y: t.y }, rect)) selection.push({ id: t.id, type: 'transition' });
  });
  return selection;
}

export function toggleSelection(selection, item) {
  const exists = selection.some(se => se.id === item.id && se.type === item.type);
  if (exists) return selection.filter(se => !(se.id === item.id && se.type === item.type));
  return [...selection, item];
}

// Applies multi-drag delta using the provided snapshot captured at drag start.
// snapshot: { startPositions: Map(nodeId -> {type, x, y}), startArcPoints: Map(arcId -> [{x,y}, ...]) }
export function applyMultiDragDeltaFromSnapshot(prevState, snapshot, delta, options = {}) {
  if (!snapshot || !snapshot.startPositions) return prevState;
  const { dx, dy } = delta || { dx: 0, dy: 0 };
  const { gridSnappingEnabled = false, snapToGrid = (x, y) => ({ x, y }) } = options;
  const next = { ...prevState };

  next.places = (prevState.places || []).map(p => {
    const s = snapshot.startPositions.get(p.id);
    if (!s || s.type !== 'place') return p;
    const nx = s.x + dx;
    const ny = s.y + dy;
    const pos = gridSnappingEnabled ? snapToGrid(nx, ny) : { x: nx, y: ny };
    return { ...p, x: pos.x, y: pos.y };
  });

  next.transitions = (prevState.transitions || []).map(t => {
    const s = snapshot.startPositions.get(t.id);
    if (!s || s.type !== 'transition') return t;
    const nx = s.x + dx;
    const ny = s.y + dy;
    const pos = gridSnappingEnabled ? snapToGrid(nx, ny) : { x: nx, y: ny };
    return { ...t, x: pos.x, y: pos.y };
  });

  if (snapshot.startArcPoints) {
    next.arcs = (prevState.arcs || []).map(a => {
      const pts = snapshot.startArcPoints.get(a.id);
      if (!pts) return a;
      const movedPts = pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
      return { ...a, anglePoints: movedPts };
    });
  }

  return next;
}

// Simpler variant that applies delta relative to current state (without snapshot).
// Suitable only when delta is the absolute delta from original position AND state updates are based on the original.
export function applyMultiDragDelta(state, selection, delta, options = {}) {
  const { dx, dy } = delta || { dx: 0, dy: 0 };
  const { gridSnappingEnabled = false, snapToGrid = (x, y) => ({ x, y }) } = options;
  const selectedNodeIds = new Set((selection || []).filter(se => se.type === 'place' || se.type === 'transition').map(se => se.id));
  const next = { ...state };
  next.places = (state.places || []).map(p => {
    if (!selectedNodeIds.has(p.id)) return p;
    const nx = p.x + dx;
    const ny = p.y + dy;
    const pos = gridSnappingEnabled ? snapToGrid(nx, ny) : { x: nx, y: ny };
    return { ...p, x: pos.x, y: pos.y };
  });
  next.transitions = (state.transitions || []).map(t => {
    if (!selectedNodeIds.has(t.id)) return t;
    const nx = t.x + dx;
    const ny = t.y + dy;
    const pos = gridSnappingEnabled ? snapToGrid(nx, ny) : { x: nx, y: ny };
    return { ...t, x: pos.x, y: pos.y };
  });
  // Move arc angle points only if both endpoints selected
  next.arcs = (state.arcs || []).map(a => {
    if (!(selectedNodeIds.has(a.source) && selectedNodeIds.has(a.target))) return a;
    const pts = Array.isArray(a.anglePoints) ? a.anglePoints : [];
    const movedPts = pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
    return { ...a, anglePoints: movedPts };
  });
  return next;
}

export default {
  isCenterInRect,
  buildSelectionFromRect,
  toggleSelection,
  applyMultiDragDeltaFromSnapshot,
  applyMultiDragDelta,
};


