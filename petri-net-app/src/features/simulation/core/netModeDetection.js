import { logger } from '../../../utils/logger.js';

export const determineNetMode = (petriNet, options = {}) => {
  logger.debug('determineNetMode called with:', { petriNet, options });
  const configured = options?.netMode || petriNet?.netMode;
  logger.debug('Found netMode from options/petriNet:', configured);
  if (configured) {
    const normalized = (configured === 'algebraic-int') ? 'algebraic' : configured;
    logger.debug('Using configured netMode:', normalized);
    return normalized;
  }
  logger.debug('No configured netMode, detecting from content');
  return detectNetModeFromContent(petriNet);
};

export const detectNetModeFromContent = (petriNet) => {
  const net = petriNet || {};
  const transitions = Array.isArray(net.transitions) ? net.transitions : [];
  const arcs = Array.isArray(net.arcs) ? net.arcs : [];
  const places = Array.isArray(net.places) ? net.places : [];

  logger.debug('Net mode detection:', { places, transitions, arcs });

  for (const t of transitions) {
    if (typeof t.guard === 'string' && t.guard.trim().length > 0) {
      logger.debug('Found guard, using algebraic mode');
      return 'algebraic';
    }
    if (typeof t.action === 'string' && t.action.trim().length > 0) {
      logger.debug('Found action, using algebraic mode');
      return 'algebraic';
    }
  }

  for (const arc of arcs) {
    const bindings = Array.isArray(arc.bindings) ? arc.bindings : (arc.binding ? [arc.binding] : []);
    logger.debug('Checking arc bindings:', bindings);
    const hasAlgebraicBinding = bindings.some((binding) => (
      typeof binding === 'string'
        && (/:[ ]*(integer|boolean)/i.test(binding)
          || binding === 'T'
          || binding === 'F'
          || /[+\-*/()]/.test(binding))
    ));
    if (hasAlgebraicBinding) {
      logger.debug('Found algebraic binding, using algebraic mode');
      return 'algebraic';
    }
  }

  if (places.some((place) => Array.isArray(place.valueTokens) && place.valueTokens.length > 0)) {
    logger.debug('Found valueTokens, using algebraic mode');
    return 'algebraic';
  }

  logger.debug('Using P/T mode');
  return 'pt';
};

