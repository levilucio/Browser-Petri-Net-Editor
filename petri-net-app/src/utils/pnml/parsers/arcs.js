import { splitTopLevelCommas } from '../token-parsers.js';

const DEFAULT_SOURCE_DIRECTION = 'north';
const DEFAULT_TARGET_DIRECTION = 'south';

export function parseArcs(arcElements, helpers, context) {
  const { getTextContent, findChildElements } = helpers;
  const result = [];
  const { placeIds, transitionIds } = context;

  arcElements.forEach((arc) => {
    try {
      const arcId = arc.getAttribute('id');
      const sourceId = arc.getAttribute('source');
      const targetId = arc.getAttribute('target');

      if (!sourceId || !targetId) {
        console.warn(`Skipping arc ${arcId} due to missing source or target`);
        return;
      }

      let sourceDirection = DEFAULT_SOURCE_DIRECTION;
      let targetDirection = DEFAULT_TARGET_DIRECTION;
      const graphicsElements = findChildElements(arc, 'graphics');
      if (graphicsElements.length > 0) {
        const metadataElements = findChildElements(graphicsElements[0], 'metadata');
        if (metadataElements.length > 0) {
          const sourceDirElements = findChildElements(metadataElements[0], 'sourceDirection');
          if (sourceDirElements.length > 0 && sourceDirElements[0].textContent) {
            sourceDirection = sourceDirElements[0].textContent;
          }
          const targetDirElements = findChildElements(metadataElements[0], 'targetDirection');
          if (targetDirElements.length > 0 && targetDirElements[0].textContent) {
            targetDirection = targetDirElements[0].textContent;
          }
        }
      }

      const arcType = resolveArcType(arcId, sourceId, targetId, placeIds, transitionIds);
      let weight = 1;
      const inscriptionText = getTextContent(arc, 'inscription');
      if (inscriptionText) {
        const parsed = parseInt(inscriptionText, 10);
        if (Number.isFinite(parsed)) {
          weight = parsed;
        } else {
          console.warn(`Could not parse weight for ${arcId}: '${inscriptionText}', defaulting to 1`);
        }
      }

      const bindingText = getTextContent(arc, 'binding');
      let bindingsArray = undefined;
      if (bindingText && bindingText.includes(',')) {
        try {
          bindingsArray = splitTopLevelCommas(bindingText);
        } catch (_) {
          bindingsArray = bindingText.split(',').map(s => s.trim()).filter(Boolean);
        }
      } else if (bindingText) {
        bindingsArray = [bindingText.trim()];
      }

      result.push({
        id: arcId,
        source: sourceId,
        target: targetId,
        type: arcType,
        weight,
        binding: bindingsArray ? undefined : (bindingText || undefined),
        bindings: bindingsArray || undefined,
        sourceDirection,
        targetDirection,
      });
    } catch (error) {
      console.error('Error processing arc:', error);
    }
  });

  return result;
}

function resolveArcType(arcId, sourceId, targetId, placeIds, transitionIds) {
  const hasPlaceSource = placeIds.includes(sourceId);
  const hasTransitionSource = transitionIds.includes(sourceId);
  const hasPlaceTarget = placeIds.includes(targetId);
  const hasTransitionTarget = transitionIds.includes(targetId);

  if (hasPlaceSource && hasTransitionTarget) {
    return 'place-to-transition';
  }
  if (hasTransitionSource && hasPlaceTarget) {
    return 'transition-to-place';
  }

  if (sourceId.toLowerCase().includes('place') && targetId.toLowerCase().includes('transition')) {
    return 'place-to-transition';
  }
  if (sourceId.toLowerCase().includes('transition') && targetId.toLowerCase().includes('place')) {
    return 'transition-to-place';
  }

  console.warn(`Could not determine arc type for ${arcId}, defaulting to place-to-transition`);
  return 'place-to-transition';
}

