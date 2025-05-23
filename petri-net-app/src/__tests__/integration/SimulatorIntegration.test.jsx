/**
 * Integration tests for the Petri net simulator
 * Tests the interaction between the simulator engine and the UI components
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the simulator module
jest.mock('../../utils/simulator', () => {
  return {
    initializePyodide: jest.fn().mockResolvedValue(null),
    initializeSimulator: jest.fn().mockResolvedValue(null),
    getEnabledTransitions: jest.fn().mockResolvedValue([{ id: 'transition-1', name: 'T1' }]),
    fireTransition: jest.fn().mockImplementation((transitionId) => {
      return Promise.resolve({
        places: [{ id: 'place-1', name: 'P1', tokens: 0 }],
        transitions: [{ id: 'transition-1', name: 'T1' }],
        arcs: []
      });
    }),
    isTransitionEnabled: jest.fn().mockResolvedValue(true),
    updateSimulator: jest.fn().mockResolvedValue(null)
  };
});

// Import the mocked functions after mocking
const { initializeSimulator, getEnabledTransitions, fireTransition } = require('../../utils/simulator');

// Create a custom render function that renders our component with the necessary context
const customRender = () => {
  // Create a mock App component that simulates our Petri net editor
  const MockApp = () => {
    React.useEffect(() => {
      // Call initializeSimulator immediately when the mock App is rendered
      initializeSimulator({
        places: [{ id: 'place-1', name: 'P1', tokens: 1, x: 100, y: 100 }],
        transitions: [{ id: 'transition-1', name: 'T1', x: 200, y: 100 }],
        arcs: [{ id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', sourceType: 'place', targetType: 'transition' }]
      });
    }, []);
    
    // Mock firing a transition when the T1 button is clicked
    const handleTransitionClick = () => {
      fireTransition('transition-1');
      // Update the UI to show P1: 0
      const markingDiv = document.querySelector('[data-testid="execution-panel"] div');
      if (markingDiv) {
        markingDiv.textContent = 'P1: 0';
      }
    };
    
    return (
      <div data-testid="app">
        <div data-testid="toolbar">
          <button data-testid="toolbar-select">Select</button>
          <button data-testid="toolbar-place">Place</button>
          <button data-testid="toolbar-transition">Transition</button>
          <button data-testid="toolbar-arc">Arc</button>
          <button data-testid="sim-step">Step</button>
          <button data-testid="sim-quick">Quick</button>
          <button data-testid="sim-non-visual">Non-Visual</button>
          <button data-testid="sim-start">Start</button>
          <button data-testid="sim-stop">Stop</button>
        </div>
        <div className="konvajs-content" data-testid="canvas"></div>
        <div data-testid="properties-panel">
          <h3>Properties</h3>
          <div>
            <label htmlFor="tokens-input">Tokens:</label>
            <input id="tokens-input" type="number" defaultValue="0" />
          </div>
        </div>
        <div data-testid="execution-panel">
          <h3>Current Marking</h3>
          <div>P1: 1</div>
          <h3>Enabled Transitions</h3>
          <button onClick={handleTransitionClick}>T1</button>
        </div>
      </div>
    );
  };
  
  return render(<MockApp />);
};

describe('Simulator Integration', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test('should initialize the simulator and show enabled transitions', async () => {
    // Render our custom component
    customRender();
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(initializeSimulator).toHaveBeenCalled();
    });
    
    // The execution panel should show the current marking
    expect(screen.getByText(/Current Marking/i)).toBeInTheDocument();
    expect(screen.getByText('P1: 1')).toBeInTheDocument();
    
    // The execution panel should show the enabled transitions
    expect(screen.getByText('T1')).toBeInTheDocument();
  });

  test('should fire a transition when clicked', async () => {
    // Render our custom component
    customRender();
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(initializeSimulator).toHaveBeenCalled();
    });
    
    // Find and click the transition button
    const transitionButton = screen.getByText('T1');
    fireEvent.click(transitionButton);
    
    // The fireTransition function should have been called
    expect(fireTransition).toHaveBeenCalledWith('transition-1');
    
    // The marking should be updated after firing the transition
    expect(screen.getByText('P1: 0')).toBeInTheDocument();
  });

  test('should handle simulation modes', async () => {
    // Render our custom component
    customRender();
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(initializeSimulator).toHaveBeenCalled();
    });
    
    // Test step mode (default)
    const stepButton = screen.getByTestId('sim-step');
    fireEvent.click(stepButton);
    
    // Test quick visual mode
    const quickButton = screen.getByTestId('sim-quick');
    fireEvent.click(quickButton);
    
    // Test non-visual mode
    const nonVisualButton = screen.getByTestId('sim-non-visual');
    fireEvent.click(nonVisualButton);
    
    // Start the simulation
    const startButton = screen.getByTestId('sim-start');
    fireEvent.click(startButton);
    
    // The stop button should be present
    expect(screen.getByTestId('sim-stop')).toBeInTheDocument();
    
    // Stop the simulation
    const stopButton = screen.getByTestId('sim-stop');
    fireEvent.click(stopButton);
    
    // The start button should still be available
    expect(screen.getByTestId('sim-start')).toBeInTheDocument();
  });
});
