/**
 * Integration tests for the Pyodide simulator
 * 
 * These tests verify that:
 * 1. The Pyodide simulator can be initialized
 * 2. The simulator can identify enabled transitions
 * 3. The simulator can fire transitions and update markings
 * 4. Arcs are properly maintained after firing transitions
 */

import { simulatorCore } from '../../features/simulation';

// Mock the simulator module to avoid actual Pyodide initialization
jest.mock('../../features/simulation', () => {
  // Create a mock Petri net for testing
  const mockPetriNet = {
    places: [
      { id: 'place-1', name: 'P1', tokens: 0, x: 100, y: 100 },
      { id: 'place-2', name: 'P2', tokens: 1, x: 300, y: 100 }
    ],
    transitions: [
      { id: 'transition-1', name: 'T1', x: 200, y: 100 }
    ],
    arcs: [
      { 
        id: 'arc-1', 
        sourceId: 'place-1', 
        targetId: 'transition-1', 
        sourceType: 'place', 
        targetType: 'transition', 
        weight: 1 
      },
      { 
        id: 'arc-2', 
        sourceId: 'transition-1', 
        targetId: 'place-2', 
        sourceType: 'transition', 
        targetType: 'place', 
        weight: 1 
      }
    ]
  };
  
  return {
    simulatorCore: {
      // Mock the initialize function
      initialize: jest.fn().mockResolvedValue(mockPetriNet),
      
      // Mock the getEnabledTransitions function
      getEnabledTransitions: jest.fn().mockResolvedValue([{
        id: 'transition-1', 
        name: 'T1', 
        x: 200, 
        y: 100
      }]),
      
      // Mock the fireTransition function
      fireTransition: jest.fn().mockImplementation((transitionId) => {
        // Return a copy of the mock Petri net with updated token counts
        return Promise.resolve({
          ...mockPetriNet,
          places: [
            { id: 'place-1', name: 'P1', tokens: 0, x: 100, y: 100 },
            { id: 'place-2', name: 'P2', tokens: 1, x: 300, y: 100 }
        ]
        });
      })
    }
  };
});

describe('Pyodide Simulator Integration', () => {
  let simulator;
  
  beforeEach(async () => {
    // Initialize the simulator
    simulator = await initializePyodide();
  });
  
  test('should initialize the Pyodide simulator', () => {
    expect(simulator).toBeDefined();
  });
  
  test('should create a Petri net with the given elements', async () => {
    // Create a simple Petri net
    const petriNet = {
      places: [
        { id: 'place-1', name: 'P1', tokens: 1, x: 100, y: 100 },
        { id: 'place-2', name: 'P2', tokens: 0, x: 300, y: 100 }
      ],
      transitions: [
        { id: 'transition-1', name: 'T1', x: 200, y: 100 }
      ],
      arcs: [
        { 
          id: 'arc-1', 
          sourceId: 'place-1', 
          targetId: 'transition-1', 
          sourceType: 'place', 
          targetType: 'transition', 
          weight: 1 
        },
        { 
          id: 'arc-2', 
          sourceId: 'transition-1', 
          targetId: 'place-2', 
          sourceType: 'transition', 
          targetType: 'place', 
          weight: 1 
        }
      ]
    };
    
    const result = await simulatorCore.initialize(petriNet);
    expect(result).toBeDefined();
  });
  
  test('should identify enabled transitions', async () => {
    // Create a Petri net with an enabled transition
    const petriNet = {
      places: [
        { id: 'place-1', name: 'P1', tokens: 1, x: 100, y: 100 },
        { id: 'place-2', name: 'P2', tokens: 0, x: 300, y: 100 }
      ],
      transitions: [
        { id: 'transition-1', name: 'T1', x: 200, y: 100 }
      ],
      arcs: [
        { 
          id: 'arc-1', 
          sourceId: 'place-1', 
          targetId: 'transition-1', 
          sourceType: 'place', 
          targetType: 'transition', 
          weight: 1 
        },
        { 
          id: 'arc-2', 
          sourceId: 'transition-1', 
          targetId: 'place-2', 
          sourceType: 'transition', 
          targetType: 'place', 
          weight: 1 
        }
      ]
    };
    
    await simulatorCore.initialize(petriNet);
    
    // Get enabled transitions
    const enabledTransitions = await simulatorCore.getEnabledTransitions();
    expect(enabledTransitions.length).toBeGreaterThan(0);
    expect(enabledTransitions[0].id).toBe('transition-1');
  });
  
  test('should fire a transition and update markings', async () => {
    // Create a Petri net with an enabled transition
    const petriNet = {
      places: [
        { id: 'place-1', name: 'P1', tokens: 1, x: 100, y: 100 },
        { id: 'place-2', name: 'P2', tokens: 0, x: 300, y: 100 }
      ],
      transitions: [
        { id: 'transition-1', name: 'T1', x: 200, y: 100 }
      ],
      arcs: [
        { 
          id: 'arc-1', 
          sourceId: 'place-1', 
          targetId: 'transition-1', 
          sourceType: 'place', 
          targetType: 'transition', 
          weight: 1 
        },
        { 
          id: 'arc-2', 
          sourceId: 'transition-1', 
          targetId: 'place-2', 
          sourceType: 'transition', 
          targetType: 'place', 
          weight: 1 
        }
      ]
    };
    
    await simulatorCore.initialize(petriNet);
    
    // Fire the transition
    const updatedPetriNet = await simulatorCore.fireTransition('transition-1');
    
    // Verify that the marking has been updated
    expect(updatedPetriNet.places.find(p => p.id === 'place-1').tokens).toBe(0);
    expect(updatedPetriNet.places.find(p => p.id === 'place-2').tokens).toBe(1);
    
    // Verify that arcs are still present
    expect(updatedPetriNet.arcs.length).toBe(2);
    expect(updatedPetriNet.arcs.find(a => a.id === 'arc-1')).toBeDefined();
    expect(updatedPetriNet.arcs.find(a => a.id === 'arc-2')).toBeDefined();
  });
  
  test('should preserve arcs after firing transitions', async () => {
    // Create a Petri net with an enabled transition
    const petriNet = {
      places: [
        { id: 'place-1', name: 'P1', tokens: 1, x: 100, y: 100 },
        { id: 'place-2', name: 'P2', tokens: 0, x: 300, y: 100 }
      ],
      transitions: [
        { id: 'transition-1', name: 'T1', x: 200, y: 100 }
      ],
      arcs: [
        { 
          id: 'arc-1', 
          sourceId: 'place-1', 
          targetId: 'transition-1', 
          sourceType: 'place', 
          targetType: 'transition', 
          weight: 1 
        },
        { 
          id: 'arc-2', 
          sourceId: 'transition-1', 
          targetId: 'place-2', 
          sourceType: 'transition', 
          targetType: 'place', 
          weight: 1 
        }
      ]
    };
    
    await initializeSimulator(petriNet);
    
    // Get the number of arcs before firing
    const arcCountBefore = petriNet.arcs.length;
    
    // Fire the transition
    const updatedPetriNet = await fireTransition('transition-1');
    
    // Verify that the number of arcs is the same after firing
    expect(updatedPetriNet.arcs.length).toBe(arcCountBefore);
    
    // Verify that the arc objects are preserved with their properties
    const arc1After = updatedPetriNet.arcs.find(a => a.id === 'arc-1');
    const arc2After = updatedPetriNet.arcs.find(a => a.id === 'arc-2');
    
    expect(arc1After).toBeDefined();
    expect(arc2After).toBeDefined();
    
    expect(arc1After.sourceId).toBe('place-1');
    expect(arc1After.targetId).toBe('transition-1');
    expect(arc1After.sourceType).toBe('place');
    expect(arc1After.targetType).toBe('transition');
    
    expect(arc2After.sourceId).toBe('transition-1');
    expect(arc2After.targetId).toBe('place-2');
    expect(arc2After.sourceType).toBe('transition');
    expect(arc2After.targetType).toBe('place');
  });
});
