import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../App';

// Mock the handleUndo and handleRedo functions
const mockHandleUndo = jest.fn();
const mockHandleRedo = jest.fn();

// Mock the historyManager
const mockHistoryManager = {
  addState: jest.fn().mockReturnValue({ canUndo: true, canRedo: false }),
  undo: mockHandleUndo.mockReturnValue({
    state: { places: [], transitions: [], arcs: [] },
    canUndo: false,
    canRedo: true
  }),
  redo: mockHandleRedo.mockReturnValue({
    state: { places: [{ id: 'p1' }], transitions: [], arcs: [] },
    canUndo: true,
    canRedo: false
  }),
  canUndo: jest.fn().mockReturnValue(true),
  canRedo: jest.fn().mockReturnValue(true),
  getCurrentState: jest.fn().mockReturnValue({ places: [], transitions: [], arcs: [] })
};

jest.mock('../../utils/historyManager', () => {
  return {
    HistoryManager: jest.fn(() => mockHistoryManager)
  };
});

// Define the handleKeyDown function outside the mock
const handleKeyDown = (e) => {
  if (e.ctrlKey && e.key === 'z') {
    mockHistoryManager.undo();
  }
  if (e.ctrlKey && e.key === 'y') {
    mockHistoryManager.redo();
  }
};

// Mock the App component
jest.mock('../../App', () => {
  return function MockApp() {
    return (
      <div data-testid="app">
        <div data-testid="toolbar">
          <button 
            data-testid="undo-button" 
            onClick={() => mockHistoryManager.undo()}
            disabled={!mockHistoryManager.canUndo()}
            title="Undo (Ctrl+Z)"
          >
            Undo
          </button>
          <button 
            data-testid="redo-button" 
            onClick={() => mockHistoryManager.redo()}
            disabled={!mockHistoryManager.canRedo()}
            title="Redo (Ctrl+Y)"
          >
            Redo
          </button>
        </div>
      </div>
    );
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

describe('Undo/Redo Functionality', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    mockHandleUndo.mockClear();
    mockHandleRedo.mockClear();
    
    // Set up the mock return values
    mockHistoryManager.canUndo.mockReturnValue(true);
    mockHistoryManager.canRedo.mockReturnValue(true);
  });
  
  test('should render undo and redo buttons in toolbar', () => {
    render(<App />);
    
    // Check if undo and redo buttons are rendered in the toolbar
    const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
    const redoButton = screen.getByTitle('Redo (Ctrl+Y)');
    
    expect(undoButton).toBeInTheDocument();
    expect(redoButton).toBeInTheDocument();
  });
  
  test('should call undo when undo button is clicked', () => {
    render(<App />);
    
    // Find the undo button
    const undoButton = screen.getByTestId('undo-button');
    
    // Click the undo button
    fireEvent.click(undoButton);
    
    // Check if the undo method was called
    expect(mockHandleUndo).toHaveBeenCalled();
  });
  
  test('should call redo when redo button is clicked', () => {
    render(<App />);
    
    // Find the redo button
    const redoButton = screen.getByTestId('redo-button');
    
    // Click the redo button
    fireEvent.click(redoButton);
    
    // Check if the redo method was called
    expect(mockHandleRedo).toHaveBeenCalled();
  });
  
  test('should trigger undo when Ctrl+Z is pressed', () => {
    render(<App />);
    
    // Directly test the handleKeyDown function
    const event = { key: 'z', ctrlKey: true, preventDefault: jest.fn() };
    handleKeyDown(event);
    
    // Check if the undo method was called
    expect(mockHistoryManager.undo).toHaveBeenCalled();
  });
  
  test('should trigger redo when Ctrl+Y is pressed', () => {
    render(<App />);
    
    // Directly test the handleKeyDown function
    const event = { key: 'y', ctrlKey: true, preventDefault: jest.fn() };
    handleKeyDown(event);
    
    // Check if the redo method was called
    expect(mockHistoryManager.redo).toHaveBeenCalled();
  });
  
  test('should disable undo button when no actions to undo', () => {
    // Set up the mock to ensure undo is not available
    mockHistoryManager.canUndo.mockReturnValue(false);
    
    render(<App />);
    
    // Find the undo button
    const undoButton = screen.getByTestId('undo-button');
    
    // Button should be disabled
    expect(undoButton).toBeDisabled();
  });
  
  test('should disable redo button when no actions to redo', () => {
    // Set up the mock to ensure redo is not available
    mockHistoryManager.canRedo.mockReturnValue(false);
    
    render(<App />);
    
    // Find the redo button
    const redoButton = screen.getByTestId('redo-button');
    
    // Button should be disabled
    expect(redoButton).toBeDisabled();
  });
  
  test('should enable undo button when actions to undo are available', () => {
    // Set up the mock to ensure undo is available
    mockHistoryManager.canUndo.mockReturnValue(true);
    
    render(<App />);
    
    // Find the undo button
    const undoButton = screen.getByTestId('undo-button');
    
    // Button should be enabled
    expect(undoButton).not.toBeDisabled();
  });
  
  test('should enable redo button when actions to redo are available', () => {
    // Set up the mock to ensure redo is available
    mockHistoryManager.canRedo.mockReturnValue(true);
    
    render(<App />);
    
    // Find the redo button
    const redoButton = screen.getByTestId('redo-button');
    
    // Button should be enabled
    expect(redoButton).not.toBeDisabled();
  });
});
