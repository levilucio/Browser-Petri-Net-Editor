import { inferTokenType, inferVariableTypes, autoAnnotateTypes, parsePattern } from '../../utils/arith-parser';

describe('Type Inference', () => {
  describe('inferTokenType', () => {
    it('should infer Int for numbers', () => {
      expect(inferTokenType(42)).toBe('Int');
      expect(inferTokenType(-5)).toBe('Int');
      expect(inferTokenType(0)).toBe('Int');
    });

    it('should infer Bool for booleans', () => {
      expect(inferTokenType(true)).toBe('Bool');
      expect(inferTokenType(false)).toBe('Bool');
    });

    it('should infer Pair for pair objects', () => {
      const pair = { __pair__: true, fst: 1, snd: 2 };
      expect(inferTokenType(pair)).toBe('Pair');
    });

    it('should default to Int for unknown types', () => {
      expect(inferTokenType('string')).toBe('Int');
      expect(inferTokenType(null)).toBe('Int');
      expect(inferTokenType(undefined)).toBe('Int');
    });
  });

  describe('inferVariableTypes', () => {
    const elements = {
      places: [
        { id: 'place-1', valueTokens: [42] },
        { id: 'place-2', valueTokens: [true] },
        { id: 'place-3', valueTokens: [{ __pair__: true, fst: 1, snd: 2 }] }
      ],
      arcs: [
        { id: 'arc-1', source: 'place-1', target: 'transition-1', bindings: ['x'] },
        { id: 'arc-2', source: 'place-2', target: 'transition-1', bindings: ['y'] },
        { id: 'arc-3', source: 'place-3', target: 'transition-1', bindings: ['(F, z)'] }
      ],
      transitions: [
        { id: 'transition-1' }
      ]
    };

    it('should infer types for arc variables from source place tokens', () => {
      const arc = elements.arcs[0]; // x from place with Int tokens
      const typeMap = inferVariableTypes('arc', arc, elements);
      
      expect(typeMap.get('x')).toBe('Int');
    });

    it('should infer types for transition variables from input arcs', () => {
      const transition = elements.transitions[0];
      const typeMap = inferVariableTypes('transition', transition, elements);
      
      expect(typeMap.get('x')).toBe('Int');
      expect(typeMap.get('y')).toBe('Bool');
      expect(typeMap.get('z')).toBe('Pair');
    });

    it('should handle pattern bindings', () => {
      const arc = { 
        id: 'arc-test', 
        source: 'place-3', 
        bindings: ['(F, variable)'] 
      };
      const typeMap = inferVariableTypes('arc', arc, elements);
      
      expect(typeMap.get('variable')).toBe('Pair');
    });

    it('should return empty map for invalid inputs', () => {
      expect(inferVariableTypes('arc', null, elements).size).toBe(0);
      expect(inferVariableTypes('arc', {}, null).size).toBe(0);
    });
  });

  describe('autoAnnotateTypes', () => {
    it('should annotate variables with inferred types', () => {
      const typeMap = new Map([
        ['x', 'Int'],
        ['y', 'Bool'],
        ['myVar', 'Pair']
      ]);

      expect(autoAnnotateTypes('x', typeMap)).toBe('x:Int');
      expect(autoAnnotateTypes('y + 5', typeMap)).toBe('y:Bool + 5');
      expect(autoAnnotateTypes('myVar', typeMap)).toBe('myVar:Pair');
      expect(autoAnnotateTypes('x + myVar', typeMap)).toBe('x:Int + myVar:Pair');
    });

    it('should not annotate variables that already have types', () => {
      const typeMap = new Map([['x', 'Int']]);
      
      expect(autoAnnotateTypes('x:Bool', typeMap)).toBe('x:Bool'); // Keep existing type
      expect(autoAnnotateTypes('x:Int', typeMap)).toBe('x:Int'); // Keep existing type
    });

    it('should handle empty or invalid inputs', () => {
      const typeMap = new Map([['x', 'Int']]);
      
      expect(autoAnnotateTypes('', typeMap)).toBe('');
      expect(autoAnnotateTypes('x', new Map())).toBe('x');
      expect(autoAnnotateTypes('x', null)).toBe('x');
    });

    it('should handle complex expressions', () => {
      const typeMap = new Map([
        ['count', 'Int'],
        ['flag', 'Bool']
      ]);

      expect(autoAnnotateTypes('(count + 1) and flag', typeMap))
        .toBe('(count:Int + 1) and flag:Bool');
    });
  });

});
