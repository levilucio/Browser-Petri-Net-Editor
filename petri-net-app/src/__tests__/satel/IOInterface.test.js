/**
 * Tests for SATEL I/O Interface
 */

import {
  markIOType,
  getIOType,
  isInput,
  isOutput,
  getInputPlaces,
  getOutputPlaces,
  extractInterface,
  validateInterface
} from '../../satel/io/IOInterface';

describe('IOInterface', () => {
  describe('markIOType', () => {
    it('should mark element as input', () => {
      const place = { id: 'p1', label: 'Input Place' };
      const marked = markIOType(place, 'input', 'User input');
      
      expect(marked.io_type).toBe('input');
      expect(marked.io_description).toBe('User input');
      expect(marked.id).toBe('p1');
    });
    
    it('should mark element as output', () => {
      const transition = { id: 't1', label: 'Output Transition' };
      const marked = markIOType(transition, 'output', 'System output');
      
      expect(marked.io_type).toBe('output');
      expect(marked.io_description).toBe('System output');
    });
    
    it('should mark element as internal', () => {
      const place = { id: 'p2', label: 'Internal Place' };
      const marked = markIOType(place, 'internal');
      
      expect(marked.io_type).toBe('internal');
      expect(marked.io_description).toBe('');
    });
  });
  
  describe('getIOType', () => {
    it('should return io_type if set', () => {
      const place = { id: 'p1', io_type: 'input' };
      expect(getIOType(place)).toBe('input');
    });
    
    it('should return internal if io_type not set', () => {
      const place = { id: 'p1' };
      expect(getIOType(place)).toBe('internal');
    });
  });
  
  describe('isInput and isOutput', () => {
    it('should identify input elements', () => {
      const input = { id: 'p1', io_type: 'input' };
      const output = { id: 'p2', io_type: 'output' };
      const internal = { id: 'p3', io_type: 'internal' };
      
      expect(isInput(input)).toBe(true);
      expect(isInput(output)).toBe(false);
      expect(isInput(internal)).toBe(false);
    });
    
    it('should identify output elements', () => {
      const input = { id: 'p1', io_type: 'input' };
      const output = { id: 'p2', io_type: 'output' };
      const internal = { id: 'p3', io_type: 'internal' };
      
      expect(isOutput(output)).toBe(true);
      expect(isOutput(input)).toBe(false);
      expect(isOutput(internal)).toBe(false);
    });
  });
  
  describe('getInputPlaces and getOutputPlaces', () => {
    const petriNet = {
      places: [
        { id: 'p1', io_type: 'input' },
        { id: 'p2', io_type: 'output' },
        { id: 'p3', io_type: 'internal' },
        { id: 'p4', io_type: 'input' }
      ],
      transitions: []
    };
    
    it('should get all input places', () => {
      const inputs = getInputPlaces(petriNet);
      expect(inputs).toHaveLength(2);
      expect(inputs.map(p => p.id)).toEqual(['p1', 'p4']);
    });
    
    it('should get all output places', () => {
      const outputs = getOutputPlaces(petriNet);
      expect(outputs).toHaveLength(1);
      expect(outputs.map(p => p.id)).toEqual(['p2']);
    });
  });
  
  describe('extractInterface', () => {
    it('should extract complete I/O interface', () => {
      const petriNet = {
        places: [
          { id: 'p1', io_type: 'input' },
          { id: 'p2', io_type: 'output' }
        ],
        transitions: [
          { id: 't1', io_type: 'input' },
          { id: 't2', io_type: 'output' }
        ]
      };
      
      const iface = extractInterface(petriNet);
      
      expect(iface.inputPlaces).toHaveLength(1);
      expect(iface.outputPlaces).toHaveLength(1);
      expect(iface.inputTransitions).toHaveLength(1);
      expect(iface.outputTransitions).toHaveLength(1);
    });
  });
  
  describe('validateInterface', () => {
    it('should validate correct interface', () => {
      const petriNet = {
        places: [
          { id: 'p1', io_type: 'input', label: 'Input' },
          { id: 'p2', io_type: 'output', label: 'Output' }
        ],
        transitions: []
      };
      
      const validation = validateInterface(petriNet);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
    
    it('should warn if no inputs', () => {
      const petriNet = {
        places: [
          { id: 'p1', io_type: 'output' }
        ],
        transitions: []
      };
      
      const validation = validateInterface(petriNet);
      
      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('No input');
    });
    
    it('should warn if no outputs', () => {
      const petriNet = {
        places: [
          { id: 'p1', io_type: 'input' }
        ],
        transitions: []
      };
      
      const validation = validateInterface(petriNet);
      
      expect(validation.valid).toBe(true);
      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('No output');
    });
  });
});
