/**
 * HistoryManager class for implementing undo/redo functionality
 * Maintains a history of states and provides methods to navigate through them
 */
import { logger } from '../../utils/logger.js';
import { compareStates } from './utils/stateCompare.js';
import { deepCopyState, validateState } from './utils/stateCopy.js';

export class HistoryManager {
  constructor(initialState) {
    this.states = [deepCopyState(initialState)];
    this.currentIndex = 0;
    this.maxStates = 50;
  }

  addState(newState) {
    const stateCopy = deepCopyState(newState);
    const currentState = this.states[this.currentIndex];
    if (this.currentIndex >= 0 && compareStates(currentState, stateCopy)) {
      logger.debug('HistoryManager: State unchanged, not adding to history');
      return {
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      };
    }

    logger.debug(`HistoryManager: Adding new state to history. Current index: ${this.currentIndex}, States count: ${this.states.length}`);

    if (this.currentIndex < this.states.length - 1) {
      logger.debug(`HistoryManager: Removing ${this.states.length - this.currentIndex - 1} future states`);
      this.states = this.states.slice(0, this.currentIndex + 1);
    }

    this.states.push(stateCopy);
    this.currentIndex++;

    if (this.states.length > this.maxStates) {
      this.states.shift();
      this.currentIndex--;
    }

    logger.debug(`HistoryManager: New state added. Current index: ${this.currentIndex}, States count: ${this.states.length}`);

    return {
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  undo() {
    if (!this.canUndo()) {
      logger.debug('HistoryManager: Cannot undo - no previous states');
      return null;
    }
    
    this.currentIndex--;
    const state = this.states[this.currentIndex];
    
    logger.debug(`HistoryManager: Undoing to index ${this.currentIndex}, states count: ${this.states.length}`);
    
    return {
      state: validateState(state),
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  redo() {
    if (!this.canRedo()) {
      logger.debug('HistoryManager: Cannot redo - no future states');
      return null;
    }
    
    this.currentIndex++;
    const state = this.states[this.currentIndex];
    
    logger.debug(`HistoryManager: Redoing to index ${this.currentIndex}, states count: ${this.states.length}`);
    
    return {
      state: validateState(state),
      canUndo: this.canUndo(),
      canRedo: this.canRedo()
    };
  }

  canUndo() {
    return this.currentIndex > 0;
  }

  canRedo() {
    return this.currentIndex < this.states.length - 1;
  }

  getCurrentState() {
    return this.states[this.currentIndex];
  }

  deepCopyState(state) {
    return deepCopyState(state);
  }

  validateState(state) {
    return validateState(state);
  }
}
