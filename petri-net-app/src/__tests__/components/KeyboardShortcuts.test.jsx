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

describe('Keyboard Shortcuts', () => {
  // Create a spy on the document.addEventListener
  let addEventListenerSpy;
  let keydownHandlers = [];
  
  beforeEach(() => {
    // Clear previous handlers
    keydownHandlers = [];
    
    // Spy on addEventListener to capture the keydown handler
    addEventListenerSpy = jest.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'keydown') {
        keydownHandlers.push(handler);
      }
    });
  });
  
  afterEach(() => {
    // Restore the original addEventListener
    addEventListenerSpy.mockRestore();
  });
  
  test('should register keydown event listener when component mounts', () => {
    render(<App />);
    
    // Check if addEventListener was called with 'keydown'
    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
  
  test('should handle Ctrl+Z for undo', () => {
    render(<App />);
    
    // Get the keydown handler
    const keydownHandler = keydownHandlers[0];
    
    // Simulate Ctrl+Z keydown event
    keydownHandler({ key: 'z', ctrlKey: true, preventDefault: jest.fn() });
    
    // Check if the history manager's undo method was called
    expect(mockUndo).toHaveBeenCalled();
  });
  
  test('should handle Ctrl+Y for redo', () => {
    render(<App />);
    
    // Get the keydown handler
    const keydownHandler = keydownHandlers[0];
    
    // Simulate Ctrl+Y keydown event
    keydownHandler({ key: 'y', ctrlKey: true, preventDefault: jest.fn() });
    
    // Check if the history manager's redo method was called
    expect(mockRedo).toHaveBeenCalled();
  });
});
