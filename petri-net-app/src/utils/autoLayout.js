/**
 * Auto Layout utility for Petri nets
 * Uses a force-directed algorithm to position elements optimally
 */

// Constants for force calculation
const REPULSION_FORCE = 400;  // Force pushing elements apart
const ATTRACTION_FORCE = 0.1; // Force pulling connected elements together  
const GRAVITY_FORCE = 0.1;    // Force pulling elements toward the center
const DAMPING = 0.9;          // Reduces velocity over time to help stabilization
const MIN_DISTANCE = 80;      // Minimum distance between elements to avoid overlap
const ITERATIONS = 100;       // Number of iterations to run the simulation

/**
 * Apply force-directed layout to Petri net elements
 * @param {Object} elements - The Petri net elements (places, transitions, arcs)
 * @param {Object} canvasDimensions - Width and height of the canvas
 * @param {Number} gridSize - Size of the grid for snapping
 * @returns {Object} - New elements with updated positions
 */
export const applyAutoLayout = (elements, canvasDimensions, gridSize = 20) => {
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
  
  // Calculate center of the canvas (used for gravity force)
  const centerX = canvasDimensions.width / 2;
  const centerY = canvasDimensions.height / 2;
  
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
        // Calculate distance
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Avoid division by zero
        if (distance > 0.1) {
          // Calculate attraction force (proportional to distance)
          const force = distance * ATTRACTION_FORCE;
          
          // Normalize direction
          const nx = dx / distance;
          const ny = dy / distance;
          
          // Apply forces in attraction direction
          source.force.x += nx * force;
          source.force.y += ny * force;
          target.force.x -= nx * force;
          target.force.y -= ny * force;
        }
      }
    });
    
    // 3. Apply gravity towards center to prevent elements from drifting too far
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
    });
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
  return {
    places: finalPlaces,
    transitions: finalTransitions,
    arcs: arcs
  };
};
