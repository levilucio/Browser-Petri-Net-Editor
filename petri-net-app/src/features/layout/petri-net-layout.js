/**
 * Automatic layout for Petri nets using hierarchical (Sugiyama-style) approach
 * 
 * This implements a simplified bipartite layout algorithm suitable for Petri nets:
 * 1. Assign places and transitions to alternating layers
 * 2. Order nodes within layers to minimize arc crossings
 * 3. Compute node positions with even spacing
 * 4. Return updated coordinates for all nodes
 */

const LAYER_SPACING = 200;  // Horizontal space between layers
const NODE_SPACING = 100;    // Vertical space between nodes in a layer
const MARGIN_X = 100;        // Left margin
const MARGIN_Y = 100;        // Top margin

/**
 * Assign nodes to layers using breadth-first traversal from input places
 */
function assignLayers(places, transitions, arcs) {
  const layers = [];
  const nodeToLayer = new Map();
  
  // Build adjacency lists
  const placeOutgoing = new Map();
  const transitionOutgoing = new Map();
  
  places.forEach(p => placeOutgoing.set(p.id, []));
  transitions.forEach(t => transitionOutgoing.set(t.id, []));
  
  arcs.forEach(arc => {
    const sourceId = arc.sourceId || arc.source;
    const targetId = arc.targetId || arc.target;
    
    if (placeOutgoing.has(sourceId)) {
      placeOutgoing.get(sourceId).push(targetId);
    } else if (transitionOutgoing.has(sourceId)) {
      transitionOutgoing.get(sourceId).push(targetId);
    }
  });
  
  // Find input places (marked or those with no incoming arcs)
  const incomingCount = new Map();
  places.forEach(p => incomingCount.set(p.id, 0));
  transitions.forEach(t => incomingCount.set(t.id, 0));
  
  arcs.forEach(arc => {
    const targetId = arc.targetId || arc.target;
    incomingCount.set(targetId, (incomingCount.get(targetId) || 0) + 1);
  });
  
  // Start with input places (io_type === 'input' or no incoming arcs)
  const inputPlaces = places.filter(p => 
    p.io_type === 'input' || incomingCount.get(p.id) === 0
  );
  
  if (inputPlaces.length === 0 && places.length > 0) {
    // Fallback: use all places with minimum incoming count
    const minIncoming = Math.min(...Array.from(incomingCount.values()));
    inputPlaces.push(...places.filter(p => incomingCount.get(p.id) === minIncoming));
  }
  
  // BFS to assign layers
  const queue = [];
  const visited = new Set();
  
  inputPlaces.forEach(p => {
    queue.push({ id: p.id, type: 'place', layer: 0 });
  });
  
  while (queue.length > 0) {
    const { id, type, layer } = queue.shift();
    
    if (visited.has(id)) continue;
    visited.add(id);
    
    // Ensure layer exists
    while (layers.length <= layer) {
      layers.push({ places: [], transitions: [] });
    }
    
    // Add node to layer
    if (type === 'place') {
      layers[layer].places.push(id);
      nodeToLayer.set(id, layer);
      
      // Next layer should be transitions
      const nextTargets = placeOutgoing.get(id) || [];
      nextTargets.forEach(targetId => {
        if (!visited.has(targetId)) {
          queue.push({ id: targetId, type: 'transition', layer: layer + 1 });
        }
      });
    } else {
      layers[layer].transitions.push(id);
      nodeToLayer.set(id, layer);
      
      // Next layer should be places
      const nextTargets = transitionOutgoing.get(id) || [];
      nextTargets.forEach(targetId => {
        if (!visited.has(targetId)) {
          queue.push({ id: targetId, type: 'place', layer: layer + 1 });
        }
      });
    }
  }
  
  // Add any unvisited nodes to their own layer
  const allNodeIds = new Set([
    ...places.map(p => p.id),
    ...transitions.map(t => t.id)
  ]);
  
  const unvisited = Array.from(allNodeIds).filter(id => !visited.has(id));
  if (unvisited.length > 0) {
    const lastLayer = layers.length;
    layers.push({ places: [], transitions: [] });
    
    unvisited.forEach(id => {
      const isPlace = places.some(p => p.id === id);
      if (isPlace) {
        layers[lastLayer].places.push(id);
      } else {
        layers[lastLayer].transitions.push(id);
      }
      nodeToLayer.set(id, lastLayer);
    });
  }
  
  return { layers, nodeToLayer };
}

/**
 * Count crossings between two adjacent layers
 */
function countCrossings(layer1Ids, layer2Ids, arcs, positions1, positions2) {
  let crossings = 0;
  
  for (let i = 0; i < layer1Ids.length; i++) {
    for (let j = i + 1; j < layer1Ids.length; j++) {
      const id1 = layer1Ids[i];
      const id2 = layer1Ids[j];
      
      // Get targets in layer2 for both nodes
      const targets1 = arcs
        .filter(a => (a.sourceId || a.source) === id1)
        .map(a => a.targetId || a.target)
        .filter(t => layer2Ids.includes(t));
      
      const targets2 = arcs
        .filter(a => (a.sourceId || a.source) === id2)
        .map(a => a.targetId || a.target)
        .filter(t => layer2Ids.includes(t));
      
      // Check for crossings
      targets1.forEach(t1 => {
        targets2.forEach(t2 => {
          const pos1_t1 = positions1.get(id1);
          const pos1_t2 = positions1.get(id2);
          const pos2_t1 = positions2.get(t1);
          const pos2_t2 = positions2.get(t2);
          
          if (pos1_t1 < pos1_t2 && pos2_t1 > pos2_t2) {
            crossings++;
          }
        });
      });
    }
  }
  
  return crossings;
}

/**
 * Order nodes within each layer to minimize crossings (barycenter heuristic)
 */
function orderLayers(layers, arcs) {
  const MAX_ITERATIONS = 10;
  
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    let changed = false;
    
    // Forward pass
    for (let layerIdx = 0; layerIdx < layers.length - 1; layerIdx++) {
      const currentLayer = layers[layerIdx];
      const nextLayer = layers[layerIdx + 1];
      
      // Combine places and transitions in current layer
      const currentIds = [...currentLayer.places, ...currentLayer.transitions];
      
      // Calculate barycenter for each node in next layer
      const nextIds = [...nextLayer.places, ...nextLayer.transitions];
      const barycenters = new Map();
      
      nextIds.forEach(targetId => {
        const sources = arcs
          .filter(a => (a.targetId || a.target) === targetId)
          .map(a => a.sourceId || a.source)
          .filter(s => currentIds.includes(s));
        
        if (sources.length > 0) {
          const avgPos = sources.reduce((sum, srcId) => 
            sum + currentIds.indexOf(srcId), 0) / sources.length;
          barycenters.set(targetId, avgPos);
        } else {
          barycenters.set(targetId, nextIds.indexOf(targetId));
        }
      });
      
      // Sort next layer by barycenter
      const sortedNext = [...nextIds].sort((a, b) => 
        barycenters.get(a) - barycenters.get(b)
      );
      
      // Update layer
      nextLayer.places = sortedNext.filter(id => 
        nextLayer.places.includes(id)
      );
      nextLayer.transitions = sortedNext.filter(id => 
        nextLayer.transitions.includes(id)
      );
      
      if (JSON.stringify(sortedNext) !== JSON.stringify(nextIds)) {
        changed = true;
      }
    }
    
    if (!changed) break;
  }
  
  return layers;
}

/**
 * Compute final positions for all nodes
 */
function computePositions(layers, places, transitions) {
  const positions = new Map();
  
  layers.forEach((layer, layerIdx) => {
    const x = MARGIN_X + layerIdx * LAYER_SPACING;
    
    // Combine and position all nodes in this layer
    const allIds = [...layer.places, ...layer.transitions];
    const totalHeight = (allIds.length - 1) * NODE_SPACING;
    const startY = MARGIN_Y;
    
    allIds.forEach((id, idx) => {
      const y = startY + idx * NODE_SPACING;
      positions.set(id, { x, y });
    });
  });
  
  return positions;
}

/**
 * Main layout function
 */
export function computeAutoLayout(places, transitions, arcs) {
  if (!places.length && !transitions.length) {
    return { places: [], transitions: [] };
  }
  
  // Step 1: Assign nodes to layers
  const { layers, nodeToLayer } = assignLayers(places, transitions, arcs);
  
  // Step 2: Order nodes within layers to minimize crossings
  const orderedLayers = orderLayers(layers, arcs);
  
  // Step 3: Compute final positions
  const positions = computePositions(orderedLayers, places, transitions);
  
  // Step 4: Update place and transition coordinates
  const updatedPlaces = places.map(p => ({
    ...p,
    ...positions.get(p.id)
  }));
  
  const updatedTransitions = transitions.map(t => ({
    ...t,
    ...positions.get(t.id)
  }));
  
  return {
    places: updatedPlaces,
    transitions: updatedTransitions
  };
}

/**
 * Compute orthogonal routing waypoints for an arc
 * Returns array of {x, y} points including start and end
 */
export function computeOrthogonalRoute(startX, startY, endX, endY, sourceType, targetType) {
  const points = [{ x: startX, y: startY }];
  
  // For horizontal flow (typical in hierarchical layout)
  const dx = endX - startX;
  const dy = endY - startY;
  
  // If nodes are roughly aligned horizontally, use simple orthogonal routing
  if (Math.abs(dy) < 30) {
    // Direct horizontal line
    points.push({ x: endX, y: endY });
  } else if (Math.abs(dx) > 50) {
    // Use two-bend orthogonal routing
    const midX = startX + dx / 2;
    points.push({ x: midX, y: startY });
    points.push({ x: midX, y: endY });
    points.push({ x: endX, y: endY });
  } else {
    // Use three-bend routing for close vertical neighbors
    const midX = startX + Math.max(50, Math.abs(dx) / 2) * Math.sign(dx || 1);
    const midY = startY + dy / 2;
    points.push({ x: midX, y: startY });
    points.push({ x: midX, y: midY });
    points.push({ x: midX, y: endY });
    points.push({ x: endX, y: endY });
  }
  
  return points;
}
