#!/usr/bin/env node
/**
 * Test ADT Operations in Guards and Actions
 */

import { parseBooleanExpr, evaluateBooleanWithBindings } from './src/utils/z3-arith.js';
import { parseArithmetic, evaluateArithmeticWithBindings } from './src/utils/arith-parser.js';

console.log('Testing ADT Operations\n');

// Test 1: Field accessor
const material = { __adt__: true, constructor: 'Material', args: [100] };
const bindings1 = { mat: material };

try {
  const quantityAst = parseArithmetic('quantity(mat)');
  const quantityVal = evaluateArithmeticWithBindings(quantityAst, bindings1);
  console.log('✓ quantity(Material(100)):', quantityVal);
  console.assert(quantityVal === 100, 'Expected 100');
} catch (err) {
  console.log('✗ Field accessor failed:', err.message);
}

// Test 2: Guard with field accessor
try {
  const guardAst = parseBooleanExpr('quantity(mat) >= 50');
  const guardResult = evaluateBooleanWithBindings(guardAst, bindings1, parseArithmetic);
  console.log('✓ quantity(mat) >= 50:', guardResult);
  console.assert(guardResult === true, 'Expected true');
} catch (err) {
  console.log('✗ Guard evaluation failed:', err.message);
}

// Test 3: Constructor comparison
const order = { __adt__: true, constructor: 'Order', args: [
  1,
  { __adt__: true, constructor: 'High', args: [] }
]};
const bindings2 = { ord: order };

try {
  const priorityAst = parseArithmetic('priority(ord)');
  const priorityVal = evaluateArithmeticWithBindings(priorityAst, bindings2);
  console.log('✓ priority(Order(1, High())):', JSON.stringify(priorityVal));
} catch (err) {
  console.log('✗ Priority accessor failed:', err.message);
}

// Test 4: ADT comparison in guard
try {
  const guardAst = parseBooleanExpr('priority(ord) == High()');
  const guardResult = evaluateBooleanWithBindings(guardAst, bindings2, parseArithmetic);
  console.log('✓ priority(ord) == High():', guardResult);
  console.assert(guardResult === true, 'Expected true for High priority');
} catch (err) {
  console.log('✗ Constructor comparison failed:', err.message);
}

// Test 5: Nested accessor
const job = { __adt__: true, constructor: 'Job', args: [order, material] };
const bindings3 = { j: job };

try {
  const nestedAst = parseArithmetic('priority(order(j))');
  const nestedVal = evaluateArithmeticWithBindings(nestedAst, bindings3);
  console.log('✓ priority(order(Job(...))):', JSON.stringify(nestedVal));
} catch (err) {
  console.log('✗ Nested accessor failed:', err.message);
}

// Test 6: Nested comparison
try {
  const guardAst = parseBooleanExpr('priority(order(j)) == High()');
  const guardResult = evaluateBooleanWithBindings(guardAst, bindings3, parseArithmetic);
  console.log('✓ priority(order(j)) == High():', guardResult);
  console.assert(guardResult === true, 'Expected true');
} catch (err) {
  console.log('✗ Nested guard failed:', err.message);
}

console.log('\n✅ ADT operations working!');
