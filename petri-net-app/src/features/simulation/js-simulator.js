/**
 * JavaScript Fallback Simulator
 * Provides a pure JavaScript implementation of Petri net simulation
 * Used when Python simulator is unavailable or fails
 */

export class JsPetriNetSimulator {
  constructor(petriNet, options = {}) {
    this.petriNet = petriNet;
    this.places = petriNet.places || [];
    this.transitions = petriNet.transitions || [];
    this.arcs = petriNet.arcs || [];
    this.maxTokens = options.maxTokens || 20;
  }

  /**
   * Get input places for a transition
   */
  getInputPlaces(transitionId) {
    const inputPlaces = [];
    
    for (const arc of this.arcs) {
      const sourceId = arc.sourceId || arc.source;
      const targetId = arc.targetId || arc.target;
      const sourceType = arc.sourceType;
      
      if ((sourceType === 'place' && targetId === transitionId) || 
          (arc.type === 'place-to-transition' && targetId === transitionId)) {
        const place = this.places.find(p => p.id === sourceId);
        if (place) {
          inputPlaces.push([place, arc]);
        }
      }
    }
    
    return inputPlaces;
  }

  /**
   * Get output places for a transition
   */
  getOutputPlaces(transitionId) {
    const outputPlaces = [];
    
    for (const arc of this.arcs) {
      const sourceId = arc.sourceId || arc.source;
      const targetId = arc.targetId || arc.target;
      const targetType = arc.targetType;
      
      if ((targetType === 'place' && sourceId === transitionId) || 
          (arc.type === 'transition-to-place' && sourceId === transitionId)) {
        const place = this.places.find(p => p.id === targetId);
        if (place) {
          outputPlaces.push([place, arc]);
        }
      }
    }
    
    return outputPlaces;
  }

  /**
   * Check if a transition is enabled
   */
  isTransitionEnabled(transitionId) {
    const inputPlaces = this.getInputPlaces(transitionId);
    
    for (const [place, arc] of inputPlaces) {
      const weight = arc.weight || 1;
      if ((place.tokens || 0) < weight) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get all enabled transitions
   */
  getEnabledTransitions() {
    const enabledTransitions = [];
    
    for (const transition of this.transitions) {
      if (this.isTransitionEnabled(transition.id)) {
        enabledTransitions.push(transition);
      }
    }
    
    return enabledTransitions;
  }

  /**
   * Fire a transition
   */
  fireTransition(transitionId) {
    if (!this.isTransitionEnabled(transitionId)) {
      throw new Error(`Transition ${transitionId} is not enabled`);
    }

    // Create a deep copy of the Petri net to avoid modifying the original
    const updatedPetriNet = {
      places: this.places.map(place => ({ ...place })),
      transitions: this.transitions.map(transition => ({ ...transition })),
      arcs: this.arcs.map(arc => ({ ...arc }))
    };

    // Get input and output places
    const inputPlaces = this.getInputPlaces(transitionId);
    const outputPlaces = this.getOutputPlaces(transitionId);

    // Consume tokens from input places
    for (const [place, arc] of inputPlaces) {
      const weight = arc.weight || 1;
      const placeIndex = updatedPetriNet.places.findIndex(p => p.id === place.id);
      if (placeIndex !== -1) {
        updatedPetriNet.places[placeIndex].tokens = Math.max(0, (place.tokens || 0) - weight);
      }
    }

    // Produce tokens in output places
    for (const [place, arc] of outputPlaces) {
      const weight = arc.weight || 1;
      const placeIndex = updatedPetriNet.places.findIndex(p => p.id === place.id);
      if (placeIndex !== -1) {
        const currentTokens = updatedPetriNet.places[placeIndex].tokens || 0;
        updatedPetriNet.places[placeIndex].tokens = Math.min(this.maxTokens, currentTokens + weight);
      }
    }

    // Update internal state
    this.petriNet = updatedPetriNet;
    this.places = updatedPetriNet.places;
    this.transitions = updatedPetriNet.transitions;
    this.arcs = updatedPetriNet.arcs;

    return updatedPetriNet;
  }

  /**
   * Fire multiple transitions
   */
  fireMultipleTransitions(transitionIds) {
    let currentPetriNet = this.petriNet;
    
    for (const transitionId of transitionIds) {
      try {
        currentPetriNet = this.fireTransition(transitionId);
      } catch (error) {
        console.error(`Error firing transition ${transitionId}:`, error);
        throw error;
      }
    }
    
    return currentPetriNet;
  }

  /**
   * Update simulator with new Petri net state
   */
  update(petriNet) {
    this.petriNet = petriNet;
    this.places = petriNet.places || [];
    this.transitions = petriNet.transitions || [];
    this.arcs = petriNet.arcs || [];
  }

  /**
   * Get current Petri net state
   */
  getCurrentState() {
    return this.petriNet;
  }

  /**
   * Get simulator status for debugging
   */
  getStatus() {
    return {
      isInitialized: true,
      type: 'javascript',
      hasPetriNet: !!this.petriNet,
      petriNetSize: this.petriNet ? {
        places: this.petriNet.places?.length || 0,
        transitions: this.petriNet.transitions?.length || 0,
        arcs: this.petriNet.arcs?.length || 0
      } : null
    };
  }
}
