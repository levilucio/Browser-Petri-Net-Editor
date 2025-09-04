/**
 * Shared helpers for arc type inference and normalization
 */

/**
 * @param {{sourceType?: string, type?: string}} arc
 */
export function getArcSourceType(arc) {
  if (arc?.sourceType) return arc.sourceType;
  if (arc?.type === 'place-to-transition') return 'place';
  if (arc?.type === 'transition-to-place') return 'transition';
  return 'place';
}

/**
 * @param {{targetType?: string, type?: string}} arc
 */
export function getArcTargetType(arc) {
  if (arc?.targetType) return arc.targetType;
  if (arc?.type === 'place-to-transition') return 'transition';
  if (arc?.type === 'transition-to-place') return 'place';
  return 'transition';
}

/**
 * Normalize arc fields (sourceType, targetType, type) without mutating the input.
 */
export function normalizeArc(arc) {
  const sourceType = getArcSourceType(arc);
  const targetType = getArcTargetType(arc);
  const type = arc?.type || `${sourceType}-to-${targetType}`;
  return { ...arc, sourceType, targetType, type };
}


