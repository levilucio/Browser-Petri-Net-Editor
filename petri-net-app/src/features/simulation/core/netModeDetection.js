export const determineNetMode = (petriNet, options = {}) => {
  console.log('determineNetMode called with:', { petriNet, options });
  const configured = options?.netMode || petriNet?.netMode;
  console.log('Found netMode from options/petriNet:', configured);
  if (configured) {
    const normalized = (configured === 'algebraic-int') ? 'algebraic' : configured;
    console.log('Using configured netMode:', normalized);
    return normalized;
  }
  console.log('No configured netMode, detecting from content');
  return detectNetModeFromContent(petriNet);
};

export const detectNetModeFromContent = (petriNet) => {
  const net = petriNet || {};
  const transitions = Array.isArray(net.transitions) ? net.transitions : [];
  const arcs = Array.isArray(net.arcs) ? net.arcs : [];
  const places = Array.isArray(net.places) ? net.places : [];

  console.log('Net mode detection:', { places, transitions, arcs });

  for (const t of transitions) {
    if (typeof t.guard === 'string' && t.guard.trim().length > 0) {
      console.log('Found guard, using algebraic mode');
      return 'algebraic';
    }
    if (typeof t.action === 'string' && t.action.trim().length > 0) {
      console.log('Found action, using algebraic mode');
      return 'algebraic';
    }
  }

  for (const arc of arcs) {
    const bindings = Array.isArray(arc.bindings) ? arc.bindings : (arc.binding ? [arc.binding] : []);
    console.log('Checking arc bindings:', bindings);
    const hasAlgebraicBinding = bindings.some((binding) => (
      typeof binding === 'string'
        && (/:[ ]*(integer|boolean)/i.test(binding)
          || binding === 'T'
          || binding === 'F'
          || /[+\-*/()]/.test(binding))
    ));
    if (hasAlgebraicBinding) {
      console.log('Found algebraic binding, using algebraic mode');
      return 'algebraic';
    }
  }

  if (places.some((place) => Array.isArray(place.valueTokens) && place.valueTokens.length > 0)) {
    console.log('Found valueTokens, using algebraic mode');
    return 'algebraic';
  }

  console.log('Using P/T mode');
  return 'pt';
};

