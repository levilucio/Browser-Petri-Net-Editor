/**
 * Conflict Resolver
 * Handles transition conflicts and finds non-conflicting transition sets
 */

export class ConflictResolver {
  constructor() {
    this.conflictCache = new Map();
  }

  /**
   * Check if two transitions are in conflict
   */
  areTransitionsInConflict(transition1Id, transition2Id, places, arcs) {
    const cacheKey = `${transition1Id}-${transition2Id}`;
    const reverseKey = `${transition2Id}-${transition1Id}`;
    
    // Check cache first
    if (this.conflictCache.has(cacheKey)) {
      return this.conflictCache.get(cacheKey);
    }
    if (this.conflictCache.has(reverseKey)) {
      return this.conflictCache.get(reverseKey);
    }

    // Get input places for both transitions
    const inputPlaces1 = this.getInputPlaces(transition1Id, places, arcs);
    const inputPlaces2 = this.getInputPlaces(transition2Id, places, arcs);

    // Check for shared input places
    const sharedPlaces = inputPlaces1.filter(place1 => 
      inputPlaces2.some(place2 => place1.id === place2.id)
    );

    // Transitions are in conflict if they share input places
    const inConflict = sharedPlaces.length > 0;
    
    // Cache the result
    this.conflictCache.set(cacheKey, inConflict);
    
    return inConflict;
  }

  /**
   * Find non-conflicting transitions from a set of enabled transitions
   */
  findNonConflictingTransitions(enabledTransitions, places, arcs) {
    if (enabledTransitions.length <= 1) {
      return enabledTransitions;
    }

    // Clear cache for new analysis
    this.conflictCache.clear();

    const nonConflictingSets = [];
    
    // Try different combinations of transitions
    for (let size = enabledTransitions.length; size >= 1; size--) {
      const combinations = this.getCombinations(enabledTransitions, size);
      
      for (const combination of combinations) {
        if (this.isNonConflictingSet(combination, places, arcs)) {
          nonConflictingSets.push(combination);
        }
      }
      
      // If we found sets of this size, return the largest ones
      if (nonConflictingSets.length > 0) {
        return nonConflictingSets;
      }
    }

    // If no non-conflicting sets found, return individual transitions
    return enabledTransitions.map(t => [t]);
  }

  /**
   * Check if a set of transitions is non-conflicting
   */
  isNonConflictingSet(transitions, places, arcs) {
    for (let i = 0; i < transitions.length; i++) {
      for (let j = i + 1; j < transitions.length; j++) {
        if (this.areTransitionsInConflict(
          transitions[i].id, 
          transitions[j].id, 
          places, 
          arcs
        )) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Get all combinations of a given size from an array
   */
  getCombinations(array, size) {
    if (size === 0) return [[]];
    if (size > array.length) return [];
    
    const combinations = [];
    
    const combine = (start, current) => {
      if (current.length === size) {
        combinations.push([...current]);
        return;
      }
      
      for (let i = start; i < array.length; i++) {
        current.push(array[i]);
        combine(i + 1, current);
        current.pop();
      }
    };
    
    combine(0, []);
    return combinations;
  }

  /**
   * Get input places for a transition
   */
  getInputPlaces(transitionId, places, arcs) {
    const inputPlaces = [];
    
    for (const arc of arcs) {
      const sourceId = arc.sourceId || arc.source;
      const targetId = arc.targetId || arc.target;
      const sourceType = arc.sourceType;
      
      if ((sourceType === 'place' && targetId === transitionId) || 
          (arc.type === 'place-to-transition' && targetId === transitionId)) {
        const place = places.find(p => p.id === sourceId);
        if (place) {
          inputPlaces.push(place);
        }
      }
    }
    
    return inputPlaces;
  }

  /**
   * Get output places for a transition
   */
  getOutputPlaces(transitionId, places, arcs) {
    const outputPlaces = [];
    
    for (const arc of arcs) {
      const sourceId = arc.sourceId || arc.source;
      const targetId = arc.targetId || arc.target;
      const targetType = arc.targetType;
      
      if ((targetType === 'place' && sourceId === transitionId) || 
          (arc.type === 'transition-to-place' && sourceId === transitionId)) {
        const place = places.find(p => p.id === targetId);
        if (place) {
          outputPlaces.push(place);
        }
      }
    }
    
    return outputPlaces;
  }

  /**
   * Clear the conflict cache
   */
  clearCache() {
    this.conflictCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.conflictCache.size,
      keys: Array.from(this.conflictCache.keys())
    };
  }
}
