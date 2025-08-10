/**
 * Simulation Utilities
 * Common utility functions for simulation operations
 */

/**
 * Validate Petri net structure
 */
export function validatePetriNet(petriNet) {
  const errors = [];
  
  if (!petriNet) {
    errors.push('Petri net is null or undefined');
    return errors;
  }
  
  if (!Array.isArray(petriNet.places)) {
    errors.push('Places must be an array');
  }
  
  if (!Array.isArray(petriNet.transitions)) {
    errors.push('Transitions must be an array');
  }
  
  if (!Array.isArray(petriNet.arcs)) {
    errors.push('Arcs must be an array');
  }
  
  // Validate places
  if (Array.isArray(petriNet.places)) {
    petriNet.places.forEach((place, index) => {
      if (!place.id) {
        errors.push(`Place at index ${index} missing ID`);
      }
      if (typeof place.tokens !== 'number' || place.tokens < 0) {
        errors.push(`Place ${place.id} has invalid token count: ${place.tokens}`);
      }
      if (typeof place.x !== 'number' || typeof place.y !== 'number') {
        errors.push(`Place ${place.id} has invalid coordinates: (${place.x}, ${place.y})`);
      }
    });
  }
  
  // Validate transitions
  if (Array.isArray(petriNet.transitions)) {
    petriNet.transitions.forEach((transition, index) => {
      if (!transition.id) {
        errors.push(`Transition at index ${index} missing ID`);
      }
      if (typeof transition.x !== 'number' || typeof transition.y !== 'number') {
        errors.push(`Transition ${transition.id} has invalid coordinates: (${transition.x}, ${transition.y})`);
      }
    });
  }
  
  // Validate arcs
  if (Array.isArray(petriNet.arcs)) {
    petriNet.arcs.forEach((arc, index) => {
      if (!arc.id) {
        errors.push(`Arc at index ${index} missing ID`);
      }
      if (!arc.sourceId && !arc.source) {
        errors.push(`Arc ${arc.id} missing source`);
      }
      if (!arc.targetId && !arc.target) {
        errors.push(`Arc ${arc.id} missing target`);
      }
      if (typeof arc.weight !== 'number' || arc.weight <= 0) {
        errors.push(`Arc ${arc.id} has invalid weight: ${arc.weight}`);
      }
    });
  }
  
  return errors;
}

/**
 * Deep clone a Petri net state
 */
export function deepClonePetriNet(petriNet) {
  if (!petriNet) return null;
  
  return {
    places: petriNet.places?.map(place => ({ ...place })) || [],
    transitions: petriNet.transitions?.map(transition => ({ ...transition })) || [],
    arcs: petriNet.arcs?.map(arc => ({ ...arc })) || []
  };
}

/**
 * Compare two Petri net states
 */
export function comparePetriNetStates(state1, state2) {
  if (!state1 || !state2) return false;
  
  // Compare places
  if (state1.places?.length !== state2.places?.length) return false;
  
  for (let i = 0; i < state1.places.length; i++) {
    const place1 = state1.places[i];
    const place2 = state2.places.find(p => p.id === place1.id);
    
    if (!place2) return false;
    if (place1.tokens !== place2.tokens) return false;
    if (place1.x !== place2.x || place1.y !== place2.y) return false;
    if (place1.label !== place2.label) return false;
  }
  
  // Compare transitions
  if (state1.transitions?.length !== state2.transitions?.length) return false;
  
  for (let i = 0; i < state1.transitions.length; i++) {
    const transition1 = state1.transitions[i];
    const transition2 = state2.transitions.find(t => t.id === transition1.id);
    
    if (!transition2) return false;
    if (transition1.x !== transition2.x || transition1.y !== transition2.y) return false;
    if (transition1.label !== transition2.label) return false;
  }
  
  // Compare arcs
  if (state1.arcs?.length !== state2.arcs?.length) return false;
  
  for (let i = 0; i < state1.arcs.length; i++) {
    const arc1 = state1.arcs[i];
    const arc2 = state2.arcs.find(a => a.id === arc1.id);
    
    if (!arc2) return false;
    if (arc1.weight !== arc2.weight) return false;
    if (arc1.sourceId !== arc2.sourceId && arc1.source !== arc2.source) return false;
    if (arc1.targetId !== arc2.targetId && arc1.target !== arc2.target) return false;
  }
  
  return true;
}

/**
 * Get marking vector from Petri net state
 */
export function getMarkingVector(petriNet) {
  if (!petriNet?.places) return [];
  
  return petriNet.places.map(place => ({
    id: place.id,
    tokens: place.tokens || 0,
    label: place.label || place.name || place.id
  }));
}

/**
 * Check if marking is a deadlock
 */
export function isDeadlock(petriNet) {
  if (!petriNet?.transitions || !petriNet?.places || !petriNet?.arcs) return false;
  
  // Check if any transition is enabled
  for (const transition of petriNet.transitions) {
    if (isTransitionEnabled(transition.id, petriNet)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if a transition is enabled (utility function)
 */
function isTransitionEnabled(transitionId, petriNet) {
  const inputPlaces = getInputPlaces(transitionId, petriNet.places, petriNet.arcs);
  
  for (const place of inputPlaces) {
    const arc = petriNet.arcs.find(a => 
      (a.sourceId === place.id || a.source === place.id) && 
      (a.targetId === transitionId || a.target === transitionId)
    );
    
    if (!arc) continue;
    
    const weight = arc.weight || 1;
    if ((place.tokens || 0) < weight) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get input places for a transition (utility function)
 */
function getInputPlaces(transitionId, places, arcs) {
  const inputPlaces = [];
  
  for (const arc of arcs) {
    const sourceId = arc.sourceId || arc.source;
    const targetId = arc.targetId || arc.target;
    
    if (targetId === transitionId) {
      const place = places.find(p => p.id === sourceId);
      if (place) {
        inputPlaces.push(place);
      }
    }
  }
  
  return inputPlaces;
}

/**
 * Convert Petri net to PNML format
 */
export function toPNML(petriNet) {
  if (!petriNet) return '';
  
  const places = petriNet.places?.map(place => 
    `  <place id="${place.id}">\n    <name><text>${place.label || place.name || place.id}</text></name>\n    <initialMarking><text>${place.tokens || 0}</text></initialMarking>\n  </place>`
  ).join('\n') || '';
  
  const transitions = petriNet.transitions?.map(transition => 
    `  <transition id="${transition.id}">\n    <name><text>${transition.label || transition.name || transition.id}</text></name>\n  </transition>`
  ).join('\n') || '';
  
  const arcs = petriNet.arcs?.map(arc => 
    `  <arc id="${arc.id}" source="${arc.sourceId || arc.source}" target="${arc.targetId || arc.target}">\n    <inscription><text>${arc.weight || 1}</text></inscription>\n  </arc>`
  ).join('\n') || '';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<pnml>
  <net id="petri-net" type="http://www.pnml.org/version-2009/grammar/pnmlcoremodel">
${places}
${transitions}
${arcs}
  </net>
</pnml>`;
}

/**
 * Convert PNML to Petri net format
 */
export function fromPNML(pnmlString) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(pnmlString, 'text/xml');
    
    const places = Array.from(xmlDoc.querySelectorAll('place')).map(place => ({
      id: place.getAttribute('id'),
      label: place.querySelector('name text')?.textContent || '',
      tokens: parseInt(place.querySelector('initialMarking text')?.textContent || '0', 10),
      x: 0,
      y: 0,
      name: place.querySelector('name text')?.textContent || '',
      type: 'place'
    }));
    
    const transitions = Array.from(xmlDoc.querySelectorAll('transition')).map(transition => ({
      id: transition.getAttribute('id'),
      label: transition.querySelector('name text')?.textContent || '',
      x: 0,
      y: 0,
      name: transition.querySelector('name text')?.textContent || '',
      type: 'transition'
    }));
    
    const arcs = Array.from(xmlDoc.querySelectorAll('arc')).map(arc => ({
      id: arc.getAttribute('id'),
      sourceId: arc.getAttribute('source'),
      targetId: arc.getAttribute('target'),
      source: arc.getAttribute('source'),
      target: arc.getAttribute('target'),
      weight: parseInt(arc.querySelector('inscription text')?.textContent || '1', 10),
      sourceType: 'place',
      targetType: 'transition',
      type: 'place-to-transition'
    }));
    
    return { places, transitions, arcs };
  } catch (error) {
    console.error('Error parsing PNML:', error);
    throw new Error('Invalid PNML format');
  }
}

/**
 * Get simulation statistics
 */
export function getSimulationStats(petriNet) {
  if (!petriNet) return null;
  
  const placeCount = petriNet.places?.length || 0;
  const transitionCount = petriNet.transitions?.length || 0;
  const arcCount = petriNet.arcs?.length || 0;
  const totalTokens = petriNet.places?.reduce((sum, place) => sum + (place.tokens || 0), 0) || 0;
  
  const enabledTransitions = petriNet.transitions?.filter(transition => 
    isTransitionEnabled(transition.id, petriNet)
  ) || [];
  
  return {
    placeCount,
    transitionCount,
    arcCount,
    totalTokens,
    enabledTransitionCount: enabledTransitions.length,
    enabledTransitions: enabledTransitions.map(t => t.id),
    isDeadlock: isDeadlock(petriNet)
  };
}
