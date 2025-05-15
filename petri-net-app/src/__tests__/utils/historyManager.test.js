import { HistoryManager } from '../../utils/historyManager';

describe('HistoryManager', () => {
  let historyManager;
  const initialState = { places: [], transitions: [], arcs: [] };

  beforeEach(() => {
    historyManager = new HistoryManager(initialState);
  });

  test('should initialize with initial state', () => {
    expect(historyManager.getCurrentState()).toEqual(initialState);
    expect(historyManager.canUndo()).toBe(false);
    expect(historyManager.canRedo()).toBe(false);
  });

  test('should add new state and allow undo', () => {
    const newState = { 
      places: [{ id: 'p1', x: 100, y: 100 }], 
      transitions: [], 
      arcs: [] 
    };
    
    const result = historyManager.addState(newState);
    
    expect(result.canUndo).toBe(true);
    expect(result.canRedo).toBe(false);
    expect(historyManager.getCurrentState()).toEqual(newState);
  });

  test('should not add duplicate state', () => {
    const newState = { 
      places: [{ id: 'p1', x: 100, y: 100 }], 
      transitions: [], 
      arcs: [] 
    };
    
    historyManager.addState(newState);
    const stateCount = historyManager.states.length;
    
    // Add the same state again
    historyManager.addState(newState);
    
    // Should not have added a duplicate
    expect(historyManager.states.length).toBe(stateCount);
  });

  test('should undo and redo correctly', () => {
    const state1 = { 
      places: [{ id: 'p1', x: 100, y: 100 }], 
      transitions: [], 
      arcs: [] 
    };
    
    const state2 = { 
      places: [{ id: 'p1', x: 100, y: 100 }], 
      transitions: [{ id: 't1', x: 200, y: 200 }], 
      arcs: [] 
    };
    
    historyManager.addState(state1);
    historyManager.addState(state2);
    
    // Test undo
    const undoResult = historyManager.undo();
    expect(undoResult.state).toEqual(state1);
    expect(undoResult.canUndo).toBe(true); // Can still undo to initial state
    expect(undoResult.canRedo).toBe(true);
    
    // Test redo
    const redoResult = historyManager.redo();
    expect(redoResult.state).toEqual(state2);
    expect(redoResult.canUndo).toBe(true);
    expect(redoResult.canRedo).toBe(false);
  });

  test('should limit history to maxStates', () => {
    // Override maxStates for testing
    historyManager.maxStates = 3;
    
    // Add more states than the limit
    historyManager.addState({ places: [{ id: 'p1' }], transitions: [], arcs: [] });
    historyManager.addState({ places: [{ id: 'p1' }, { id: 'p2' }], transitions: [], arcs: [] });
    historyManager.addState({ places: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], transitions: [], arcs: [] });
    
    // This should push out the initial state
    historyManager.addState({ places: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }], transitions: [], arcs: [] });
    
    // Should have exactly maxStates states
    expect(historyManager.states.length).toBe(historyManager.maxStates);
    
    // First state should now be the one with a single place
    // The initial empty state should have been removed
    expect(historyManager.states[0].places.length).toBeGreaterThan(0);
  });

  test('should handle undo when at beginning of history', () => {
    // Try to undo when already at the beginning
    const result = historyManager.undo();
    
    // Should return null
    expect(result).toBeNull();
  });

  test('should handle redo when at end of history', () => {
    // Try to redo when already at the end
    const result = historyManager.redo();
    
    // Should return null
    expect(result).toBeNull();
  });

  test('should truncate future states when adding after undo', () => {
    historyManager.addState({ places: [{ id: 'p1' }], transitions: [], arcs: [] });
    historyManager.addState({ places: [{ id: 'p1' }, { id: 'p2' }], transitions: [], arcs: [] });
    
    // Undo to first state
    historyManager.undo();
    
    // Add a new state - this should remove the second state from history
    const newState = { places: [{ id: 'p1' }, { id: 'p3' }], transitions: [], arcs: [] };
    historyManager.addState(newState);
    
    // Should have exactly 3 states: initial, p1, and p1+p3
    expect(historyManager.states.length).toBe(3);
    
    // Try to redo - should not find the old p1+p2 state
    historyManager.undo();
    const redoResult = historyManager.redo();
    
    // Should get the new p1+p3 state
    expect(redoResult.state).toEqual(newState);
  });
});
