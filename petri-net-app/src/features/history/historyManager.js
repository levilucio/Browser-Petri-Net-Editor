/**
 * HistoryManager class for implementing undo/redo functionality
 * Maintains a history of states and provides methods to navigate through them
 */
export class HistoryManager {
  constructor(initialState) {
    // Initialize with the current state
    this.states = [this.deepCopyState(initialState)];
    this.currentIndex = 0;
    this.maxStates = 50; // Maximum number of states to store (as per requirements)
  }

  /**
   * Add a new state to the history
   * @param {Object} newState - The new state to add
   * @returns {Object} Information about the current history state
   */
  addState(newState) {
    // Create a deep copy of the state to avoid reference issues
    const stateCopy = this.deepCopyState(newState);
    
    // Check if the state is different from the current state
    // to avoid adding duplicate states
    const currentState = this.states[this.currentIndex];
    if (this.currentIndex >= 0 && this.compareStates(currentState, stateCopy)) {
      console.log('HistoryManager: State unchanged, not adding to history');
      return {
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      };
    }
    
    console.log(`HistoryManager: Adding new state to history. Current index: ${this.currentIndex}, States count: ${this.states.length}`);
    
    // If we're not at the end of the history (user has undone some actions),
    // remove all states after the current index
    if (this.currentIndex < this.states.length - 1) {
      console.log(`HistoryManager: Removing ${this.states.length - this.currentIndex - 1} future states`);
      this.states = this.states.slice(0, this.currentIndex + 1);
    }
    
    // Add the new state
    this.states.push(stateCopy);
    this.currentIndex++;
    
    // If we've exceeded the maximum number of states, remove the oldest one
    if (this.states.length > this.maxStates) {
      this.states.shift();
      this.currentIndex--;
    }
    
    console.log(`HistoryManager: New state added. Current index: ${this.currentIndex}, States count: ${this.states.length}`);
    
    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  /**
   * Compare two states to check if they are equal using a more efficient method
   * @param {Object} state1 - The first state
   * @param {Object} state2 - The second state
   * @returns {boolean} True if the states are equal, false otherwise
   */
  compareStates(state1, state2) {
    // Fast path for null states
    if (!state1 || !state2) return false;
    
    // Compare places - check tokens more carefully
    if (state1.places.length !== state2.places.length) {
      console.log('HistoryManager: States differ in number of places');
      return false;
    }
    for (let i = 0; i < state1.places.length; i++) {
      const p1 = state1.places[i];
      const p2 = state2.places.find(p => p.id === p1.id);
      if (!p2) {
        console.log(`HistoryManager: Place ${p1.id} not found in second state`);
        return false;
      }
      
      // Compare all relevant properties including tokens
      if (p1.x !== p2.x || p1.y !== p2.y || p1.tokens !== p2.tokens || 
          p1.label !== p2.label || p1.name !== p2.name) {
        console.log(`HistoryManager: Place ${p1.id} differs - x: ${p1.x} vs ${p2.x}, y: ${p1.y} vs ${p2.y}, tokens: ${p1.tokens} vs ${p2.tokens}, label: ${p1.label} vs ${p2.label}, name: ${p1.name} vs ${p2.name}`);
        return false;
      }
    }
    
    // Compare transitions
    if (state1.transitions.length !== state2.transitions.length) {
      console.log('HistoryManager: States differ in number of transitions');
      return false;
    }
    for (let i = 0; i < state1.transitions.length; i++) {
      const t1 = state1.transitions[i];
      const t2 = state2.transitions.find(t => t.id === t1.id);
      if (!t2) {
        console.log(`HistoryManager: Transition ${t1.id} not found in second state`);
        return false;
      }
      
      // Compare all relevant properties
      if (t1.x !== t2.x || t1.y !== t2.y || t1.label !== t2.label || t1.name !== t2.name) {
        console.log(`HistoryManager: Transition ${t1.id} differs - x: ${t1.x} vs ${t2.x}, y: ${t1.y} vs ${t2.y}, label: ${t1.label} vs ${t2.label}, name: ${t1.name} vs ${t2.name}`);
        return false;
      }
    }
    
    // Compare arcs
    if (state1.arcs.length !== state2.arcs.length) {
      console.log('HistoryManager: States differ in number of arcs');
      return false;
    }
    for (let i = 0; i < state1.arcs.length; i++) {
      const a1 = state1.arcs[i];
      const a2 = state2.arcs.find(a => a.id === a1.id);
      if (!a2) {
        console.log(`HistoryManager: Arc ${a1.id} not found in second state`);
        return false;
      }
      
      // Compare all relevant properties
      if (a1.sourceId !== a2.sourceId || a1.targetId !== a2.targetId || 
          a1.weight !== a2.weight || a1.type !== a2.type) {
        console.log(`HistoryManager: Arc ${a1.id} differs - sourceId: ${a1.sourceId} vs ${a2.sourceId}, targetId: ${a1.targetId} vs ${a2.targetId}, weight: ${a1.weight} vs ${a2.weight}, type: ${a1.type} vs ${a2.type}`);
        return false;
      }
    }
    
    console.log('HistoryManager: States are identical');
    return true;
  }

  /**
   * Undo the last action
   * @returns {Object|null} The previous state, or null if can't undo
   */
  undo() {
    if (!this.canUndo()) {
      console.log('HistoryManager: Cannot undo - no previous states');
      return null;
    }
    
    this.currentIndex--;
    const state = this.states[this.currentIndex];
    
    console.log(`HistoryManager: Undoing to index ${this.currentIndex}, states count: ${this.states.length}`);
    
    // Validate the state before returning it
    const validatedState = this.validateState(state);
    
    return {
      state: validatedState,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  /**
   * Redo a previously undone action
   * @returns {Object|null} The next state, or null if can't redo
   */
  redo() {
    if (!this.canRedo()) {
      console.log('HistoryManager: Cannot redo - no future states');
      return null;
    }
    
    this.currentIndex++;
    const state = this.states[this.currentIndex];
    
    console.log(`HistoryManager: Redoing to index ${this.currentIndex}, states count: ${this.states.length}`);
    
    // Validate the state before returning it
    const validatedState = this.validateState(state);
    
    return {
      state: validatedState,
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  /**
   * Check if undo is possible
   * @returns {boolean} True if undo is possible
   */
  canUndo() {
    return this.currentIndex > 0;
  }

  /**
   * Check if redo is possible
   * @returns {boolean} True if redo is possible
   */
  canRedo() {
    return this.currentIndex < this.states.length - 1;
  }

  /**
   * Get the current state
   * @returns {Object} The current state
   */
  getCurrentState() {
    return this.states[this.currentIndex];
  }

  /**
   * Create a deep copy of a state object using a more efficient method
   * @param {Object} state - The state to copy
   * @returns {Object} A deep copy of the state
   */
  deepCopyState(state) {
    // Fast path for empty state
    if (!state || !state.places || !state.transitions || !state.arcs) {
      return { places: [], transitions: [], arcs: [] };
    }
    
    // Create a new state object with all essential properties
    const copy = {
      places: state.places.map(place => {
        // Create a completely new object with all properties
        const placeCopy = {};
        for (const key in place) {
          if (place.hasOwnProperty(key)) {
            // For primitive values, copy directly
            if (typeof place[key] !== 'object' || place[key] === null) {
              placeCopy[key] = place[key];
            } else if (Array.isArray(place[key])) {
              // For arrays, create a shallow copy
              placeCopy[key] = [...place[key]];
            } else {
              // For objects, create a shallow copy
              placeCopy[key] = { ...place[key] };
            }
          }
        }
        return placeCopy;
      }),
      transitions: state.transitions.map(transition => {
        // Create a completely new object with all properties
        const transitionCopy = {};
        for (const key in transition) {
          if (transition.hasOwnProperty(key)) {
            // For primitive values, copy directly
            if (typeof transition[key] !== 'object' || transition[key] === null) {
              transitionCopy[key] = transition[key];
            } else if (Array.isArray(transition[key])) {
              // For arrays, create a shallow copy
              transitionCopy[key] = [...transition[key]];
            } else {
              // For objects, create a shallow copy
              transitionCopy[key] = { ...transition[key] };
            }
          }
        }
        return transitionCopy;
      }),
      arcs: state.arcs.map(arc => {
        // Create a completely new object with all properties
        const arcCopy = {};
        for (const key in arc) {
          if (arc.hasOwnProperty(key)) {
            // For primitive values, copy directly
            if (typeof arc[key] !== 'object' || arc[key] === null) {
              arcCopy[key] = arc[key];
            } else if (Array.isArray(arc[key])) {
              // For arrays, create a shallow copy
              arcCopy[key] = [...arc[key]];
            } else {
              // For objects, create a shallow copy
              arcCopy[key] = { ...arc[key] };
            }
          }
        }
        return arcCopy;
      })
    };

    return copy;
  }

  /**
   * Validate a state to ensure all coordinates are valid numbers
   * @param {Object} state - The state to validate
   * @returns {Object} The validated state with any invalid coordinates fixed
   */
  validateState(state) {
    if (!state || !state.places || !state.transitions || !state.arcs) {
      return { places: [], transitions: [], arcs: [] };
    }

    const validatedState = {
      places: state.places.filter(place => {
        // Ensure coordinates are valid numbers
        if (typeof place.x !== 'number' || isNaN(place.x) || 
            typeof place.y !== 'number' || isNaN(place.y)) {
          console.warn(`Invalid coordinates for place ${place.id}: x=${place.x}, y=${place.y}`);
          return false;
        }
        return true;
      }).map(place => ({
        ...place,
        x: Number(place.x),
        y: Number(place.y),
        tokens: Number(place.tokens || 0)
      })),
      
      transitions: state.transitions.filter(transition => {
        // Ensure coordinates are valid numbers
        if (typeof transition.x !== 'number' || isNaN(transition.x) || 
            typeof transition.y !== 'number' || isNaN(transition.y)) {
          console.warn(`Invalid coordinates for transition ${transition.id}: x=${transition.x}, y=${transition.y}`);
          return false;
        }
        return true;
      }).map(transition => ({
        ...transition,
        x: Number(transition.x),
        y: Number(transition.y)
      })),
      
      arcs: state.arcs.filter(arc => {
        // Ensure arc has valid source and target IDs
        if (!arc.sourceId && !arc.source) {
          console.warn(`Arc ${arc.id} missing source`);
          return false;
        }
        if (!arc.targetId && !arc.target) {
          console.warn(`Arc ${arc.id} missing target`);
          return false;
        }
        return true;
      }).map(arc => {
        // Create a new arc object that preserves ALL original properties
        const validatedArc = { ...arc };
        
        // Only set fallbacks if the original values are actually missing
        // This prevents overwriting valid sourceId/targetId with fallback values
        if (!validatedArc.sourceId && validatedArc.source) {
          validatedArc.sourceId = validatedArc.source;
        }
        if (!validatedArc.targetId && validatedArc.target) {
          validatedArc.targetId = validatedArc.target;
        }
        
        // Ensure weight is a number
        if (typeof validatedArc.weight !== 'number' || isNaN(validatedArc.weight)) {
          validatedArc.weight = Number(validatedArc.weight || 1);
        }
        
        return validatedArc;
      })
    };

    return validatedState;
  }
}
