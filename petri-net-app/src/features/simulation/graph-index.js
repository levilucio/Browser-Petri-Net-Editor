// Build adjacency/index maps for a Petri net for fast lookups

export function buildGraphIndex(petriNet) {
  const places = petriNet?.places || [];
  const transitions = petriNet?.transitions || [];
  const arcs = petriNet?.arcs || [];

  const placeById = new Map(places.map(p => [p.id, p]));
  const transitionById = new Map(transitions.map(t => [t.id, t]));
  const arcsById = new Map(arcs.map(a => [a.id, a]));

  const inArcsByTransition = new Map();
  const outArcsByTransition = new Map();
  const inArcsByPlace = new Map();
  const outArcsByPlace = new Map();

  for (const a of arcs) {
    const s = a.sourceId || a.source;
    const t = a.targetId || a.target;
    if (!s || !t) continue;
    const sIsPlace = placeById.has(s);
    const tIsPlace = placeById.has(t);
    const sIsTransition = transitionById.has(s);
    const tIsTransition = transitionById.has(t);

    if (sIsPlace) {
      if (!outArcsByPlace.has(s)) outArcsByPlace.set(s, []);
      outArcsByPlace.get(s).push(a);
    }
    if (tIsPlace) {
      if (!inArcsByPlace.has(t)) inArcsByPlace.set(t, []);
      inArcsByPlace.get(t).push(a);
    }
    if (sIsTransition) {
      if (!outArcsByTransition.has(s)) outArcsByTransition.set(s, []);
      outArcsByTransition.get(s).push(a);
    }
    if (tIsTransition) {
      if (!inArcsByTransition.has(t)) inArcsByTransition.set(t, []);
      inArcsByTransition.get(t).push(a);
    }
  }

  return {
    placeById,
    transitionById,
    arcsById,
    inArcsByTransition,
    outArcsByTransition,
    inArcsByPlace,
    outArcsByPlace,
  };
}


