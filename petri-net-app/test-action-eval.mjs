#!/usr/bin/env node
import { evaluateAction } from './src/utils/z3-arith.js';
import { parseArithmetic } from './src/utils/arith-parser.js';

const bindings = {
  ord: { __adt__: true, constructor: 'Order', args: [1, { __adt__: true, constructor: 'Normal', args: [] }] },
  mat: { __adt__: true, constructor: 'Material', args: [100] },
  j: { __adt__: true, constructor: 'Job', args: [
    { __adt__: true, constructor: 'Order', args: [1, { __adt__: true, constructor: 'High', args: [] }] },
    { __adt__: true, constructor: 'Material', args: [100] }
  ]}
};

console.log('Testing action evaluation:\n');

// Test 1: Simple assignment
try {
  const result1 = evaluateAction('outJob = j', bindings);
  console.log('✓ outJob = j:', JSON.stringify(result1, null, 2));
} catch (err) {
  console.log('✗ outJob = j failed:', err.message);
}

// Test 2: Constructor call
try {
  const result2 = evaluateAction('job = Job(ord, mat)', bindings);
  console.log('✓ job = Job(ord, mat):', JSON.stringify(result2, null, 2));
} catch (err) {
  console.log('✗ job = Job(ord, mat) failed:', err.message);
}

// Test 3: Complex constructor
try {
  const result3 = evaluateAction('prod = Product(id(order(j)), Pass())', bindings);
  console.log('✓ prod = Product(...):', JSON.stringify(result3, null, 2));
} catch (err) {
  console.log('✗ prod = Product(...) failed:', err.message);
}
