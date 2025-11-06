import { resolveNodePosition } from '../position-utils.js';

const DEFAULT_TRANSITION_NAME = (index) => `T${index + 1}`;

export function parseTransitions(transitionElements, helpers, options) {
  const { getTextContent } = helpers;
  const result = [];

  transitionElements.forEach((transition, index) => {
    try {
      const transitionId = transition.getAttribute('id');
      const name = getTextContent(transition, 'name') || DEFAULT_TRANSITION_NAME(index);
      const position = resolveNodePosition(transition, helpers, options, index, 'transition');
      const guardText = getTextContent(transition, 'guard');
      const actionText = getTextContent(transition, 'action');

      result.push({
        id: transitionId,
        name,
        label: name,
        x: position.x,
        y: position.y,
        guard: guardText || undefined,
        action: actionText || undefined,
      });
    } catch (error) {
      console.error('Error processing transition:', error);
    }
  });

  return result;
}

