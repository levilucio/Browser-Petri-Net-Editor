/**
 * Unit tests for the dynamic max tokens feature in the simulator
 */
import { JsPetriNetSimulator } from '../../features/simulation';

describe('Max Tokens Tests', () => {
  // Test that the simulator respects the maxTokens setting
  test('should respect maxTokens setting when firing transitions', () => {
    // Create a simple Petri net with one place and one transition
    const petriNet = {
      places: [
        { id: 'p1', tokens: 0 }
      ],
      transitions: [
        { id: 't1' }
      ],
      arcs: [
        { 
          id: 'a1', 
          sourceId: 't1', 
          targetId: 'p1', 
          sourceType: 'transition', 
          targetType: 'place',
          weight: 10
        }
      ]
    };

    // Create a simulator with maxTokens = 5
    const simulator = new JsPetriNetSimulator(petriNet, { maxTokens: 5 });
    
    // Fire the transition (should add 10 tokens to p1, but capped at 5)
    const updatedPetriNet = simulator.fireTransition('t1');
    
    // Check that the tokens in p1 are capped at 5
    expect(updatedPetriNet.places[0].tokens).toBe(5);
  });

  // Test with different maxTokens values
  test('should respect different maxTokens values', () => {
    // Create a simple Petri net with one place and one transition
    const petriNet = {
      places: [
        { id: 'p1', tokens: 0 }
      ],
      transitions: [
        { id: 't1' }
      ],
      arcs: [
        { 
          id: 'a1', 
          sourceId: 't1', 
          targetId: 'p1', 
          sourceType: 'transition', 
          targetType: 'place',
          weight: 100
        }
      ]
    };

    // Test with maxTokens = 10
    const simulator1 = new JsPetriNetSimulator(petriNet, { maxTokens: 10 });
    const result1 = simulator1.fireTransition('t1');
    expect(result1.places[0].tokens).toBe(10);
    
    // Test with maxTokens = 50
    const simulator2 = new JsPetriNetSimulator(petriNet, { maxTokens: 50 });
    const result2 = simulator2.fireTransition('t1');
    expect(result2.places[0].tokens).toBe(50);
    
    // Test with default maxTokens (should be 20)
    const simulator3 = new JsPetriNetSimulator(petriNet);
    const result3 = simulator3.fireTransition('t1');
    expect(result3.places[0].tokens).toBe(20);
  });

  // Test with accumulated tokens
  test('should respect maxTokens when accumulating tokens', () => {
    // Create a Petri net with one place and one transition
    const petriNet = {
      places: [
        { id: 'p1', tokens: 3 }
      ],
      transitions: [
        { id: 't1' }
      ],
      arcs: [
        { 
          id: 'a1', 
          sourceId: 't1', 
          targetId: 'p1', 
          sourceType: 'transition', 
          targetType: 'place',
          weight: 5
        }
      ]
    };

    // Create a simulator with maxTokens = 7
    const simulator = new JsPetriNetSimulator(petriNet, { maxTokens: 7 });
    
    // Fire the transition (should add 5 tokens to the existing 3, but cap at 7)
    const updatedPetriNet = simulator.fireTransition('t1');
    
    // Check that the tokens in p1 are capped at 7 (not 8)
    expect(updatedPetriNet.places[0].tokens).toBe(7);
  });
});
