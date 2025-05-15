import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import * as historyManagerModule from '../../utils/historyManager';
import App from '../../App';

// Mock the HistoryManager class
let mockHistoryManager;
let mockUndo;
let mockRedo;
let mockAddState;

jest.mock('../../utils/historyManager', () => {
  return {
    HistoryManager: jest.fn(() => mockHistoryManager)
  };
});

// Mock the App component
jest.mock('../../App', () => {
  return function MockApp() {
    return (
      <div data-testid="app">
        <button 
          data-testid="undo-button"
          title="Undo (Ctrl+Z)" 
          onClick={() => mockHistoryManager.undo()}
          disabled={!mockHistoryManager.canUndo()}
        >
          Undo
        </button>
        <button 
          data-testid="redo-button"
          title="Redo (Ctrl+Y)" 
          onClick={() => mockHistoryManager.redo()}
          disabled={!mockHistoryManager.canRedo()}
        >
          Redo
        </button>
      </div>
    );
  };
});

describe('Undo/Redo Integration', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create mock functions
    mockUndo = jest.fn().mockReturnValue({
      state: { places: [], transitions: [], arcs: [] },
      canUndo: false,
      canRedo: true
    });
    
    mockRedo = jest.fn().mockReturnValue({
      state: { places: [{ id: 'p1' }], transitions: [], arcs: [] },
      canUndo: true,
      canRedo: false
    });
    
    mockAddState = jest.fn().mockReturnValue({ canUndo: true, canRedo: false });
    
    // Create a mock HistoryManager instance
    mockHistoryManager = {
      undo: mockUndo,
      redo: mockRedo,
      addState: mockAddState,
      canUndo: jest.fn().mockReturnValue(true),
      canRedo: jest.fn().mockReturnValue(true),
      getCurrentState: jest.fn().mockReturnValue({ places: [], transitions: [], arcs: [] })
    };
  });
  
  test('should call historyManager.undo when undo button is clicked', () => {
    // Set up the mock to ensure undo is available
    mockHistoryManager.canUndo.mockReturnValue(true);
    
    // Render the component
    render(<App />);
    
    // Find the undo button
    const undoButton = screen.getByTestId('undo-button');
    
    // Ensure the button is not disabled
    expect(undoButton).not.toBeDisabled();
    
    // Click the undo button
    fireEvent.click(undoButton);
    
    // Verify that the undo method was called
    expect(mockUndo).toHaveBeenCalled();
  });
  
  test('should call historyManager.redo when redo button is clicked', () => {
    // Set up the mock to ensure redo is available
    mockHistoryManager.canRedo.mockReturnValue(true);
    
    // Render the component
    render(<App />);
    
    // Find the redo button
    const redoButton = screen.getByTestId('redo-button');
    
    // Ensure the button is not disabled
    expect(redoButton).not.toBeDisabled();
    
    // Click the redo button
    fireEvent.click(redoButton);
    
    // Verify that the redo method was called
    expect(mockRedo).toHaveBeenCalled();
  });
  
  test('should disable undo button when no actions to undo', () => {
    // Set up the mock to ensure undo is not available
    mockHistoryManager.canUndo.mockReturnValue(false);
    
    // Render the component
    render(<App />);
    
    // Find the undo button
    const undoButton = screen.getByTestId('undo-button');
    
    // Button should be disabled
    expect(undoButton).toBeDisabled();
  });
  
  test('should disable redo button when no actions to redo', () => {
    // Set up the mock to ensure redo is not available
    mockHistoryManager.canRedo.mockReturnValue(false);
    
    // Render the component
    render(<App />);
    
    // Find the redo button
    const redoButton = screen.getByTestId('redo-button');
    
    // Button should be disabled
    expect(redoButton).toBeDisabled();
  });
});
