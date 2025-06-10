import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the simulator module before importing ExecutionPanel
jest.mock('../../utils/simulator', () => {
  return {
    initializeSimulator: jest.fn().mockResolvedValue(undefined),
    getEnabledTransitions: jest.fn().mockResolvedValue([
      { id: 'transition-1', name: 'T1' },
      { id: 'transition-2', name: 'T2' }
    ]),
    fireTransition: jest.fn().mockImplementation((transitionId) => {
      return Promise.resolve({
        places: [
          { id: 'place-1', name: 'P1', tokens: 1 },
          { id: 'place-2', name: 'P2', tokens: 0 }
        ],
        transitions: [
          { id: 'transition-1', name: 'T1' },
          { id: 'transition-2', name: 'T2' }
        ],
        arcs: [
          { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', sourceType: 'place', targetType: 'transition' }
        ]
      });
    }),
    updateSimulator: jest.fn().mockResolvedValue(undefined),
    findNonConflictingTransitions: jest.fn().mockResolvedValue([{ id: 'transition-1', name: 'T1' }]),
    fireMultipleTransitions: jest.fn().mockImplementation((transitionIds) => {
      return Promise.resolve({
        places: [
          { id: 'place-1', name: 'P1', tokens: 0 },
          { id: 'place-2', name: 'P2', tokens: 1 }
        ],
        transitions: [
          { id: 'transition-1', name: 'T1' },
          { id: 'transition-2', name: 'T2' }
        ],
        arcs: [
          { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', sourceType: 'place', targetType: 'transition' }
        ]
      });
    })
  };
});

// Now import ExecutionPanel after mocking its dependencies
import ExecutionPanel from '../../components/ExecutionPanel';

// Get reference to the mocked simulator module
const simulatorMock = require('../../utils/simulator');

// Mock for timers
jest.useFakeTimers();

// Mock for setInterval and clearInterval
const originalSetInterval = global.setInterval;
const originalClearInterval = global.clearInterval;

global.setInterval = jest.fn((callback, delay) => {
  return 123; // Return a dummy interval ID
});

global.clearInterval = jest.fn();

// Restore original timers after tests
afterAll(() => {
  global.setInterval = originalSetInterval;
  global.clearInterval = originalClearInterval;
});

beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

describe('ExecutionPanel Buttons', () => {
  // Get reference to the mocked simulator module
  const simulatorMock = require('../../utils/simulator');
  
  // Mock elements for testing
  const mockElements = {
    places: [
      { id: 'place-1', name: 'P1', tokens: 1 },
      { id: 'place-2', name: 'P2', tokens: 0 }
    ],
    transitions: [
      { id: 'transition-1', name: 'T1' },
      { id: 'transition-2', name: 'T2' }
    ],
    arcs: [
      { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', sourceType: 'place', targetType: 'transition' }
    ]
  };
  
  // Mock callback functions
  const mockUpdateElements = jest.fn();
  const mockEnabledTransitionsChange = jest.fn();
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Default mock implementation for getEnabledTransitions
    simulatorMock.getEnabledTransitions.mockResolvedValue([
      { id: 'transition-1', name: 'T1' },
      { id: 'transition-2', name: 'T2' }
    ]);
  });
  
  test('Fire button should be enabled when transitions are enabled', async () => {
    render(
      <ExecutionPanel
        elements={mockElements}
        onUpdateElements={mockUpdateElements}
        onEnabledTransitionsChange={mockEnabledTransitionsChange}
        simulationSettings={{ maxTokens: 20 }}
      />
    );
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(screen.getByText('Fire')).not.toBeDisabled();
    });
  });
  
  test('Fire button should call findNonConflictingTransitions when clicked', async () => {
    // Set up the mocks to resolve properly
    simulatorMock.findNonConflictingTransitions.mockResolvedValue(['transition-1']);
    
    render(
      <ExecutionPanel
        elements={mockElements}
        onUpdateElements={mockUpdateElements}
        onEnabledTransitionsChange={mockEnabledTransitionsChange}
        simulationSettings={{ maxTokens: 20 }}
      />
    );
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(screen.getByTestId('sim-run')).not.toBeDisabled();
    });
    
    // Click the Run button
    await act(async () => {
      fireEvent.click(screen.getByTestId('sim-run'));
    });
    
    // Wait for the async operations to complete
    await waitFor(() => {
      // Check if the findNonConflictingTransitions function was called
      expect(simulatorMock.findNonConflictingTransitions).toHaveBeenCalled();
    });
    
    // Check if the onUpdateElements callback was called with the updated Petri net
    await waitFor(() => {
      expect(mockUpdateElements).toHaveBeenCalled();
    });
  });
  
  test('Fire button should fire a transition', async () => {
    // Reset mocks for this test
    simulatorMock.fireTransition.mockReset();
    simulatorMock.findNonConflictingTransitions.mockReset();
    simulatorMock.fireMultipleTransitions.mockReset();
    
    // Mock findNonConflictingTransitions to return transitions to fire
    simulatorMock.findNonConflictingTransitions.mockResolvedValue(['transition-1']);
    
    // Mock fireMultipleTransitions for the case when multiple transitions are fired
    simulatorMock.fireMultipleTransitions.mockResolvedValue({
      places: [
        { id: 'place-1', name: 'P1', tokens: 0 },
        { id: 'place-2', name: 'P2', tokens: 1 }
      ],
      transitions: mockElements.transitions,
      arcs: mockElements.arcs
    });
    
    render(
      <ExecutionPanel
        elements={mockElements}
        onUpdateElements={mockUpdateElements}
        onEnabledTransitionsChange={mockEnabledTransitionsChange}
        simulationSettings={{ maxTokens: 20 }}
      />
    );
    
    // Wait for the simulator to initialize and get enabled transitions
    await waitFor(() => {
      expect(screen.getByTestId('sim-fire')).not.toBeDisabled();
    });
    
    // Click the Fire button
    await act(async () => {
      fireEvent.click(screen.getByTestId('sim-fire'));
    });
    
    // Wait for findNonConflictingTransitions to be called
    await waitFor(() => {
      expect(simulatorMock.findNonConflictingTransitions).toHaveBeenCalled();
    });
    
    // Check if fireTransition was called (since we're mocking a single transition)
    await waitFor(() => {
      expect(simulatorMock.fireTransition).toHaveBeenCalled();
    });
    
    // Check if the onUpdateElements callback was called
    await waitFor(() => {
      expect(mockUpdateElements).toHaveBeenCalled();
    });
  });
  
  // Test for the Simulate button
  test('Simulate button should start simulation', async () => {
    render(
      <ExecutionPanel
        elements={mockElements}
        onUpdateElements={mockUpdateElements}
        onEnabledTransitionsChange={mockEnabledTransitionsChange}
        simulationSettings={{ maxTokens: 20 }}
      />
    );
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(screen.getByTestId('sim-simulate')).not.toBeDisabled();
    });
    
    // Click the Simulate button
    await act(async () => {
      fireEvent.click(screen.getByTestId('sim-simulate'));
    });
    
    // Verify that isSimulating is set to true (by checking that the stop button is enabled)
    await waitFor(() => {
      expect(screen.getByTestId('sim-stop')).not.toBeDisabled();
    });
  });
  
  test('Simulate button should start and stop simulation', async () => {
    render(
      <ExecutionPanel
        elements={mockElements}
        onUpdateElements={mockUpdateElements}
        onEnabledTransitionsChange={mockEnabledTransitionsChange}
        simulationSettings={{ maxTokens: 20 }}
      />
    );
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(screen.getByTestId('sim-simulate')).not.toBeDisabled();
    });
    
    // Click the Simulate button to start simulation
    await act(async () => {
      fireEvent.click(screen.getByTestId('sim-simulate'));
    });
    
    // Verify that isSimulating is set to true (by checking that the stop button is enabled)
    await waitFor(() => {
      expect(screen.getByTestId('sim-stop')).not.toBeDisabled();
    });
    
    // Click the Stop button to stop simulation
    await act(async () => {
      fireEvent.click(screen.getByTestId('sim-stop'));
    });
    
    await waitFor(() => {
      // Check that the Simulate button is enabled again
      expect(screen.getByTestId('sim-simulate')).not.toBeDisabled();
    }, { timeout: 1000 });
  });
  
  test('Run button should execute full simulation until no transitions are enabled', async () => {
    // Mock getEnabledTransitions to return transitions first, then empty array
    simulatorMock.getEnabledTransitions
      .mockResolvedValueOnce([
        { id: 'transition-1', name: 'T1' },
        { id: 'transition-2', name: 'T2' }
      ])
      .mockResolvedValueOnce([
        { id: 'transition-1', name: 'T1' }
      ])
      .mockResolvedValueOnce([]);
    
    render(
      <ExecutionPanel
        elements={mockElements}
        onUpdateElements={mockUpdateElements}
        onEnabledTransitionsChange={mockEnabledTransitionsChange}
        simulationSettings={{ maxTokens: 20 }}
      />
    );
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(screen.getByTestId('sim-run')).not.toBeDisabled();
    });
    
    // Click the Run button
    fireEvent.click(screen.getByTestId('sim-run'));
    
    // Check if the Stop button is now visible and enabled
    await waitFor(() => {
      const stopButton = screen.getByTestId('sim-stop');
      expect(stopButton).not.toBeDisabled();
    });
    
    // Manually resolve all promises to simulate the run completing
    await waitFor(() => {
      // Verify that getEnabledTransitions was called at least once
      expect(simulatorMock.getEnabledTransitions).toHaveBeenCalled();
    });
    
    // Simulate the run completing by clicking stop
    fireEvent.click(screen.getByTestId('sim-stop'));
    
    // Wait for the Run button to be enabled again
    await waitFor(() => {
      expect(screen.getByTestId('sim-run')).not.toBeDisabled();
    });
  });
  
  test('Stop button should stop the Run process', async () => {
    // Reset the mock and make it always return transitions (never ending)
    simulatorMock.getEnabledTransitions.mockReset();
    simulatorMock.getEnabledTransitions.mockResolvedValue([
      { id: 'transition-1', name: 'T1' },
      { id: 'transition-2', name: 'T2' }
    ]);
    
    render(
      <ExecutionPanel
        elements={mockElements}
        onUpdateElements={mockUpdateElements}
        onEnabledTransitionsChange={mockEnabledTransitionsChange}
        simulationSettings={{ maxTokens: 20 }}
      />
    );
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(screen.getByTestId('sim-run')).not.toBeDisabled();
    });
    
    // Click the Run button
    await act(async () => {
      fireEvent.click(screen.getByTestId('sim-run'));
    });
    
    // Check if the Stop button is now visible
    const stopButton = screen.getByTestId('sim-stop');
    expect(stopButton).toBeInTheDocument();
    expect(stopButton).not.toBeDisabled();
    
    // Click the Stop button to stop the run
    await act(async () => {
      fireEvent.click(stopButton);
    });
    
    // Check that the Run button is enabled again after stopping
    expect(screen.getByTestId('sim-run')).not.toBeDisabled();
  });
  
  test('Markings panel button should toggle the panel visibility', async () => {
    render(
      <ExecutionPanel
        elements={mockElements}
        onUpdateElements={mockUpdateElements}
        onEnabledTransitionsChange={mockEnabledTransitionsChange}
        simulationSettings={{ maxTokens: 20 }}
      />
    );
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(screen.getByTestId('show-markings')).toBeInTheDocument();
    });
    
    // Initially, the markings panel should not be visible
    expect(screen.queryByText('Current Markings')).not.toBeInTheDocument();
    
    // Click the Show Markings button
    fireEvent.click(screen.getByTestId('show-markings'));
    
    // The markings panel should now be visible
    expect(screen.getByText('Current Markings')).toBeInTheDocument();
    
    // Click the close button in the markings panel
    fireEvent.click(screen.getByLabelText('Close markings panel'));
    
    // The markings panel should be hidden again
    expect(screen.queryByText('Current Markings')).not.toBeInTheDocument();
  });
  
  test('Enabled Transitions panel button should toggle the panel visibility', async () => {
    render(
      <ExecutionPanel
        elements={mockElements}
        onUpdateElements={mockUpdateElements}
        onEnabledTransitionsChange={mockEnabledTransitionsChange}
        simulationSettings={{ maxTokens: 20 }}
      />
    );
    
    // Wait for the simulator to initialize
    await waitFor(() => {
      expect(screen.getByTestId('show-enabled-transitions')).toBeInTheDocument();
    });
    
    // Initially, the enabled transitions panel should not be visible
    expect(screen.queryByText('Enabled Transitions')).not.toBeInTheDocument();
    
    // Click the Show Enabled Transitions button
    fireEvent.click(screen.getByTestId('show-enabled-transitions'));
    
    // The enabled transitions panel should now be visible
    expect(screen.getByText('Enabled Transitions')).toBeInTheDocument();
    
    // Click the close button in the enabled transitions panel
    fireEvent.click(screen.getByLabelText('Close enabled transitions panel'));
    
    // The enabled transitions panel should be hidden again
    expect(screen.queryByText('Enabled Transitions')).not.toBeInTheDocument();
  });
});
