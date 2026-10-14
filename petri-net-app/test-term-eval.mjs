import { parseTerm, evaluateTerm, evaluateActionWithTermParser } from './src/utils/term-parser.js';

// Test 1: Parse Job(ord, mat)
const ast = parseTerm('Job(ord, mat)');
console.log('Parsed AST:', JSON.stringify(ast, null, 2));

// Test 2: Evaluate with bindings
const bindings = {
  ord: { __adt__: true, constructor: 'Order', args: [1, { __adt__: true, constructor: 'Normal', args: [] }] },
  mat: { __adt__: true, constructor: 'Material', args: [100] }
};

try {
  const result = evaluateTerm(ast, bindings);
  console.log('Evaluated result:', JSON.stringify(result, null, 2));
} catch (err) {
  console.error('Evaluation error:', err.message);
}

// Test 3: Evaluate action
try {
  const actionString = 'job = Job(ord, mat)';
  console.log('\nEvaluating action:', actionString);
  console.log('Bindings:', JSON.stringify(bindings, null, 2));
  
  const actionResult = evaluateActionWithTermParser(actionString, bindings);
  console.log('Action result:', JSON.stringify(actionResult, null, 2));
  
  // Manual parse test
  const parts = actionString.split(',');
  console.log('\nParts:', parts);
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    const left = part.slice(0, eqIdx).trim();
    const right = part.slice(eqIdx + 1).trim();
    console.log(`Left: "${left}", Right: "${right}"`);
    const ast = parseTerm(right);
    console.log('Parsed AST:', JSON.stringify(ast, null, 2));
    const val = evaluateTerm(ast, bindings);
    console.log('Evaluated:', JSON.stringify(val, null, 2));
  }
} catch (err) {
  console.error('Action error:', err.message);
  console.error(err.stack);
}
