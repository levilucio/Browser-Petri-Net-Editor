import { DEFAULT_LAYOUT, AUTO_LAYOUT_THRESHOLD } from './constants.js';

export function shouldAutoLayout(totalNodes) {
  return totalNodes >= AUTO_LAYOUT_THRESHOLD;
}

export function resolveNodePosition(element, helpers, options, index, type) {
  const { findChildElements } = helpers;
  const { applyAutoLayout, layout = DEFAULT_LAYOUT } = options;
  const { startX, startY, spacing, columns, transitionOffsetX } = layout;

  const pos = extractPosition(element, findChildElements);
  if (pos.found || !applyAutoLayout) {
    return { x: pos.x, y: pos.y };
  }

  const col = index % columns;
  const row = Math.floor(index / columns);
  const baseX = startX + col * spacing;
  const baseY = startY + row * spacing;

  if (type === 'transition') {
    return { x: baseX + transitionOffsetX, y: baseY };
  }

  return { x: baseX, y: baseY };
}

export function extractPosition(element, findChildElements) {
  const graphicsElements = findChildElements(element, 'graphics');
  if (graphicsElements.length > 0) {
    const positionElements = findChildElements(graphicsElements[0], 'position');
    if (positionElements.length > 0) {
      const x = parseInt(positionElements[0].getAttribute('x') || '0', 10);
      const y = parseInt(positionElements[0].getAttribute('y') || '0', 10);
      return { x, y, found: true };
    }
  }
  return { x: 0, y: 0, found: false };
}

export function createLayoutOptions(applyAutoLayout, overrides = {}) {
  return {
    applyAutoLayout,
    layout: { ...DEFAULT_LAYOUT, ...overrides },
  };
}

