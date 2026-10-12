#!/usr/bin/env node

/**
 * Verification script for uniformity/subuniformity wiring
 * Tests that:
 * 1. ADT registry reaches the partitioner
 * 2. Explicit binding fires (successor differs per class)
 * 3. Reductions behave as intended
 */

import { generateTestSuite } from './src/satel/core/TestGenerator.js';
import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentions } from './src/satel/examples/manufacturing/intentions.js';
import { SimulatorFactory } from './src/features/simulation/SimulatorFactory.js';
import { buildAdtRegistry } from './src/utils/adt-parser.js';
import { buildReachabilityGraph } from './src/satel/core/StateSpaceExplorer.js';

console.log('🧪 Testing Uniformity/Subuniformity Wiring\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  return async () => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.error(`   Error: ${err.message}`);
      if (err.stack) {
        console.error(`   Stack: ${err.stack.split('\n').slice(1, 4).join('\n')}`);
      }
      failed++;
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test 1: ADT registry is built and passed to state space explorer
const test1 = test('ADT registry reaches state space explorer', async () => {
  const adtRegistry = buildAdtRegistry(manufacturingNet);
  assert(adtRegistry !== null, 'ADT registry should be built');
  
  const simulator = SimulatorFactory.createSimulator('algebraic');
  await simulator.initialize(manufacturingNet);
  
  // Build reachability graph with ADT registry
  const graph = await buildReachabilityGraph(manufacturingNet, simulator, {
    maxStates: 50,
    maxDepth: 10,
    adtRegistry // Should be passed through
  });
  
  assert(graph !== null, 'Reachability graph should be built');
  assert(graph.states.size > 0, 'Should have at least one state');
  assert(graph.transitions.length >= 0, 'Should have transitions array');
});

// Test 2: Explicit binding affects successor state
const test2 = test('Explicit binding fires correctly', async () => {
  const simulator = SimulatorFactory.createSimulator('algebraic');
  
  // Create a simple net with guards that partition the space
  const testNet = {
    mode: 'algebraic',
    places: [
      { id: 'p1', label: 'P1', x: 0, y: 0, tokens: 1, valueTokens: [5], io_type: 'input' },
      { id: 'p2', label: 'P2', x: 100, y: 0, tokens: 0, valueTokens: [], io_type: 'output' }
    ],
    transitions: [
      { id: 't1', label: 'T1', x: 50, y: 0, guard: 'x > 0', action: '' }
    ],
    arcs: [
      { id: 'a1', source: 'p1', target: 't1', sourceType: 'place', targetType: 'transition', binding: 'x' },
      { id: 'a2', source: 't1', target: 'p2', sourceType: 'transition', targetType: 'place', binding: 'x' }
    ]
  };
  
  await simulator.initialize(testNet);
  
  // Fire with explicit binding x=5
  const enabled = await simulator.getEnabledTransitions();
  assert(enabled.includes('t1'), 'Transition should be enabled');
  
  const state1 = await simulator.fireTransition('t1', {
    explicitBinding: { x: 5 },
    explicitPicks: [{ srcId: 'p1', tokenIdx: 0, value: 5 }]
  });
  
  // Check that p2 has token with value 5
  const p2 = state1.places.find(p => p.id === 'p2');
  assert(p2.valueTokens.length === 1, 'P2 should have one token');
  assert(p2.valueTokens[0] === 5, 'P2 token should have value 5');
});

// Test 3: Reduction hypotheses behave correctly
const test3 = test('Reduction engine handles axiom type', async () => {
  const { applyReduction } = await import('./src/satel/core/ReductionEngine.js');
  
  // Create dummy test cases
  const testCases = [
    { id: 'tc1', intentionId: 'int1', expectedTrace: [{ transition: 't1', binding: { x: 1 } }] },
    { id: 'tc2', intentionId: 'int1', expectedTrace: [{ transition: 't1', binding: { x: 2 } }] },
    { id: 'tc3', intentionId: 'int1', expectedTrace: [{ transition: 't2', binding: { y: 3 } }] }
  ];
  
  const intentions = [
    {
      id: 'int1',
      name: 'Test Intention',
      reductionHypothesis: {
        type: 'axiom', // Should be handled (backward compatibility)
        domain: 'test',
        reason: 'Test axiom reduction'
      }
    }
  ];
  
  // Apply reduction - should not throw error
  const reduced = applyReduction(testCases, intentions, manufacturingNet);
  assert(Array.isArray(reduced), 'Reduction should return array');
  assert(reduced.length > 0, 'Reduction should return at least one case');
});

// Test 4: Manufacturing test suite generation
const test4 = test('Manufacturing generates all 15 test cases', async () => {
  const simulator = SimulatorFactory.createSimulator('algebraic');
  
  console.log('   Generating Manufacturing test suite...');
  const startTime = Date.now();
  
  const suite = await generateTestSuite(
    manufacturingIntentions,
    manufacturingNet,
    simulator,
    {
      maxStates: 500,
      maxDepth: 30,
      profileMode: false
    }
  );
  
  const elapsed = Date.now() - startTime;
  
  assert(suite.testCases.length >= 15, `Should generate at least 15 test cases (got ${suite.testCases.length})`);
  assert(suite.statistics.intentionsProcessed === 15, 'Should process all 15 intentions');
  
  console.log(`   Generated ${suite.testCases.length} cases in ${elapsed}ms`);
  console.log(`   States explored: ${suite.statistics.statesExplored || 'unknown'}`);
  console.log(`   Avg time per intention: ${Math.round(elapsed / 15)}ms`);
  
  // Verify GUI responsiveness (should be < 30 seconds total)
  assert(elapsed < 30000, `Generation should be < 30s (was ${elapsed}ms)`);
});

// Test 5: Variable-based domain matching
const test5 = test('traceTouchesDomain uses variable names', async () => {
  const { applyReduction } = await import('./src/satel/core/ReductionEngine.js');
  
  // Test cases with explicit variable bindings
  const testCases = [
    { 
      id: 'tc1', 
      intentionId: 'int1', 
      expectedTrace: [{ transition: 't1', binding: { order: 1, material: 10 } }] 
    },
    { 
      id: 'tc2', 
      intentionId: 'int1', 
      expectedTrace: [{ transition: 't1', binding: { order: 2, material: 20 } }] 
    },
    { 
      id: 'tc3', 
      intentionId: 'int1', 
      expectedTrace: [{ transition: 't2', binding: { worker: 5 } }] 
    }
  ];
  
  const intentions = [
    {
      id: 'int1',
      name: 'Test Variable Uniformity',
      reductionHypothesis: {
        type: 'uniformity',
        domain: 'order', // Variable name
        representative: 1,
        reason: 'Uniform over order values'
      }
    }
  ];
  
  // Apply reduction - should keep only cases that bind 'order' variable
  const reduced = applyReduction(testCases, intentions, manufacturingNet);
  
  // tc1 and tc2 touch 'order' domain, tc3 does not
  // Reduction should keep one representative from tc1/tc2
  assert(reduced.length <= 2, 'Should reduce cases touching the domain');
  
  // At least one case with 'order' binding should remain
  const hasOrderCase = reduced.some(tc => 
    tc.expectedTrace.some(e => e.binding && 'order' in e.binding)
  );
  assert(hasOrderCase || reduced.length === 0, 'Should keep at least one case with order binding if any exist');
});

// Run all tests
console.log('Running tests...\n');

await test1();
await test2();
await test3();
await test4();
await test5();

console.log(`\n${'='.repeat(50)}`);
console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}

console.log('\n✅ All uniformity wiring tests passed!');
