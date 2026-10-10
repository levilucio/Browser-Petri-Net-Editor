/**
 * Tests for SATEL Oracle Generator
 */

import { generateOracle, validateOracle, generateHMLFormula } from '../../satel/core/OracleGenerator';

describe('OracleGenerator', () => {
  describe('generateOracle', () => {
    it('should generate positive oracle', () => {
      const intention = {
        id: 'test1',
        oracleType: 'positive',
        outputExpectations: [
          { place: 'output1', pattern: '"success"' }
        ],
        pathPattern: {
          events: [
            { transition: 't1' },
            { transition: 't2' }
          ]
        }
      };
      
      const trace = [
        { transition: 't1', binding: {}, timestamp: 0 },
        { transition: 't2', binding: {}, timestamp: 1 }
      ];
      
      const finalMarking = {
        output1: [{ value: 'success' }]
      };
      
      const petriNet = { places: [], transitions: [] };
      
      const oracle = generateOracle(intention, trace, finalMarking, petriNet);
      
      expect(oracle.type).toBe('positive');
      // Pattern parser preserves quotes from pattern string
      expect(oracle.expectedOutputs.output1).toEqual([{ value: '"success"' }]);
      expect(oracle.invariants.length).toBeGreaterThan(0);
    });
    
    it('should generate negative oracle', () => {
      const intention = {
        id: 'test2',
        oracleType: 'negative',
        outputExpectations: [],
        pathPattern: {
          events: [
            { transition: 't1' }
          ]
        }
      };
      
      const trace = [];
      const finalMarking = {};
      const petriNet = { places: [], transitions: [] };
      
      const oracle = generateOracle(intention, trace, finalMarking, petriNet);
      
      expect(oracle.type).toBe('negative');
      expect(oracle.forbiddenEvents).toContain('t1');
    });
  });
  
  describe('validateOracle', () => {
    const petriNet = { places: [], transitions: [] };
    
    it('should pass when expected outputs match', () => {
      const marking = {
        output1: [{ value: 'success' }]
      };
      
      const oracle = {
        type: 'positive',
        expectedOutputs: {
          output1: [{ value: 'success' }]
        },
        invariants: []
      };
      
      const result = validateOracle(marking, oracle, petriNet);
      
      expect(result.passed).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should fail when expected outputs do not match', () => {
      const marking = {
        output1: [{ value: 'failure' }]
      };
      
      const oracle = {
        type: 'positive',
        expectedOutputs: {
          output1: [{ value: 'success' }]
        },
        invariants: []
      };
      
      const result = validateOracle(marking, oracle, petriNet);
      
      expect(result.passed).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
    
    it('should evaluate invariants', () => {
      const marking = {
        output1: [{ value: 'success' }]
      };
      
      const oracle = {
        type: 'positive',
        expectedOutputs: {},
        invariants: [
          "place('output1').length == 1",
          "place('output1').contains(success)"
        ]
      };
      
      const result = validateOracle(marking, oracle, petriNet);
      
      expect(result.passed).toBe(true);
    });
  });
  
  describe('generateHMLFormula', () => {
    it('should generate formula for sequence pattern', () => {
      const pathPattern = {
        type: 'sequence',
        events: [
          { transition: 'login', binding: { user: 'alice' } },
          { transition: 'deposit', binding: { amount: 100 } },
          { transition: 'logout' }
        ]
      };
      
      const formula = generateHMLFormula(pathPattern, true);
      
      expect(formula).toContain('<login');
      expect(formula).toContain('<deposit');
      expect(formula).toContain('<logout');
      expect(formula).toContain('=> true');
    });
    
    it('should generate formula for choice pattern', () => {
      const pathPattern = {
        type: 'choice',
        events: [
          { transition: 'option1' },
          { transition: 'option2' }
        ]
      };
      
      const formula = generateHMLFormula(pathPattern, false);
      
      expect(formula).toContain('option1');
      expect(formula).toContain('option2');
      expect(formula).toContain('OR');
    });
    
    it('should generate formula for parallel pattern', () => {
      const pathPattern = {
        type: 'parallel',
        events: [
          { transition: 't1' },
          { transition: 't2' }
        ]
      };
      
      const formula = generateHMLFormula(pathPattern, false);
      
      expect(formula).toContain('t1');
      expect(formula).toContain('t2');
      expect(formula).toContain('AND');
    });
    
    it('should generate formula for loop pattern', () => {
      const pathPattern = {
        type: 'loop',
        events: [
          { transition: 'repeat' }
        ]
      };
      
      const formula = generateHMLFormula(pathPattern, false);
      
      expect(formula).toContain('repeat');
      expect(formula).toContain('*');
    });
  });
});
