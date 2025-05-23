/**
 * Unit tests for the Petri net simulator
 * Tests the simulator logic and performance
 */
import { JsPetriNetSimulator } from '../../utils/simulator';

// Direct tests of the JsPetriNetSimulator class
describe('JsPetriNetSimulator', () => {
  // Test data: Simple Petri net with one place, one transition, and one arc
  const simplePetriNet = {
    places: [
      { id: 'place-1', name: 'P1', tokens: 1, x: 100, y: 100 }
    ],
    transitions: [
      { id: 'transition-1', name: 'T1', x: 200, y: 100 }
    ],
    arcs: [
      { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', sourceType: 'place', targetType: 'transition', weight: 1 }
    ]
  };

  // More complex Petri net with multiple places and transitions
  const complexPetriNet = {
    places: [
      { id: 'place-1', name: 'P1', tokens: 1, x: 100, y: 100 },
      { id: 'place-2', name: 'P2', tokens: 0, x: 300, y: 100 },
      { id: 'place-3', name: 'P3', tokens: 2, x: 100, y: 200 }
    ],
    transitions: [
      { id: 'transition-1', name: 'T1', x: 200, y: 100 },
      { id: 'transition-2', name: 'T2', x: 200, y: 200 }
    ],
    arcs: [
      { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', sourceType: 'place', targetType: 'transition', weight: 1 },
      { id: 'arc-2', sourceId: 'transition-1', targetId: 'place-2', sourceType: 'transition', targetType: 'place', weight: 1 },
      { id: 'arc-3', sourceId: 'place-3', targetId: 'transition-2', sourceType: 'place', targetType: 'transition', weight: 2 },
      { id: 'arc-4', sourceId: 'transition-2', targetId: 'place-1', sourceType: 'transition', targetType: 'place', weight: 1 }
    ]
  };

  test('should identify input places for a transition', () => {
    const simulator = new JsPetriNetSimulator(complexPetriNet);
    const inputPlaces = simulator.getInputPlaces('transition-1');
    expect(inputPlaces).toHaveLength(1);
    expect(inputPlaces[0][0].id).toBe('place-1');
  });

  test('should identify output places for a transition', () => {
    const simulator = new JsPetriNetSimulator(complexPetriNet);
    const outputPlaces = simulator.getOutputPlaces('transition-1');
    expect(outputPlaces).toHaveLength(1);
    expect(outputPlaces[0][0].id).toBe('place-2');
  });

  test('should determine if a transition is enabled', () => {
    const simulator = new JsPetriNetSimulator(complexPetriNet);
    expect(simulator.isTransitionEnabled('transition-1')).toBe(true);
    expect(simulator.isTransitionEnabled('transition-2')).toBe(true);
  });

  test('should find all enabled transitions', () => {
    const simulator = new JsPetriNetSimulator(complexPetriNet);
    const enabledTransitions = simulator.getEnabledTransitions();
    expect(enabledTransitions).toHaveLength(2);
    expect(enabledTransitions.map(t => t.id)).toContain('transition-1');
    expect(enabledTransitions.map(t => t.id)).toContain('transition-2');
  });

  test('should fire a transition and update markings', () => {
    const simulator = new JsPetriNetSimulator(simplePetriNet);
    const updatedPetriNet = simulator.fireTransition('transition-1');
    
    // Check that the input place has lost tokens
    const inputPlace = updatedPetriNet.places.find(p => p.id === 'place-1');
    // After firing, the place should have 0 tokens (1 initial - 1 consumed)
    expect(inputPlace.tokens).toBe(0);
  });

  test('should respect arc weights when firing transitions', () => {
    const simulator = new JsPetriNetSimulator(complexPetriNet);
    const updatedPetriNet = simulator.fireTransition('transition-2');
    
    // Check that place-3 has lost 2 tokens (the weight of arc-3)
    const inputPlace = updatedPetriNet.places.find(p => p.id === 'place-3');
    // After firing, the place should have 0 tokens (2 initial - 2 consumed)
    expect(inputPlace.tokens).toBe(0);
    
    // Check that place-1 has gained 1 token (the weight of arc-4)
    const outputPlace = updatedPetriNet.places.find(p => p.id === 'place-1');
    // After firing, the place should have 2 tokens (1 initial + 1 produced)
    expect(outputPlace.tokens).toBe(2);
  });

  test('should not fire a disabled transition', () => {
    // Create a Petri net with a disabled transition
    const disabledPetriNet = {
      places: [
        { id: 'place-1', name: 'P1', tokens: 0, x: 100, y: 100 }
      ],
      transitions: [
        { id: 'transition-1', name: 'T1', x: 200, y: 100 }
      ],
      arcs: [
        { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', sourceType: 'place', targetType: 'transition', weight: 1 }
      ]
    };
    
    const simulator = new JsPetriNetSimulator(disabledPetriNet);
    
    // Verify the transition is disabled
    expect(simulator.isTransitionEnabled('transition-1')).toBe(false);
    
    // Try to fire the disabled transition
    expect(() => {
      simulator.fireTransition('transition-1');
    }).toThrow('Transition transition-1 is not enabled');
  });

  test('should enforce token limit (20 per place)', () => {
    // Create a Petri net with a place that has 19 tokens and a transition that adds 2 tokens
    const tokenLimitPetriNet = {
      places: [
        { id: 'place-1', name: 'P1', tokens: 19, x: 100, y: 100 },
        { id: 'place-2', name: 'P2', tokens: 1, x: 300, y: 100 }
      ],
      transitions: [
        { id: 'transition-1', name: 'T1', x: 200, y: 100 }
      ],
      arcs: [
        { id: 'arc-1', sourceId: 'place-2', targetId: 'transition-1', sourceType: 'place', targetType: 'transition', weight: 1 },
        { id: 'arc-2', sourceId: 'transition-1', targetId: 'place-1', sourceType: 'transition', targetType: 'place', weight: 2 }
      ]
    };
    
    const simulator = new JsPetriNetSimulator(tokenLimitPetriNet);
    
    // Verify the transition is enabled
    expect(simulator.isTransitionEnabled('transition-1')).toBe(true);
    
    // The simulator enforces a token limit of 20 per place
    // When firing the transition, place-1 would have 21 tokens (19 + 2)
    // But the simulator caps it at 20, so no error is thrown
    const updatedPetriNet = simulator.fireTransition('transition-1');
    const place1 = updatedPetriNet.places.find(p => p.id === 'place-1');
    expect(place1.tokens).toBe(20); // Capped at 20 instead of 21
  });

  // Performance test
  test('should fire transitions quickly (under 100ms)', () => {
    // Create a larger Petri net for performance testing
    const largePetriNet = {
      places: Array.from({ length: 20 }, (_, i) => ({
        id: `place-${i+1}`,
        name: `P${i+1}`,
        tokens: i % 2 === 0 ? 1 : 0,
        x: 100 + (i % 5) * 100,
        y: 100 + Math.floor(i / 5) * 100
      })),
      transitions: Array.from({ length: 10 }, (_, i) => ({
        id: `transition-${i+1}`,
        name: `T${i+1}`,
        x: 150 + (i % 5) * 100,
        y: 150 + Math.floor(i / 5) * 100
      })),
      arcs: []
    };
    
    // Add arcs to connect places and transitions
    for (let i = 0; i < 10; i++) {
      largePetriNet.arcs.push({
        id: `arc-in-${i+1}`,
        sourceId: `place-${i*2+1}`,
        targetId: `transition-${i+1}`,
        sourceType: 'place',
        targetType: 'transition',
        weight: 1
      });
      largePetriNet.arcs.push({
        id: `arc-out-${i+1}`,
        sourceId: `transition-${i+1}`,
        targetId: `place-${(i*2+2) % 20 || 20}`,
        sourceType: 'transition',
        targetType: 'place',
        weight: 1
      });
    }
    
    const simulator = new JsPetriNetSimulator(largePetriNet);
    
    // Measure the time it takes to find enabled transitions
    const startGetEnabled = performance.now();
    const enabledTransitions = simulator.getEnabledTransitions();
    const endGetEnabled = performance.now();
    
    // Measure the time it takes to fire a transition
    if (enabledTransitions.length > 0) {
      const startFire = performance.now();
      simulator.fireTransition(enabledTransitions[0].id);
      const endFire = performance.now();
      
      // Both operations should be fast
      expect(endGetEnabled - startGetEnabled).toBeLessThan(100);
      expect(endFire - startFire).toBeLessThan(100);
    }
  });
});
