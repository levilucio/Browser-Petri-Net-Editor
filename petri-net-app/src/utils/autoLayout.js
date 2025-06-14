/**
 * Auto Layout utility for Petri nets
 * Uses a force-directed algorithm to position elements optimally
 * and adds angle points to arcs to avoid crossings
 */

// Constants for force calculation
const REPULSION_FORCE = 800;  // Force pushing elements apart (increased to prevent overlapping)
const ATTRACTION_FORCE = 0.1; // Force pulling connected elements together (decreased to allow more spacing)
const GRAVITY_FORCE = 0.05;   // Force pulling elements toward the center (reduced to allow more spread)
const DAMPING = 0.9;          // Reduces velocity over time to help stabilization
const MIN_DISTANCE = 150;     // Minimum distance between elements to avoid overlap (increased significantly)
const ITERATIONS = 200;       // Number of iterations to run the simulation (increased for better convergence)
const CROSSING_PENALTY = 500; // Penalty for arc crossings (increased to prioritize avoiding crossings)
const LAYER_HEIGHT = 180;     // Vertical distance between layers for layered layout (increased for better spacing)
const DEFAULT_CANVAS_WIDTH = 1000; // Default canvas width if dimensions are invalid
const DEFAULT_CANVAS_HEIGHT = 800; // Default canvas height if dimensions are invalid
const ELEMENT_SIZE = 40;      // Approximate size of elements for overlap detection
const MIN_ANGLE_POINTS = 0;   // Minimum number of angle points to add (prefer straight arcs)
const MAX_ANGLE_POINTS = 1;   // Maximum number of angle points to add (limit complexity)

/**
 * Apply force-directed layout to Petri net elements
 * @param {Object} elements - The Petri net elements (places, transitions, arcs)
 * @param {Object} canvasDimensions - Width and height of the canvas
 * @param {Number} gridSize - Size of the grid for snapping
 * @returns {Object} - New elements with updated positions
 */
export const applyAutoLayout = (elements, canvasDimensions, gridSize = 20) => {
  // Validate inputs to prevent errors
  if (!elements || !elements.places || !elements.transitions || !elements.arcs) {
    // Invalid elements object provided to applyAutoLayout
    return elements; // Return original elements if invalid
  }
  
  // Ensure canvas dimensions are valid
  const validCanvasDimensions = {
    width: (canvasDimensions && canvasDimensions.width) || DEFAULT_CANVAS_WIDTH,
    height: (canvasDimensions && canvasDimensions.height) || DEFAULT_CANVAS_HEIGHT
  };
  
  // Analyze the structure of the Petri net
  const netStructure = analyzeNetStructure(elements);
  
  // Choose the appropriate layout strategy based on the net structure
  if (netStructure.isWorkflow) {
    // Use layered layout for workflow-like nets
    return applyLayeredLayout(elements, validCanvasDimensions, gridSize);
  } else if (netStructure.hasGroups) {
    // Use group-based layout for nets with clear groupings
    return applyGroupBasedLayout(elements, netStructure, validCanvasDimensions, gridSize);
  }
  
  // Create a working copy of the elements
  const places = [...elements.places].map(place => ({
    ...place,
    velocity: { x: 0, y: 0 },
    force: { x: 0, y: 0 }
  }));
  
  const transitions = [...elements.transitions].map(transition => ({
    ...transition,
    velocity: { x: 0, y: 0 },
    force: { x: 0, y: 0 }
  }));
  
  const arcs = [...elements.arcs];
  
  // Helper function to get element by ID (from either places or transitions)
  const getElementById = (id) => {
    return places.find(p => p.id === id) || transitions.find(t => t.id === id);
  };
  
  // Helper function to apply attraction force between connected elements
  const applyAttractionForce = (source, target, attractionForce) => {
    // Calculate distance
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Avoid division by zero
    if (distance > 0.1) {
      // Calculate attraction force (proportional to distance)
      const force = distance * attractionForce;
      
      // Normalize direction
      const nx = dx / distance;
      const ny = dy / distance;
      
      // Apply forces in attraction direction
      source.force.x += nx * force;
      source.force.y += ny * force;
      target.force.x -= nx * force;
      target.force.y -= ny * force;
    }
  };
  
  // Calculate center of the canvas (used for gravity force)
  const centerX = validCanvasDimensions.width / 2;
  const centerY = validCanvasDimensions.height / 2;
  
  // Apply initial positioning to spread elements more evenly
  applyInitialPositioning(places, transitions, centerX, centerY);
  
  // Run the force-directed algorithm for a fixed number of iterations
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    // Reset forces for this iteration
    [...places, ...transitions].forEach(element => {
      element.force = { x: 0, y: 0 };
    });
    
    // 1. Apply repulsion forces between all elements
    for (let i = 0; i < places.length + transitions.length; i++) {
      const element1 = i < places.length ? places[i] : transitions[i - places.length];
      
      for (let j = i + 1; j < places.length + transitions.length; j++) {
        const element2 = j < places.length ? places[j] : transitions[j - places.length];
        
        // Calculate distance between elements
        const dx = element2.x - element1.x;
        const dy = element2.y - element1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Avoid division by zero and enforce minimum distance
        const effectiveDistance = Math.max(distance, 0.1);
        
        // Calculate repulsion force (inversely proportional to distance)
        const force = REPULSION_FORCE / (effectiveDistance * effectiveDistance);
        
        // Normalize direction
        const nx = dx / effectiveDistance;
        const ny = dy / effectiveDistance;
        
        // Apply forces in opposite directions
        element1.force.x -= nx * force;
        element1.force.y -= ny * force;
        element2.force.x += nx * force;
        element2.force.y += ny * force;
      }
    }
    
    // 2. Apply attraction forces between connected elements
    arcs.forEach(arc => {
      const sourceId = arc.sourceId || arc.source;
      const targetId = arc.targetId || arc.target;
      const source = getElementById(sourceId);
      const target = getElementById(targetId);
      
      if (source && target) {
        applyAttractionForce(source, target, ATTRACTION_FORCE);
      }
    });
    
    // 3. Apply gravity force toward the center
    [...places, ...transitions].forEach(element => {
      const dx = centerX - element.x;
      const dy = centerY - element.y;
      
      element.force.x += dx * GRAVITY_FORCE;
      element.force.y += dy * GRAVITY_FORCE;
    });
    
    // 4. Update velocities and positions
    [...places, ...transitions].forEach(element => {
      // Update velocity with damping
      element.velocity.x = (element.velocity.x + element.force.x) * DAMPING;
      element.velocity.y = (element.velocity.y + element.force.y) * DAMPING;
      
      // Update position
      element.x += element.velocity.x;
      element.y += element.velocity.y;
      
      // Ensure element stays within canvas bounds
      element.x = Math.max(ELEMENT_SIZE, Math.min(validCanvasDimensions.width - ELEMENT_SIZE, element.x));
      element.y = Math.max(ELEMENT_SIZE, Math.min(validCanvasDimensions.height - ELEMENT_SIZE, element.y));
    });
    
    // 5. Apply post-positioning adjustment to prevent overlaps
    if (iteration % 10 === 0 || iteration === ITERATIONS - 1) { // Check periodically and on final iteration
      resolveOverlaps(places, transitions, MIN_DISTANCE);
    }
  }
  
  // Snap final positions to grid and remove temporary properties
  const finalPlaces = places.map(place => ({
    ...place,
    x: Math.round(place.x / gridSize) * gridSize,
    y: Math.round(place.y / gridSize) * gridSize,
    velocity: undefined,
    force: undefined
  }));
  
  const finalTransitions = transitions.map(transition => ({
    ...transition,
    x: Math.round(transition.x / gridSize) * gridSize,
    y: Math.round(transition.y / gridSize) * gridSize,
    velocity: undefined,
    force: undefined
  }));
  
  // Return the new elements with updated positions
  const optimizedArcs = optimizeArcs(finalPlaces, finalTransitions, arcs, gridSize);
  
  return {
    places: finalPlaces,
    transitions: finalTransitions,
    arcs: optimizedArcs
  };
};

/**
 * Resolve overlaps between elements by pushing them apart
 * @param {Array} places - Array of places
 * @param {Array} transitions - Array of transitions
 * @param {Number} minDistance - Minimum distance between elements
 */
function resolveOverlaps(places, transitions, minDistance) {
  const allElements = [...places, ...transitions];
  
  // Multiple passes to ensure all overlaps are resolved
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < allElements.length; i++) {
      for (let j = i + 1; j < allElements.length; j++) {
        const elem1 = allElements[i];
        const elem2 = allElements[j];
        
        // Calculate distance between elements
        const dx = elem2.x - elem1.x;
        const dy = elem2.y - elem1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // If elements are too close, push them apart
        if (distance < minDistance) {
          // Calculate the overlap amount
          const overlap = minDistance - distance;
          
          // Direction vector
          const dirX = dx === 0 ? (Math.random() * 2 - 1) : dx / distance;
          const dirY = dy === 0 ? (Math.random() * 2 - 1) : dy / distance;
          
          // Move elements apart (more movement for the element that has more space)
          const moveRatio = 0.5; // Equal movement by default
          
          // Push elements apart
          elem1.x -= dirX * overlap * moveRatio;
          elem1.y -= dirY * overlap * moveRatio;
          elem2.x += dirX * overlap * moveRatio;
          elem2.y += dirY * overlap * moveRatio;
        }
      }
    }
  }
}

/**
 * Check if two line segments intersect
 * @param {Object} p1 - Start point of first line
 * @param {Object} p2 - End point of first line
 * @param {Object} p3 - Start point of second line
 * @param {Object} p4 - End point of second line
 * @returns {Boolean} - True if lines intersect
 */
function doLinesIntersect(p1, p2, p3, p4) {
  // Calculate direction vectors
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  
  // Calculate the determinant
  const det = d1x * d2y - d1y * d2x;
  
  // Lines are parallel if determinant is zero
  if (Math.abs(det) < 0.001) return false;
  
  // Calculate the parameters for the intersection point
  const s = ((p1.x - p3.x) * d2y - (p1.y - p3.y) * d2x) / det;
  const t = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / -det;
  
  // Check if the intersection point is within both line segments
  return s >= 0 && s <= 1 && t >= 0 && t <= 1;
}

/**
 * Calculate the intersection point of two lines
 * @param {Object} p1 - Start point of first line
 * @param {Object} p2 - End point of first line
 * @param {Object} p3 - Start point of second line
 * @param {Object} p4 - End point of second line
 * @returns {Object|null} - Intersection point or null if no intersection
 */
function getIntersectionPoint(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  
  const det = d1x * d2y - d1y * d2x;
  
  if (Math.abs(det) < 0.001) return null;
  
  const s = ((p1.x - p3.x) * d2y - (p1.y - p3.y) * d2x) / det;
  
  return {
    x: p1.x + s * d1x,
    y: p1.y + s * d1y
  };
}

/**
 * Optimize arcs by adding angle points to avoid crossings
 * @param {Array} places - Array of places
 * @param {Array} transitions - Array of transitions
 * @param {Array} arcs - Array of arcs
 * @param {Number} gridSize - Size of the grid for snapping
 * @returns {Array} - Optimized arcs with angle points
 */
function optimizeArcs(places, transitions, arcs, gridSize) {
  // Create a map of elements by ID for quick lookup
  const elementsMap = {};
  places.forEach(place => { elementsMap[place.id] = place; });
  transitions.forEach(transition => { elementsMap[transition.id] = transition; });
  
  // Create a working copy of arcs
  const optimizedArcs = [...arcs];
  
  // First, check if arcs pass through elements and add angle points to avoid this
  optimizedArcs.forEach(arc => {
    const source = elementsMap[arc.sourceId || arc.source];
    const target = elementsMap[arc.targetId || arc.target];
    
    if (!source || !target) return;
    
    // Check if this arc passes through any element
    const arcLine = { x1: source.x, y1: source.y, x2: target.x, y2: target.y };
    let needsAnglePoint = false;
    let intersectingElement = null;
    
    // Check against all elements except source and target
    [...places, ...transitions].forEach(element => {
      if (element.id === source.id || element.id === target.id) return;
      
      // Check if line passes through element (approximated as circle)
      const distToLine = distanceFromPointToLine(
        element.x, element.y,
        arcLine.x1, arcLine.y1, arcLine.x2, arcLine.y2
      );
      
      if (distToLine < ELEMENT_SIZE) {
        needsAnglePoint = true;
        intersectingElement = element;
      }
    });
    
    // If arc passes through an element, add angle points to route around it
    if (needsAnglePoint && intersectingElement) {
      // Calculate perpendicular offset direction
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 0) {
        // Normalized perpendicular vector
        const perpX = -dy / length * ELEMENT_SIZE * 1.5;
        const perpY = dx / length * ELEMENT_SIZE * 1.5;
        
        // Determine which side to route around (choose the side with more space)
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        
        // Create angle point to route around the element
        arc.anglePoints = [{
          x: Math.round((midX + perpX) / gridSize) * gridSize,
          y: Math.round((midY + perpY) / gridSize) * gridSize
        }];
      }
    }
  });
  
  // Detect and resolve arc crossings (only if necessary)
  const arcCrossings = [];
  
  // First identify all crossings
  for (let i = 0; i < optimizedArcs.length; i++) {
    for (let j = i + 1; j < optimizedArcs.length; j++) {
      const arc1 = optimizedArcs[i];
      const arc2 = optimizedArcs[j];
      
      // Skip if either arc already has angle points
      if ((arc1.anglePoints && arc1.anglePoints.length > 0) || 
          (arc2.anglePoints && arc2.anglePoints.length > 0)) {
        continue;
      }
      
      // Get source and target elements for both arcs
      const source1 = elementsMap[arc1.sourceId || arc1.source];
      const target1 = elementsMap[arc1.targetId || arc1.target];
      const source2 = elementsMap[arc2.sourceId || arc2.source];
      const target2 = elementsMap[arc2.targetId || arc2.target];
      
      if (!source1 || !target1 || !source2 || !target2) continue;
      
      // Define line segments for both arcs
      const p1 = { x: source1.x, y: source1.y };
      const p2 = { x: target1.x, y: target1.y };
      const p3 = { x: source2.x, y: source2.y };
      const p4 = { x: target2.x, y: target2.y };
      
      // Check if the arcs cross
      if (doLinesIntersect(p1, p2, p3, p4)) {
        arcCrossings.push({ arc1, arc2, source1, target1, source2, target2 });
      }
    }
  }
  
  // Only add angle points to resolve the most problematic crossings
  // Sort crossings by arc length (shorter arcs get priority for staying straight)
  arcCrossings.sort((a, b) => {
    const lengthA = Math.hypot(a.target1.x - a.source1.x, a.target1.y - a.source1.y) +
                   Math.hypot(a.target2.x - a.source2.x, a.target2.y - a.source2.y);
    const lengthB = Math.hypot(b.target1.x - b.source1.x, b.target1.y - b.source1.y) +
                   Math.hypot(b.target2.x - b.source2.x, b.target2.y - b.source2.y);
    return lengthA - lengthB;
  });
  
  // Process only the most critical crossings (limit to MAX_ANGLE_POINTS)
  const processedArcs = new Set();
  arcCrossings.forEach(crossing => {
    // Skip if we've already processed these arcs
    if (processedArcs.has(crossing.arc1.id) || processedArcs.has(crossing.arc2.id)) {
      return;
    }
    
    // Choose the longer arc to add an angle point to
    const length1 = Math.hypot(crossing.target1.x - crossing.source1.x, crossing.target1.y - crossing.source1.y);
    const length2 = Math.hypot(crossing.target2.x - crossing.source2.x, crossing.target2.y - crossing.source2.y);
    
    const arcToModify = length1 > length2 ? crossing.arc1 : crossing.arc2;
    const source = length1 > length2 ? crossing.source1 : crossing.source2;
    const target = length1 > length2 ? crossing.target1 : crossing.target2;
    
    // Calculate a single angle point to avoid crossing
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2;
    
    // Add perpendicular offset
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length > 0) {
      const perpX = -dy / length * ELEMENT_SIZE * 2;
      const perpY = dx / length * ELEMENT_SIZE * 2;
      
      arcToModify.anglePoints = [{
        x: Math.round((midX + perpX) / gridSize) * gridSize,
        y: Math.round((midY + perpY) / gridSize) * gridSize
      }];
      
      // Mark these arcs as processed
      processedArcs.add(crossing.arc1.id);
      processedArcs.add(crossing.arc2.id);
    }
  });
  
  return optimizedArcs;
}

/**
 * Calculate the distance from a point to a line segment
 * @param {Number} px - Point x coordinate
 * @param {Number} py - Point y coordinate
 * @param {Number} x1 - Line start x coordinate
 * @param {Number} y1 - Line start y coordinate
 * @param {Number} x2 - Line end x coordinate
 * @param {Number} y2 - Line end y coordinate
 * @returns {Number} - Distance from point to line
 */
function distanceFromPointToLine(px, py, x1, y1, x2, y2) {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  
  if (len_sq !== 0) {
    param = dot / len_sq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Determine if we should use layered layout based on network structure
 * @param {Object} elements - The Petri net elements
 * @returns {Boolean} - True if layered layout should be used
 */
function shouldApplyLayeredLayout(elements) {
  // Use layered layout if the network has a clear flow direction
  // (more than 8 elements and more forward connections than cross connections)
  
  const totalElements = elements.places.length + elements.transitions.length;
  if (totalElements < 8) return false;
  
  // Create a map of elements by ID for quick lookup
  const elementsMap = {};
  elements.places.forEach(place => { elementsMap[place.id] = { ...place, type: 'place' }; });
  elements.transitions.forEach(transition => { elementsMap[transition.id] = { ...transition, type: 'transition' }; });
  
  // Count forward and cross connections
  let forwardConnections = 0;
  let crossConnections = 0;
  
  elements.arcs.forEach(arc => {
    const sourceId = arc.sourceId || arc.source;
    const targetId = arc.targetId || arc.target;
    
    const source = elementsMap[sourceId];
    const target = elementsMap[targetId];
    
    if (!source || !target) return;
    
    // If source x is less than target x, it's a forward connection
    if (source.x < target.x) {
      forwardConnections++;
    } else {
      crossConnections++;
    }
  });
  
  // Use layered layout if there are more forward connections than cross connections
  return forwardConnections > crossConnections;
}

/**
 * Apply initial positioning to spread elements more evenly
 * @param {Array} places - Array of places
 * @param {Array} transitions - Array of transitions
 * @param {Number} centerX - X coordinate of canvas center
 * @param {Number} centerY - Y coordinate of canvas center
 */
function applyInitialPositioning(places, transitions, centerX, centerY) {
  const totalElements = places.length + transitions.length;
  if (totalElements <= 1) return;
  
  // Calculate radius for circular layout
  const radius = Math.min(centerX, centerY) * 0.6;
  
  // Position elements in a circle around the center
  const angleStep = (2 * Math.PI) / totalElements;
  
  // Position places
  places.forEach((place, index) => {
    const angle = index * angleStep;
    place.x = centerX + radius * Math.cos(angle);
    place.y = centerY + radius * Math.sin(angle);
  });
  
  // Position transitions
  transitions.forEach((transition, index) => {
    const angle = (index + places.length) * angleStep;
    transition.x = centerX + radius * Math.cos(angle);
    transition.y = centerY + radius * Math.sin(angle);
  });
}

/**
 * Apply a layered layout to the Petri net
 * @param {Object} elements - The Petri net elements
 * @param {Object} canvasDimensions - Width and height of the canvas
 * @param {Number} gridSize - Size of the grid for snapping
 * @returns {Object} - New elements with updated positions
 */
function applyLayeredLayout(elements, canvasDimensions, gridSize) {
  // Validate inputs to prevent errors
  if (!elements || !elements.places || !elements.transitions || !elements.arcs) {
    console.error('Invalid elements object provided to applyLayeredLayout');
    return elements; // Return original elements if invalid
  }
  
  // Ensure canvas dimensions are valid
  const validCanvasDimensions = {
    width: (canvasDimensions && canvasDimensions.width) || DEFAULT_CANVAS_WIDTH,
    height: (canvasDimensions && canvasDimensions.height) || DEFAULT_CANVAS_HEIGHT
  };
  
  // Create working copies of elements
  const places = [...elements.places];
  const transitions = [...elements.transitions];
  const arcs = [...elements.arcs];

  // Create a map of elements by ID for quick lookup
  const elementsMap = {};
  places.forEach(place => { elementsMap[place.id] = { ...place, type: 'place' }; });
  transitions.forEach(transition => { elementsMap[transition.id] = { ...transition, type: 'transition' }; });

  // Build a graph representation
  const graph = {};
  const incomingEdges = {};
  
  // Initialize graph nodes
  [...places, ...transitions].forEach(element => {
    graph[element.id] = [];
    incomingEdges[element.id] = 0;
  });
  
  // Add edges to graph
  arcs.forEach(arc => {
    const sourceId = arc.sourceId || arc.source;
    const targetId = arc.targetId || arc.target;
    
    if (graph[sourceId]) {
      graph[sourceId].push(targetId);
      incomingEdges[targetId] = (incomingEdges[targetId] || 0) + 1;
    }
  });
  
  // Find root nodes (nodes with no incoming edges)
  const rootNodes = Object.keys(incomingEdges).filter(id => incomingEdges[id] === 0);
  
  // Assign layers to nodes using topological sorting
  const layers = [];
  const visited = new Set();
  const queue = [...rootNodes];
  
  // If no root nodes found, use the first place as a starting point
  if (queue.length === 0 && places.length > 0) {
    queue.push(places[0].id);
  }
  
  // Breadth-first traversal to assign layers
  let currentLayer = 0;
  layers[currentLayer] = [];
  
  while (queue.length > 0) {
    const levelSize = queue.length;
    
    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift();
      
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      
      // Add node to current layer
      layers[currentLayer].push(nodeId);
      
      // Add unvisited neighbors to queue
      const neighbors = graph[nodeId] || [];
      neighbors.forEach(neighborId => {
        if (!visited.has(neighborId)) {
          queue.push(neighborId);
        }
      });
    }
    
    // Move to next layer if there are more nodes in the queue
    if (queue.length > 0) {
      currentLayer++;
      layers[currentLayer] = [];
    }
  }
  
  // Filter out empty layers
  const nonEmptyLayers = layers.filter(layer => layer.length > 0);
  
  // Position elements based on their layer
  const layerHeight = LAYER_HEIGHT;
  const startY = 100;
  
  nonEmptyLayers.forEach((layer, layerIndex) => {
    const layerWidth = layer.length * 150; // Horizontal spacing between elements
    const startX = (validCanvasDimensions.width - layerWidth) / 2 + 75; // Center the layer
    
    layer.forEach((nodeId, nodeIndex) => {
      const element = elementsMap[nodeId];
      if (element) {
        element.x = startX + nodeIndex * 150;
        element.y = startY + layerIndex * layerHeight;
      }
    });
  });
  
  // Update the original elements with new positions
  const finalPlaces = places.map(place => ({
    ...place,
    x: Math.round(place.x / gridSize) * gridSize,
    y: Math.round(place.y / gridSize) * gridSize
  }));
  
  const finalTransitions = transitions.map(transition => ({
    ...transition,
    x: Math.round(transition.x / gridSize) * gridSize,
    y: Math.round(transition.y / gridSize) * gridSize
  }));
  
  // Optimize arcs to avoid crossings
  const optimizedArcs = optimizeArcs(finalPlaces, finalTransitions, arcs, gridSize);
  
  return {
    places: finalPlaces,
    transitions: finalTransitions,
    arcs: optimizedArcs
  };
}

/**
 * Analyze the structure of the Petri net to determine the best layout strategy
 * @param {Object} elements - The Petri net elements
 * @returns {Object} - Analysis results with layout recommendations
 */
function analyzeNetStructure(elements) {
  const { places, transitions, arcs } = elements;

  // Create a map of incoming and outgoing connections
  const incomingMap = {};
  const outgoingMap = {};
  const incomingArcs = {};
  const outgoingArcs = {};

  // Initialize maps
  [...places, ...transitions].forEach(element => {
    incomingMap[element.id] = 0;
    outgoingMap[element.id] = 0;
    incomingArcs[element.id] = [];
    outgoingArcs[element.id] = [];
  });

  // Count incoming and outgoing connections and store the arcs
  arcs.forEach(arc => {
    const sourceId = arc.sourceId || arc.source;
    const targetId = arc.targetId || arc.target;

    if (outgoingMap[sourceId] !== undefined) {
      outgoingMap[sourceId]++;
      outgoingArcs[sourceId].push(arc);
    }

    if (incomingMap[targetId] !== undefined) {
      incomingMap[targetId]++;
      incomingArcs[targetId].push(arc);
    }
  });

  // Count elements with no incoming or no outgoing connections
  let sourceNodes = 0;
  let sinkNodes = 0;

  [...places, ...transitions].forEach(element => {
    if (incomingMap[element.id] === 0) sourceNodes++;
    if (outgoingMap[element.id] === 0) sinkNodes++;
  });

  // Identify place groups (places that are inputs to common transitions)
  const placeGroups = identifyElementGroups(places, transitions, arcs, 'place');

  // Identify transition groups (transitions that are inputs to common places)
  const transitionGroups = identifyElementGroups(places, transitions, arcs, 'transition');

  // Determine if the net has a workflow structure
  const isWorkflow = sourceNodes > 0 && sinkNodes > 0;

  // Determine if the net has clear groups
  const hasGroups = placeGroups.length > 1 || transitionGroups.length > 1;

  return {
    isWorkflow,
    hasGroups,
    placeGroups,
    transitionGroups,
    incomingMap,
    outgoingMap,
    incomingArcs,
    outgoingArcs
  };
}

/**
 * Identify groups of related elements (places or transitions)
 * @param {Array} places - Array of places
 * @param {Array} transitions - Array of transitions
 * @param {Array} arcs - Array of arcs
 * @param {String} elementType - Type of element to group ('place' or 'transition')
 * @returns {Array} - Array of element groups
 */
function identifyElementGroups(places, transitions, arcs, elementType) {
  const groups = [];
  const processed = new Set();

  // Determine source and target types based on element type
  const sourceType = elementType;
  const targetType = elementType === 'place' ? 'transition' : 'place';

  // Get the appropriate element arrays
  const sourceElements = elementType === 'place' ? places : transitions;
  const targetElements = elementType === 'place' ? transitions : places;

  // Create a map of targets to their source elements
  const targetToSourcesMap = {};

  // Initialize the map
  targetElements.forEach(target => {
    targetToSourcesMap[target.id] = [];
  });

  // Populate the map
  arcs.forEach(arc => {
    const sourceId = arc.sourceId || arc.source;
    const targetId = arc.targetId || arc.target;

    // Check if this arc connects the right types of elements
    const sourceElement = sourceElements.find(e => e.id === sourceId);
    const targetElement = targetElements.find(e => e.id === targetId);

    if (sourceElement && targetElement) {
      // This arc connects a source to a target of the right types
      targetToSourcesMap[targetId].push(sourceId);
    }
  });

  // Find groups of sources that connect to the same targets
  Object.entries(targetToSourcesMap).forEach(([targetId, sourceIds]) => {
    if (sourceIds.length > 1) {
      // This target has multiple sources - they form a group
      const group = sourceIds.filter(id => !processed.has(id));

      if (group.length > 1) {
        groups.push({
          elements: group,
          targetId: targetId
        });
        
        // Mark these elements as processed
        group.forEach(id => processed.add(id));
      }
    }
  });
  
  // Add any remaining unprocessed elements as individual groups
  sourceElements.forEach(element => {
    if (!processed.has(element.id)) {
      groups.push({
        elements: [element.id],
        targetId: null
      });
    }
  });
  
  return groups;
}

/**
 * Apply a group-based layout to organize related elements together
 * @param {Object} elements - The Petri net elements
 * @param {Object} netStructure - Analysis of the net structure
 * @param {Object} canvasDimensions - Width and height of the canvas
 * @param {Number} gridSize - Size of the grid for snapping
 * @returns {Object} - New elements with updated positions
 */
function applyGroupBasedLayout(elements, netStructure, canvasDimensions, gridSize) {
  const { places, transitions, arcs } = elements;
  const { placeGroups, transitionGroups } = netStructure;
  
  // Create working copies of elements
  const workingPlaces = [...places].map(place => ({ ...place }));
  const workingTransitions = [...transitions].map(transition => ({ ...transition }));
  
  // Calculate center of the canvas
  const centerX = canvasDimensions.width / 2;
  const centerY = canvasDimensions.height / 2;
  
  // Define spacing constants
  const HORIZONTAL_SPACING = 150; // Space between elements in a row
  const VERTICAL_SPACING = 150;   // Space between rows
  const GROUP_SPACING = 250;      // Space between groups
  
  // Position place groups in rows
  let currentY = 100;
  let maxGroupWidth = 0;
  
  placeGroups.forEach((group, groupIndex) => {
    const groupElements = group.elements.map(id => workingPlaces.find(p => p.id === id)).filter(Boolean);
    
    if (groupElements.length === 0) return;
    
    // Position elements in this group in a row
    const groupWidth = (groupElements.length - 1) * HORIZONTAL_SPACING;
    const startX = centerX - groupWidth / 2;
    
    groupElements.forEach((element, index) => {
      element.x = startX + index * HORIZONTAL_SPACING;
      element.y = currentY;
    });
    
    maxGroupWidth = Math.max(maxGroupWidth, groupWidth);
    currentY += VERTICAL_SPACING;
  });
  
  // Position transition groups in rows below the places
  currentY += GROUP_SPACING - VERTICAL_SPACING; // Add extra space between place and transition groups
  
  transitionGroups.forEach((group, groupIndex) => {
    const groupElements = group.elements.map(id => workingTransitions.find(t => t.id === id)).filter(Boolean);
    
    if (groupElements.length === 0) return;
    
    // Position elements in this group in a row
    const groupWidth = (groupElements.length - 1) * HORIZONTAL_SPACING;
    const startX = centerX - groupWidth / 2;
    
    groupElements.forEach((element, index) => {
      element.x = startX + index * HORIZONTAL_SPACING;
      element.y = currentY;
    });
    
    maxGroupWidth = Math.max(maxGroupWidth, groupWidth);
    currentY += VERTICAL_SPACING;
  });
  
  // Snap positions to grid
  const finalPlaces = workingPlaces.map(place => ({
    ...place,
    x: Math.round(place.x / gridSize) * gridSize,
    y: Math.round(place.y / gridSize) * gridSize
  }));
  
  const finalTransitions = workingTransitions.map(transition => ({
    ...transition,
    x: Math.round(transition.x / gridSize) * gridSize,
    y: Math.round(transition.y / gridSize) * gridSize
  }));
  
  // Optimize arcs to avoid crossings
  const optimizedArcs = optimizeArcs(finalPlaces, finalTransitions, arcs, gridSize);
  
  return {
    places: finalPlaces,
    transitions: finalTransitions,
    arcs: optimizedArcs
  };
}
