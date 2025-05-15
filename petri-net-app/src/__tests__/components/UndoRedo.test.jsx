import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../App';

// Mock the handleUndo and handleRedo functions
const mockHandleUndo = jest.fn();
const mockHandleRedo = jest.fn();

// Mock the App module
jest.mock('../../App', () => {
  const originalModule = jest.requireActual('../../App');
  const mockApp = (props) => originalModule.default(props);
  mockApp.displayName = 'MockedApp';
  return {
    __esModule: true,
    default: mockApp
  };
});

// Mock the keyboard event handlers
jest.spyOn(document, 'addEventListener').mockImplementation((event, handler) => {
  if (event === 'keydown') {
    // Store the handler for later use in tests
    global.keydownHandler = handler;
  }
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

// Mock the historyManager
jest.mock('../../utils/historyManager', () => {
  return {
    HistoryManager: jest.fn().mockImplementation(() => ({
      addState: jest.fn().mockReturnValue({ canUndo: true, canRedo: false }),
      undo: jest.fn().mockReturnValue({
        state: { places: [], transitions: [], arcs: [] },
        canUndo: false,
        canRedo: true
      }),
      redo: jest.fn().mockReturnValue({
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

describe('Undo/Redo Functionality', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    mockHandleUndo.mockClear();
    mockHandleRedo.mockClear();
  });
  test('should render undo and redo buttons in toolbar', () => {
    render(<App />);
    
    // Check if undo and redo buttons are rendered in the toolbar
    const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
    const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
    
    expect(undoButton).toBeInTheDocument();
    expect(redoButton).toBeInTheDocument();
  });
  
  test('should trigger undo when Ctrl+Z is pressed', () => {
    // Mock the handleKeyDown function
    App.prototype.handleKeyDown = jest.fn((e) => {
      if (e.ctrlKey && e.key === 'z') {
        mockHandleUndo();
      }
    });
    
    render(<App />);
    
    // Simulate Ctrl+Z keyboard shortcut using the stored handler
    global.keydownHandler({ key: 'z', ctrlKey: true });
    
    // Check if the handleUndo method was called
    expect(mockHandleUndo).toHaveBeenCalled();
  });
  
  test('should trigger redo when Ctrl+Y is pressed', () => {
    // Mock the handleKeyDown function
    App.prototype.handleKeyDown = jest.fn((e) => {
      if (e.ctrlKey && e.key === 'y') {
        mockHandleRedo();
      }
    });
    
    render(<App />);
    
    // Simulate Ctrl+Y keyboard shortcut using the stored handler
    global.keydownHandler({ key: 'y', ctrlKey: true });
    
    // Check if the handleRedo method was called
    expect(mockHandleRedo).toHaveBeenCalled();
  });
  
  test('should update UI when undo button is clicked', () => {
    // Mock the onUndo prop for Toolbar
    const originalRender = render;
    render = jest.fn((element) => {
      if (element.type === App) {
        // Replace the onUndo prop with our mock
        const modifiedElement = React.cloneElement(element, {
          onUndo: mockHandleUndo
        });
        return originalRender(modifiedElement);
      }
      return originalRender(element);
    });
    
    render(<App />);
    
    // Click the undo button
    const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
    fireEvent.click(undoButton);
    
    // Check if the handleUndo method was called
    expect(mockHandleUndo).toHaveBeenCalled();
    
    // Restore original render
    render = originalRender;
  });
  
  test('should update UI when redo button is clicked', () => {
    // Mock the onRedo prop for Toolbar
    const originalRender = render;
    render = jest.fn((element) => {
      if (element.type === App) {
        // Replace the onRedo prop with our mock
        const modifiedElement = React.cloneElement(element, {
          onRedo: mockHandleRedo
        });
        return originalRender(modifiedElement);
      }
      return originalRender(element);
    });
    
    render(<App />);
    
    // Click the redo button
    const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
    fireEvent.click(redoButton);
    
    // Check if the handleRedo method was called
    expect(mockHandleRedo).toHaveBeenCalled();
    
    // Restore original render
    render = originalRender;
  });
  
  test('should disable undo button when cannot undo', () => {
    // Override the mock to return false for canUndo
    const { HistoryManager } = require('../../utils/historyManager');
    HistoryManager.mockImplementation(() => ({
      addState: jest.fn().mockReturnValue({ canUndo: false, canRedo: true }),
      undo: jest.fn(),
      redo: jest.fn(),
      canUndo: jest.fn().mockReturnValue(false),
      canRedo: jest.fn().mockReturnValue(true),
      getCurrentState: jest.fn().mockReturnValue({ places: [], transitions: [], arcs: [] })
    }));
    
    render(<App />);
    
    // Check if the undo button is disabled
    const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
    expect(undoButton).toBeDisabled();
  });
  
  test('should disable redo button when cannot redo', () => {
    // Override the mock to return false for canRedo
    const { HistoryManager } = require('../../utils/historyManager');
    HistoryManager.mockImplementation(() => ({
      addState: jest.fn().mockReturnValue({ canUndo: true, canRedo: false }),
      undo: jest.fn(),
      redo: jest.fn(),
      canUndo: jest.fn().mockReturnValue(true),
      canRedo: jest.fn().mockReturnValue(false),
      getCurrentState: jest.fn().mockReturnValue({ places: [], transitions: [], arcs: [] })
    }));
    
    render(<App />);
    
    // Check if the redo button is disabled
    const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
    expect(redoButton).toBeDisabled();
  });
});
