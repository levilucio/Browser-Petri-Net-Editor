#!/usr/bin/env node

/**
 * Verification script for auto-layout algorithm
 * Tests the layout algorithm with simple Petri nets
 */

import { computeAutoLayout } from './src/features/layout/petri-net-layout.js';

console.log('🧪 Testing Auto-Layout Algorithm\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.error(`   Error: ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test 1: Simple linear net (place -> transition -> place)
test('Simple linear net layout', () => {
  const places = [
    { id: 'p1', label: 'P1', x: 0, y: 0, io_type: 'input' },
    { id: 'p2', label: 'P2', x: 0, y: 0, io_type: 'output' }
  ];
  const transitions = [
    { id: 't1', label: 'T1', x: 0, y: 0 }
  ];
  const arcs = [
    { id: 'a1', source: 'p1', target: 't1' },
    { id: 'a2', source: 't1', target: 'p2' }
  ];
  
  const result = computeAutoLayout(places, transitions, arcs);
  
  assert(result.places.length === 2, 'Should return 2 places');
  assert(result.transitions.length === 1, 'Should return 1 transition');
  assert(typeof result.places[0].x === 'number', 'Place should have x coordinate');
  assert(typeof result.places[0].y === 'number', 'Place should have y coordinate');
  assert(result.places[0].x < result.transitions[0].x, 'Input place should be left of transition');
  assert(result.transitions[0].x < result.places[1].x, 'Transition should be left of output place');
});

// Test 2: Branching net (one place to multiple transitions)
test('Branching net layout', () => {
  const places = [
    { id: 'p1', label: 'P1', x: 0, y: 0, io_type: 'input' },
    { id: 'p2', label: 'P2', x: 0, y: 0 },
    { id: 'p3', label: 'P3', x: 0, y: 0 }
  ];
  const transitions = [
    { id: 't1', label: 'T1', x: 0, y: 0 },
    { id: 't2', label: 'T2', x: 0, y: 0 }
  ];
  const arcs = [
    { id: 'a1', source: 'p1', target: 't1' },
    { id: 'a2', source: 'p1', target: 't2' },
    { id: 'a3', source: 't1', target: 'p2' },
    { id: 'a4', source: 't2', target: 'p3' }
  ];
  
  const result = computeAutoLayout(places, transitions, arcs);
  
  assert(result.places.length === 3, 'Should return 3 places');
  assert(result.transitions.length === 2, 'Should return 2 transitions');
  // Both transitions should be in the same layer (same x coordinate)
  assert(result.transitions[0].x === result.transitions[1].x, 'Transitions should be in same layer');
  // Output places should be in the same layer
  assert(result.places[1].x === result.places[2].x, 'Output places should be in same layer');
});

// Test 3: Empty net
test('Empty net handling', () => {
  const result = computeAutoLayout([], [], []);
  
  assert(result.places.length === 0, 'Should return empty places array');
  assert(result.transitions.length === 0, 'Should return empty transitions array');
});

// Test 4: Preserve node properties
test('Preserve node properties during layout', () => {
  const places = [
    { id: 'p1', label: 'P1', x: 0, y: 0, tokens: 5, valueTokens: [1, 2, 3], io_type: 'input' }
  ];
  const transitions = [
    { id: 't1', label: 'T1', x: 0, y: 0, guard: 'x > 0', action: 'y = x + 1' }
  ];
  const arcs = [
    { id: 'a1', source: 'p1', target: 't1' }
  ];
  
  const result = computeAutoLayout(places, transitions, arcs);
  
  assert(result.places[0].tokens === 5, 'Should preserve tokens');
  assert(result.places[0].valueTokens.length === 3, 'Should preserve valueTokens');
  assert(result.places[0].label === 'P1', 'Should preserve label');
  assert(result.transitions[0].guard === 'x > 0', 'Should preserve guard');
  assert(result.transitions[0].action === 'y = x + 1', 'Should preserve action');
});

// Test 5: Disconnected components
test('Handle disconnected components', () => {
  const places = [
    { id: 'p1', label: 'P1', x: 0, y: 0, io_type: 'input' },
    { id: 'p2', label: 'P2', x: 0, y: 0 },
    { id: 'p3', label: 'P3', x: 0, y: 0 } // disconnected
  ];
  const transitions = [
    { id: 't1', label: 'T1', x: 0, y: 0 }
  ];
  const arcs = [
    { id: 'a1', source: 'p1', target: 't1' },
    { id: 'a2', source: 't1', target: 'p2' }
    // p3 is disconnected
  ];
  
  const result = computeAutoLayout(places, transitions, arcs);
  
  assert(result.places.length === 3, 'Should return all 3 places');
  // Disconnected node should still get a position
  const p3 = result.places.find(p => p.id === 'p3');
  assert(typeof p3.x === 'number', 'Disconnected place should have x coordinate');
  assert(typeof p3.y === 'number', 'Disconnected place should have y coordinate');
});

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Tests: ${passed + failed} total, ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}`);

if (failed > 0) {
  process.exit(1);
}

console.log('\n✅ All auto-layout tests passed!');
