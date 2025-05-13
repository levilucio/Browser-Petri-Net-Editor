/**
 * HistoryManager class for implementing undo/redo functionality
 * Maintains a history of states and provides methods to navigate through them
 */
export class HistoryManager {
  constructor(initialState) {
    // Initialize with the current state
    this.states = [JSON.parse(JSON.stringify(initialState))];
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
    const stateCopy = JSON.parse(JSON.stringify(newState));
    
    // Check if the state is different from the current state
    // to avoid adding duplicate states
    const currentState = this.states[this.currentIndex];
    if (this.currentIndex >= 0 && JSON.stringify(currentState) === JSON.stringify(stateCopy)) {
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
}
