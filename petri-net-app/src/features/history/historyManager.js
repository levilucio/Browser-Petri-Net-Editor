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
      return {
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      };
    }
    
    // If we're not at the end of the history (user has undone some actions),
    // remove all states after the current index
    if (this.currentIndex < this.states.length - 1) {
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
    
    // Compare places
    if (state1.places.length !== state2.places.length) return false;
    for (let i = 0; i < state1.places.length; i++) {
      const p1 = state1.places[i];
      const p2 = state2.places.find(p => p.id === p1.id);
      if (!p2 || p1.x !== p2.x || p1.y !== p2.y || p1.tokens !== p2.tokens) {
        return false;
      }
    }
    
    // Compare transitions
    if (state1.transitions.length !== state2.transitions.length) return false;
    for (let i = 0; i < state1.transitions.length; i++) {
      const t1 = state1.transitions[i];
      const t2 = state2.transitions.find(t => t.id === t1.id);
      if (!t2 || t1.x !== t2.x || t1.y !== t2.y) {
        return false;
      }
    }
    
    // Compare arcs
    if (state1.arcs.length !== state2.arcs.length) return false;
    for (let i = 0; i < state1.arcs.length; i++) {
      const a1 = state1.arcs[i];
      const a2 = state2.arcs.find(a => a.id === a1.id);
      if (!a2 || a1.sourceId !== a2.sourceId || a1.targetId !== a2.targetId || a1.weight !== a2.weight) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Undo the last action
   * @returns {Object|null} The previous state, or null if can't undo
   */
  undo() {
    if (!this.canUndo()) {
      return null;
    }
    
    this.currentIndex--;
    return {
      state: this.states[this.currentIndex],
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
      return null;
    }
    
    this.currentIndex++;
    return {
      state: this.states[this.currentIndex],
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
    
    // Create a new state object with only the essential properties
    const copy = {
      places: state.places.map(place => ({
        id: place.id,
        x: place.x,
        y: place.y,
        tokens: place.tokens || 0,
        label: place.label || place.name || '',
        name: place.name || ''
      })),
      transitions: [],
      arcs: []
    };

    for (const transition of state.transitions) {
      copy.transitions.push({
        id: transition.id,
        x: transition.x,
        y: transition.y
      });
    }

    for (const arc of state.arcs) {
      copy.arcs.push({
        id: arc.id,
        source: arc.source,
        target: arc.target,
        weight: arc.weight
      });
    }

    return copy;
  }
}
