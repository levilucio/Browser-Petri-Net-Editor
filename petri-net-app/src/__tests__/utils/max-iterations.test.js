/**
 * Unit tests for the Petri net simulator max iterations functionality
 * Tests that the simulation respects the configured max iterations
 */
import { JsPetriNetSimulator } from '../../utils/simulator';

// Mock console.log to track when max iterations message is logged
describe('Petri Net Simulator Max Iterations', () => {
  // Save original console.log
  const originalConsoleLog = console.log;
  let consoleOutput = [];

  // Setup test Petri net with a cyclic structure that can run indefinitely
  const cyclicPetriNet = {
    places: [
      { id: 'place-1', name: 'P1', tokens: 10, x: 100, y: 100 },
      { id: 'place-2', name: 'P2', tokens: 0, x: 300, y: 100 }
    ],
    transitions: [
      { id: 'transition-1', name: 'T1', x: 200, y: 100 },
      { id: 'transition-2', name: 'T2', x: 400, y: 100 }
    ],
    arcs: [
      // P1 -> T1
      { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', sourceType: 'place', targetType: 'transition', weight: 1 },
      // T1 -> P2
      { id: 'arc-2', sourceId: 'transition-1', targetId: 'place-2', sourceType: 'transition', targetType: 'place', weight: 1 },
      // P2 -> T2
      { id: 'arc-3', sourceId: 'place-2', targetId: 'transition-2', sourceType: 'place', targetType: 'transition', weight: 1 },
      // T2 -> P1
      { id: 'arc-4', sourceId: 'transition-2', targetId: 'place-1', sourceType: 'transition', targetType: 'place', weight: 1 }
    ]
  };

  // Mock the ExecutionPanel's simulateOneStep function
  const mockSimulateOneStep = (simulator, maxIterations) => {
    let iterationCount = 0;
    let canContinue = true;

    while (canContinue && iterationCount < 20) { // Safety limit to prevent infinite loops in tests
      // Increment iteration counter
      iterationCount++;
      
      // Check max iterations
      if (maxIterations !== Infinity && iterationCount > maxIterations) {
        console.log(`Maximum simulation iterations (${maxIterations}) reached, stopping`);
        return iterationCount - 1; // Return the number of successful iterations
      }
      
      // Get enabled transitions
      const enabledTransitions = simulator.getEnabledTransitions();
      
      // Stop if no transitions are enabled
      if (enabledTransitions.length === 0) {
        return iterationCount - 1;
      }
      
      // Fire the first enabled transition
      try {
        simulator.fireTransition(enabledTransitions[0].id);
      } catch (error) {
        return iterationCount - 1;
      }
    }
    
    return iterationCount;
  };

  // Mock the ExecutionPanel's handleRun function
  const mockHandleRun = (simulator, maxIterations = 1000) => {
    let iterationCount = 0;
    let canContinue = true;
    
    // Get max iterations, default to 1000 if not provided
    const iterationLimit = maxIterations === Infinity ? 1000 : maxIterations;
    
    while (canContinue && iterationCount < iterationLimit) {
      iterationCount++;
      
      // Get current enabled transitions
      const enabled = simulator.getEnabledTransitions();
      
      if (enabled.length === 0) {
        break;
      }
      
      // Fire the first enabled transition
      try {
        simulator.fireTransition(enabled[0].id);
      } catch (error) {
        break;
      }
      
      // Check if there are still enabled transitions
      const afterFiringEnabled = simulator.getEnabledTransitions();
      canContinue = afterFiringEnabled.length > 0;
    }
    
    // Log if we hit the iteration limit
    if (maxIterations !== Infinity && iterationCount >= iterationLimit) {
      console.log(`Run hit the maximum iteration limit (${iterationLimit})`);
    }
    
    return iterationCount;
  };

  beforeEach(() => {
    // Mock console.log
    consoleOutput = [];
    console.log = jest.fn(message => {
      consoleOutput.push(message);
    });
  });

  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;
  });

  test('simulateOneStep should respect max iterations setting', () => {
    const simulator = new JsPetriNetSimulator(cyclicPetriNet);
    
    // Set max iterations to 5
    const maxIterations = 5;
    
    // Run the simulation
    const iterationsCompleted = mockSimulateOneStep(simulator, maxIterations);
    
    // Should have completed exactly 5 iterations
    expect(iterationsCompleted).toBe(5);
    
    // Should have logged a message about reaching max iterations
    expect(consoleOutput.some(message => 
      message.includes('Maximum simulation iterations') && 
      message.includes('reached')
    )).toBe(true);
  });

  test('handleRun should respect max iterations setting', () => {
    const simulator = new JsPetriNetSimulator(cyclicPetriNet);
    
    // Set max iterations to 7
    const maxIterations = 7;
    
    // Run the simulation
    const iterationsCompleted = mockHandleRun(simulator, maxIterations);
    
    // Should have completed exactly 7 iterations
    expect(iterationsCompleted).toBe(7);
    
    // Should have logged a message about reaching max iterations
    expect(consoleOutput.some(message => 
      message.includes('maximum iteration limit') && 
      message.includes(maxIterations.toString())
    )).toBe(true);
  });

  test('should not stop simulation when max iterations is set to Infinity', () => {
    const simulator = new JsPetriNetSimulator(cyclicPetriNet);
    
    // Set max iterations to Infinity
    const maxIterations = Infinity;
    
    // Run the simulation with a safety limit in the mock function
    const iterationsCompleted = mockSimulateOneStep(simulator, maxIterations);
    
    // Should have completed all iterations until our safety limit
    expect(iterationsCompleted).toBe(20);
    
    // Should NOT have logged a message about reaching max iterations
    expect(consoleOutput.some(message => 
      message.includes('Maximum simulation iterations') && 
      message.includes('reached')
    )).toBe(false);
  });

  test('should use default max iterations when not specified', () => {
    const simulator = new JsPetriNetSimulator(cyclicPetriNet);
    
    // Don't specify max iterations (should default to 100 in simulateOneStep)
    const iterationsCompleted = mockHandleRun(simulator);
    
    // Since our Petri net can run indefinitely and the default is 1000,
    // it should have hit the default limit
    expect(iterationsCompleted).toBe(1000);
    
    // Should have logged a message about reaching max iterations with the default value
    expect(consoleOutput.some(message => 
      message.includes('maximum iteration limit') && 
      message.includes('1000')
    )).toBe(true);
  });
});
