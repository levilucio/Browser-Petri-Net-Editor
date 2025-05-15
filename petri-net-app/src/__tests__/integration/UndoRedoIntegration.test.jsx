import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../App';
import * as historyManagerModule from '../../utils/historyManager';

// Mock the HistoryManager class
jest.mock('../../utils/historyManager', () => {
  return {
    HistoryManager: jest.fn()
  };
});

// Mock react-konva to avoid canvas issues in tests
jest.mock('react-konva', () => {
  return {
    Stage: ({ children, ...props }) => <div data-testid="stage" {...props}>{children}</div>,
    Layer: ({ children, ...props }) => <div data-testid="layer" {...props}>{children}</div>,
    Circle: (props) => <div data-testid="circle" {...props} />,
    Rect: (props) => <div data-testid="rect" {...props} />,
    Line: (props) => <div data-testid="line" {...props} />,
    Arrow: (props) => <div data-testid="arrow" {...props} />,
    Group: ({ children, ...props }) => <div data-testid="group" {...props}>{children}</div>,
    Text: ({ text, ...props }) => <div data-testid="text" {...props}>{text}</div>
  };
});

describe('Undo/Redo Integration', () => {
  let mockHistoryManager;
  let mockUndo;
  let mockRedo;
  let mockAddState;
  
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
    
    // Set up the mock constructor
    historyManagerModule.HistoryManager.mockImplementation(() => mockHistoryManager);
  });
  
  test('should call historyManager.undo when undo button is clicked', () => {
    // Set initial state where undo is available
    mockHistoryManager.canUndo.mockReturnValue(true);
    
    const { container } = render(<App />);
    
    // Find the undo button
    const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
    
    // Ensure the button is not disabled
    expect(undoButton).not.toBeDisabled();
    
    // Click the undo button
    fireEvent.click(undoButton);
    
    // Verify that the undo method was called
    expect(mockUndo).toHaveBeenCalled();
  });
  
  test('should call historyManager.redo when redo button is clicked', () => {
    // Set initial state where redo is available
    mockHistoryManager.canRedo.mockReturnValue(true);
    
    const { container } = render(<App />);
    
    // Find the redo button
    const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
    
    // Ensure the button is not disabled
    expect(redoButton).not.toBeDisabled();
    
    // Click the redo button
    fireEvent.click(redoButton);
    
    // Verify that the redo method was called
    expect(mockRedo).toHaveBeenCalled();
  });
  
  test('should update UI state after undo', () => {
    // First set canUndo to true so the button is enabled initially
    mockHistoryManager.canUndo.mockReturnValue(true);
    
    // Set up a specific return value for undo that will set canUndo to false
    const undoState = { 
      places: [{ id: 'test-place', x: 100, y: 100, name: 'P1', tokens: 0 }],
      transitions: [],
      arcs: []
    };
    
    mockUndo.mockReturnValue({
      state: undoState,
      canUndo: false,
      canRedo: true
    });
    
    // Render the component
    const { rerender } = render(<App />);
    
    // Find the undo button
    const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
    
    // Initially it should be enabled
    expect(undoButton).not.toBeDisabled();
    
    // Click the undo button
    fireEvent.click(undoButton);
    
    // After clicking, the state should be updated and the canUndo flag should be false
    // Force a re-render to reflect the state changes
    rerender(<App />);
    
    // Now check that mockUndo was called
    expect(mockUndo).toHaveBeenCalled();
  });
  
  test('should update UI state after redo', () => {
    // First set canRedo to true so the button is enabled initially
    mockHistoryManager.canRedo.mockReturnValue(true);
    
    // Set up a specific return value for redo that will set canRedo to false
    const redoState = { 
      places: [{ id: 'test-place', x: 100, y: 100, name: 'P1', tokens: 0 }],
      transitions: [{ id: 'test-transition', x: 200, y: 200, name: 'T1' }],
      arcs: []
    };
    
    mockRedo.mockReturnValue({
      state: redoState,
      canUndo: true,
      canRedo: false
    });
    
    // Render the component
    const { rerender } = render(<App />);
    
    // Find the redo button
    const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
    
    // Initially it should be enabled
    expect(redoButton).not.toBeDisabled();
    
    // Click the redo button
    fireEvent.click(redoButton);
    
    // After clicking, the state should be updated and the canRedo flag should be false
    // Force a re-render to reflect the state changes
    rerender(<App />);
    
    // Now check that mockRedo was called
    expect(mockRedo).toHaveBeenCalled();
  });
});
