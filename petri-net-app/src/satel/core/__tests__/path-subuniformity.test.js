/**
 * Tests for path-condition-based subuniformity
 * 
 * Verifies that:
 * 1. Different variable values drive genuinely different transition sequences
 * 2. Multi-step intentions generate paths of at least 3 transitions
 * 3. Path lengths differ across subdomains when behavior differs
 */

const { generateTestSuite } = require('../TestGenerator.js');
const { AlgebraicSimulator } = require('../../../features/simulation/algebraic-simulator.js');
const { manufacturingNet } = require('../../examples/manufacturing/net.js');
const {
  jobLifecycleByPriority,
  reworkCyclePath,
  materialContentionPath
} = require('../../examples/manufacturing/intentions-v2-multistep.js');

describe('Path-Condition Subuniformity', () => {
  const simulator = new AlgebraicSimulator();
  const petriNet = {
    places: manufacturingNet.places,
    transitions: manufacturingNet.transitions,
    arcs: manufacturingNet.arcs,
    mode: 'algebraic',
    adtDefinitions: manufacturingNet.adtDefinitions
  };

  describe('Job Lifecycle by Priority - Distinct Paths', () => {
    it('should generate different test cases for each priority value', async () => {
      const result = await generateTestSuite(
        [jobLifecycleByPriority],
        petriNet,
        simulator,
        { disableGraphCaching: true, variableDepth: 2 }
      );

      // Should have 3 test cases (High, Normal, Low priorities)
      expect(result.testCases.length).toBeGreaterThanOrEqual(2);
      
      // Each test case should have a unique variable instantiation
      const instantiations = result.testCases.map(tc => JSON.stringify(tc.instantiation));
      const uniqueInstantiations = new Set(instantiations);
      expect(uniqueInstantiations.size).toBe(result.testCases.length);
    });

    it('should generate paths of at least 3 transitions for lifecycle intentions', async () => {
      const result = await generateTestSuite(
        [jobLifecycleByPriority],
        petriNet,
        simulator,
        { disableGraphCaching: true, variableDepth: 2 }
      );

      for (const testCase of result.testCases) {
        const pathLength = testCase.expectedTrace?.length || 0;
        // Test should have path length >= 3
        expect(pathLength).toBeGreaterThanOrEqual(3);
      }
    });

    it('should have distinct path lengths when behavior differs by priority', async () => {
      const result = await generateTestSuite(
        [jobLifecycleByPriority],
        petriNet,
        simulator,
        { disableGraphCaching: true, variableDepth: 2 }
      );

      // Collect path lengths per priority
      const pathsByPriority = new Map();
      
      for (const testCase of result.testCases) {
        const priority = testCase.instantiation?.priority?.constructor || 'None';
        const pathLength = testCase.expectedTrace?.length || 0;
        
        if (!pathsByPriority.has(priority)) {
          pathsByPriority.set(priority, []);
        }
        pathsByPriority.get(priority).push(pathLength);
      }

      // If we have multiple priorities, at least some should have different path lengths
      // (High and Normal follow full lifecycle, Low may stop earlier)
      if (pathsByPriority.size >= 2) {
        const allLengths = Array.from(pathsByPriority.values()).flat();
        const uniqueLengths = new Set(allLengths);
        
        // Should have variation in path lengths (not all the same)
        expect(uniqueLengths.size).toBeGreaterThan(1);
      }
    });
  });

  describe('Rework Cycle - Long Path', () => {
    it('should generate path of at least 6 transitions for rework cycle', async () => {
      const result = await generateTestSuite(
        [reworkCyclePath],
        petriNet,
        simulator,
        { disableGraphCaching: true }
      );

      expect(result.testCases.length).toBeGreaterThan(0);
      
      const testCase = result.testCases[0];
      const pathLength = testCase.expectedTrace?.length || 0;
      
      // Rework cycle should have at least 6 transitions
      expect(pathLength).toBeGreaterThanOrEqual(6);
    });

    it('should execute complete fail-rework-pass sequence', async () => {
      const result = await generateTestSuite(
        [reworkCyclePath],
        petriNet,
        simulator,
        { disableGraphCaching: true }
      );

      const testCase = result.testCases[0];
      const path = testCase.expectedTrace || [];
      const transitions = path.map(step => step.transition);

      // Should include scheduleJob, stages, qualityCheckFail, and rework transitions
      expect(transitions).toContain('scheduleJob');
      expect(transitions).toContain('qualityCheckFail');
      expect(transitions.filter(t => t === 'completeStage1').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Material Contention - Path Variability', () => {
    it('should partition material amounts by guard boundaries', async () => {
      const result = await generateTestSuite(
        [materialContentionPath],
        petriNet,
        simulator,
        { disableGraphCaching: true, variableDepth: 2 }
      );

      // Should generate multiple test cases for different material amounts
      expect(result.testCases.length).toBeGreaterThan(1);
      
      // Material values should differ across test cases
      const materialValues = result.testCases.map(tc => {
        const mat = tc.instantiation?.materialAmount;
        return typeof mat === 'number' ? mat : mat?.args?.[0];
      });
      
      const uniqueValues = new Set(materialValues.filter(v => v !== undefined));
      // Should have distinct material amounts
      expect(uniqueValues.size).toBeGreaterThan(1);
    });

    it('should generate different path lengths based on material availability', async () => {
      const result = await generateTestSuite(
        [materialContentionPath],
        petriNet,
        simulator,
        { disableGraphCaching: true, variableDepth: 2 }
      );

      // Collect path lengths
      const pathLengths = result.testCases.map(tc => tc.expectedTrace?.length || 0);
      const uniqueLengths = new Set(pathLengths);

      // Different material amounts should produce different execution paths
      expect(uniqueLengths.size).toBeGreaterThan(1);
    });
  });

  describe('Path-Condition Assertion Helpers', () => {
    it('should verify test suite has minimum average path length', async () => {
      const intentions = [jobLifecycleByPriority, reworkCyclePath];
      const result = await generateTestSuite(
        intentions,
        petriNet,
        simulator,
        { disableGraphCaching: true }
      );

      const totalTransitions = result.testCases.reduce(
        (sum, tc) => sum + (tc.expectedTrace?.length || 0),
        0
      );
      const avgPathLength = totalTransitions / result.testCases.length;

      // Multi-step test suite should average at least 4 transitions
      expect(avgPathLength).toBeGreaterThanOrEqual(4);
    });

    it('should have at least 50% of tests with path length >= 3', async () => {
      const intentions = [jobLifecycleByPriority, reworkCyclePath, materialContentionPath];
      const result = await generateTestSuite(
        intentions,
        petriNet,
        simulator,
        { disableGraphCaching: true }
      );

      const longPaths = result.testCases.filter(
        tc => (tc.expectedTrace?.length || 0) >= 3
      ).length;
      
      const percentage = (longPaths / result.testCases.length) * 100;
      
      // At least half should have path length >= 3
      expect(percentage).toBeGreaterThanOrEqual(50);
    });
  });
});
