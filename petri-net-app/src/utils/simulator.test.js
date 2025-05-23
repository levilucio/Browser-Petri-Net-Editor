/**
 * Test file for the simulator engine
 * This file contains tests to verify the Petri net simulator functionality
 */

import { JsPetriNetSimulator } from './simulator';

// Sample Petri net for testing
const samplePetriNet = {
  places: [
    { id: 'place-1', name: 'P1', x: 100, y: 100, tokens: 2 },
    { id: 'place-2', name: 'P2', x: 300, y: 100, tokens: 0 },
  ],
  transitions: [
    { id: 'transition-1', name: 'T1', x: 200, y: 100 },
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
    },
  ],
};

// Mock the Pyodide integration for testing
jest.mock('./simulator', () => {
  // Only mock the Pyodide-related functions
  const originalModule = jest.requireActual('./simulator');
  
  return {
    ...originalModule,
    initializePyodide: jest.fn().mockResolvedValue(null),
    initializeSimulator: jest.fn().mockResolvedValue(null),
    getEnabledTransitions: jest.fn().mockResolvedValue([{ id: 'transition-1', name: 'T1' }]),
    fireTransition: jest.fn().mockImplementation((transitionId) => {
      return Promise.resolve({
        places: [
          { id: 'place-1', name: 'P1', tokens: 1 },
          { id: 'place-2', name: 'P2', tokens: 1 },
        ],
        transitions: [{ id: 'transition-1', name: 'T1' }],
        arcs: [
          { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1' },
          { id: 'arc-2', sourceId: 'transition-1', targetId: 'place-2' },
        ]
      });
    }),
  };
});

describe('JsPetriNetSimulator', () => {
  let simulator;

  beforeEach(() => {
    simulator = new JsPetriNetSimulator(samplePetriNet);
  });

  test('should correctly identify input places for a transition', () => {
    const inputPlaces = simulator.getInputPlaces('transition-1');
    expect(inputPlaces).toHaveLength(1);
    expect(inputPlaces[0][0].id).toBe('place-1');
  });

  test('should correctly identify output places for a transition', () => {
    const outputPlaces = simulator.getOutputPlaces('transition-1');
    expect(outputPlaces).toHaveLength(1);
    expect(outputPlaces[0][0].id).toBe('place-2');
  });

  test('should correctly determine if a transition is enabled', () => {
    // Transition should be enabled because place-1 has 2 tokens and arc weight is 1
    expect(simulator.isTransitionEnabled('transition-1')).toBe(true);
    
    // Modify the tokens to make the transition disabled
    const modifiedPetriNet = {
      ...samplePetriNet,
      places: [
        { id: 'place-1', name: 'P1', x: 100, y: 100, tokens: 0 }, // Not enough tokens
        { id: 'place-2', name: 'P2', x: 300, y: 100, tokens: 0 },
      ],
    };
    
    const disabledSimulator = new JsPetriNetSimulator(modifiedPetriNet);
    expect(disabledSimulator.isTransitionEnabled('transition-1')).toBe(false);
  });

  test('should correctly get all enabled transitions', () => {
    const enabledTransitions = simulator.getEnabledTransitions();
    expect(enabledTransitions).toHaveLength(1);
    expect(enabledTransitions[0].id).toBe('transition-1');
  });

  test('should correctly fire a transition and update the marking', () => {
    const updatedPetriNet = simulator.fireTransition('transition-1');
    
    // Check that tokens were removed from input place
    const inputPlace = updatedPetriNet.places.find(p => p.id === 'place-1');
    expect(inputPlace.tokens).toBe(1); // 2 - 1 = 1
    
    // Check that tokens were added to output place
    const outputPlace = updatedPetriNet.places.find(p => p.id === 'place-2');
    expect(outputPlace.tokens).toBe(1); // 0 + 1 = 1
  });

  test('should throw an error when firing a disabled transition', () => {
    // Create a simulator with a disabled transition
    const modifiedPetriNet = {
      ...samplePetriNet,
      places: [
        { id: 'place-1', name: 'P1', x: 100, y: 100, tokens: 0 }, // Not enough tokens
        { id: 'place-2', name: 'P2', x: 300, y: 100, tokens: 0 },
      ],
    };
    
    const disabledSimulator = new JsPetriNetSimulator(modifiedPetriNet);
    
    // Firing the disabled transition should throw an error
    expect(() => {
      disabledSimulator.fireTransition('transition-1');
    }).toThrow('Transition transition-1 is not enabled');
  });
});

