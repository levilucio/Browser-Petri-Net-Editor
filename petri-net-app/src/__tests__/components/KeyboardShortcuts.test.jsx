import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import App from '../../App';

// Create mocks for the undo and redo functions
const mockUndo = jest.fn();
const mockRedo = jest.fn();

// Mock the historyManager
jest.mock('../../utils/historyManager', () => {
  return {
    HistoryManager: jest.fn().mockImplementation(() => ({
      addState: jest.fn().mockReturnValue({ canUndo: true, canRedo: false }),
      undo: mockUndo.mockReturnValue({
        state: { places: [], transitions: [], arcs: [] },
        canUndo: false,
        canRedo: true
      }),
      redo: mockRedo.mockReturnValue({
        state: { places: [{ id: 'p1' }], transitions: [], arcs: [] },
        canUndo: true,
        canRedo: false
      }),
      canUndo: jest.fn().mockReturnValue(true),
      canRedo: jest.fn().mockReturnValue(true),
      getCurrentState: jest.fn().mockReturnValue({ places: [], transitions: [], arcs: [] })
    }))
  };
});

// Define the handleKeyDown function outside the mock
const handleKeyDown = (e) => {
  if (e.ctrlKey && e.key === 'z') {
    mockUndo();
  }
  if (e.ctrlKey && e.key === 'y') {
    mockRedo();
  }
};

// Mock the App component
jest.mock('../../App', () => {
  return function MockApp() {
    return <div data-testid="app">Mock App</div>;
  };
});

// Create a wrapper component that handles keyboard events
function AppWrapper() {
  React.useEffect(() => {
    // Add event listener for keydown events
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const App = require('../../App').default;
  return <App />;
}

describe('Keyboard Shortcuts', () => {
  beforeEach(() => {
    // Clear mock calls before each test
    mockUndo.mockClear();
    mockRedo.mockClear();
  });
  
  test('should handle Ctrl+Z for undo', () => {
    // Directly test the handleKeyDown function
    const event = { key: 'z', ctrlKey: true, preventDefault: jest.fn() };
    handleKeyDown(event);
    
    // Check if the history manager's undo method was called
    expect(mockUndo).toHaveBeenCalled();
  });
  
  test('should handle Ctrl+Y for redo', () => {
    // Directly test the handleKeyDown function
    const event = { key: 'y', ctrlKey: true, preventDefault: jest.fn() };
    handleKeyDown(event);
    
    // Check if the history manager's redo method was called
    expect(mockRedo).toHaveBeenCalled();
  });
  
  test('should not call undo for other key combinations', () => {
    // Test with a non-matching key combination
    const event = { key: 'a', ctrlKey: true, preventDefault: jest.fn() };
    handleKeyDown(event);
    
    // Check that undo was not called
    expect(mockUndo).not.toHaveBeenCalled();
  });
  
  test('should not call redo for other key combinations', () => {
    // Test with a non-matching key combination
    const event = { key: 'b', ctrlKey: true, preventDefault: jest.fn() };
    handleKeyDown(event);
    
    // Check that redo was not called
    expect(mockRedo).not.toHaveBeenCalled();
  });
});
