/**
 * State Space Explorer
 * Builds reachability graphs for algebraic Petri nets
 */

import { getTokensForPlace } from '../../utils/token-utils.js';

/**
 * Compute a hash for a marking (state)
 * @param {Object} marking - Marking object (placeId -> tokens array)
 * @returns {string} Hash string
 */
function hashMarking(marking) {
  const entries = Object.entries(marking)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([placeId, tokens]) => {
      const tokenStrs = tokens
        .map(t => JSON.stringify(t))
        .sort()
        .join(',');
      return `${placeId}:[${tokenStrs}]`;
    });
  return entries.join(';');
}

/**
 * Extract marking from a Petri net
 * @param {Object} petriNet - Petri net object
 * @returns {Object} Marking (placeId -> tokens array)
 */
function extractMarking(petriNet) {
  const marking = {};
  for (const place of petriNet.places || []) {
    marking[place.id] = getTokensForPlace(place);
  }
  return marking;
}

/**
 * Apply marking to a Petri net (mutates a copy)
 * @param {Object} petriNet - Petri net object
 * @param {Object} marking - Marking to apply
 * @returns {Object} New Petri net with marking
 */
function applyMarking(petriNet, marking) {
  const newNet = JSON.parse(JSON.stringify(petriNet));
  for (const place of newNet.places || []) {
    const tokens = marking[place.id] || [];
    // Set tokens on place
    if (tokens.length === 0) {
      place.tokens = 0;
      place.valueTokens = [];
    } else {
      place.tokens = tokens.length;
      place.valueTokens = tokens;
    }
  }
  return newNet;
}

/**
 * Build reachability graph from initial marking
 * @param {Object} petriNet - Petri net object
 * @param {Object} simulator - Algebraic simulator instance
 * @param {Object} [options] - Exploration options
 * @param {number} [options.maxStates=1000] - Maximum states to explore
 * @param {number} [options.maxDepth=50] - Maximum depth
 * @param {AbortSignal} [options.signal] - Abort signal for cancellation
 * @param {Function} [options.onProgress] - Progress callback
 * @returns {Promise<Object>} Reachability graph
 */
export async function buildReachabilityGraph(petriNet, simulator, options = {}) {
  const maxStates = options.maxStates || 1000;
  const maxDepth = options.maxDepth || 50;
  const signal = options.signal;
  const onProgress = options.onProgress;
  
  const states = new Map(); // hash -> state object
  const transitions = [];
  const queue = []; // BFS queue: [{marking, depth, parentHash}]
  
  // Check for cancellation
  if (signal?.aborted) {
    const error = new Error('Operation cancelled');
    error.name = 'AbortError';
    throw error;
  }
  
  // Initial state
  const initialMarking = extractMarking(petriNet);
  const initialHash = hashMarking(initialMarking);
  
  // Initialize simulator with initial marking
  await simulator.initialize(petriNet);
  const initialEnabled = await simulator.getEnabledTransitions();
  
  const initialState = {
    id: initialHash,
    marking: initialMarking,
    enabledTransitions: initialEnabled,
    depth: 0
  };
  
  states.set(initialHash, initialState);
  queue.push({ marking: initialMarking, depth: 0, parentHash: null });
  
  let iterationCount = 0;
  const maxIterations = maxStates * 10; // Safety limit
  const yieldInterval = 50; // Yield to event loop every N iterations
  
  // BFS exploration
  while (queue.length > 0 && states.size < maxStates && iterationCount < maxIterations) {
    // Check for cancellation periodically
    if (signal?.aborted) {
      const error = new Error('Operation cancelled');
      error.name = 'AbortError';
      throw error;
    }
    
    // Yield to event loop periodically to keep UI responsive
    if (iterationCount % yieldInterval === 0) {
      if (onProgress) {
        onProgress({ 
          current: states.size, 
          total: maxStates, 
          message: `Explored ${states.size} states` 
        });
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    iterationCount++;
    const { marking, depth, parentHash } = queue.shift();
    
    if (depth >= maxDepth) {
      continue; // Skip if max depth reached
    }
    
    const currentHash = hashMarking(marking);
    const currentState = states.get(currentHash);
    
    // OPTIMIZATION: Initialize simulator once per state exploration
    const tempNet = applyMarking(petriNet, marking);
    await simulator.initialize(tempNet);
    
    // Try firing each enabled transition
    for (const transitionId of currentState.enabledTransitions) {
      try {
        // Fire transition (simulator already initialized with current marking)
        const newNet = await simulator.fireTransition(transitionId);
        const newMarking = extractMarking(newNet);
        const newHash = hashMarking(newMarking);
        
        // Record transition
        transitions.push({
          sourceStateId: currentHash,
          targetStateId: newHash,
          transitionId,
          binding: {} // TODO: extract actual binding used
        });
        
        // Add new state if not seen
        if (!states.has(newHash)) {
          // Initialize with new marking to check enabled transitions
          const newTempNet = applyMarking(petriNet, newMarking);
          await simulator.initialize(newTempNet);
          const newEnabled = await simulator.getEnabledTransitions();
          
          const newState = {
            id: newHash,
            marking: newMarking,
            enabledTransitions: newEnabled,
            depth: depth + 1
          };
          states.set(newHash, newState);
          queue.push({ marking: newMarking, depth: depth + 1, parentHash: currentHash });
          
          // Re-initialize with original marking for next transition
          await simulator.initialize(tempNet);
        } else {
          // Re-initialize with original marking for next transition
          await simulator.initialize(tempNet);
        }
      } catch (err) {
        // Transition not enabled or error - skip
        console.warn(`Failed to fire transition ${transitionId}:`, err.message);
      }
    }
  }
  
  return {
    states: Array.from(states.values()),
    transitions,
    initialStateId: initialHash,
    truncated: states.size >= maxStates || queue.length > 0
  };
}

/**
 * Find all paths matching a pattern in the reachability graph
 * @param {Object} graph - Reachability graph
 * @param {Object} pathPattern - Path pattern specification
 * @param {Object} [options] - Search options
 * @param {number} [options.maxPaths=100] - Maximum paths to return
 * @returns {Array} Array of paths (each path is array of transitions)
 */
export function findMatchingPaths(graph, pathPattern, options = {}) {
  const maxPaths = options.maxPaths || 100;
  const paths = [];
  
  if (pathPattern.type === 'sequence') {
    // Find paths that match the event sequence
    findSequencePaths(
      graph,
      graph.initialStateId,
      pathPattern.events,
      [],
      paths,
      maxPaths
    );
  } else {
    // TODO: Implement choice, parallel, loop patterns
    throw new Error(`Path pattern type '${pathPattern.type}' not yet implemented`);
  }
  
  return paths;
}

/**
 * Find paths matching a sequence pattern (DFS with early termination)
 * @private
 */
function findSequencePaths(graph, currentStateId, remainingEvents, currentPath, paths, maxPaths) {
  // OPTIMIZATION: Early termination when enough paths found
  if (paths.length >= maxPaths) {
    return true; // Signal to stop searching
  }
  
  if (remainingEvents.length === 0) {
    // Matched entire sequence
    paths.push([...currentPath]);
    return paths.length >= maxPaths; // Stop if we hit limit
  }
  
  const nextEvent = remainingEvents[0];
  const restEvents = remainingEvents.slice(1);
  
  // OPTIMIZATION: Cache transition lookups by source state
  if (!graph._transitionsBySource) {
    graph._transitionsBySource = new Map();
    for (const t of graph.transitions) {
      if (!graph._transitionsBySource.has(t.sourceStateId)) {
        graph._transitionsBySource.set(t.sourceStateId, []);
      }
      graph._transitionsBySource.get(t.sourceStateId).push(t);
    }
  }
  
  // Find transitions from current state matching next event
  const candidateTransitions = graph._transitionsBySource.get(currentStateId) || [];
  const matchingTransitions = candidateTransitions.filter(t =>
    transitionMatchesEvent(t, nextEvent, graph)
  );
  
  for (const transition of matchingTransitions) {
    currentPath.push(transition);
    const shouldStop = findSequencePaths(graph, transition.targetStateId, restEvents, currentPath, paths, maxPaths);
    currentPath.pop();
    
    if (shouldStop) {
      return true; // Propagate stop signal
    }
  }
  
  return false;
}

/**
 * Check if a transition matches an event in the path pattern
 * @private
 */
function transitionMatchesEvent(transition, event, graph) {
  // Basic match: transition ID
  if (transition.transitionId !== event.transition) {
    return false;
  }
  
  // TODO: Match binding constraints if specified
  if (event.binding) {
    // Would need to compare transition.binding with event.binding
  }
  
  return true;
}

/**
 * Get all traces from initial state to a target state
 * @param {Object} graph - Reachability graph
 * @param {string} targetStateId - Target state ID
 * @param {number} [maxTraces=100] - Maximum traces
 * @returns {Array} Array of traces (each trace is array of transitions)
 */
export function getTracesToState(graph, targetStateId, maxTraces = 100) {
  const traces = [];
  
  function dfs(currentStateId, currentTrace) {
    if (traces.length >= maxTraces) {
      return;
    }
    
    if (currentStateId === targetStateId) {
      traces.push([...currentTrace]);
      return;
    }
    
    const outgoing = graph.transitions.filter(t => t.sourceStateId === currentStateId);
    for (const transition of outgoing) {
      // Avoid cycles (simple check: don't revisit states in current trace)
      const visitedStates = currentTrace.map(t => t.targetStateId);
      if (!visitedStates.includes(transition.targetStateId)) {
        currentTrace.push(transition);
        dfs(transition.targetStateId, currentTrace);
        currentTrace.pop();
      }
    }
  }
  
  dfs(graph.initialStateId, []);
  return traces;
}
