/**
 * Test ADT Operations in Guards and Actions
 */

import { parseBooleanExpr, evaluateBooleanWithBindings } from '../../utils/z3-arith.js';
import { parseArithmetic, evaluateArithmeticWithBindings } from '../../utils/arith-parser.js';

describe('ADT Operations', () => {
  test('field accessor: quantity(Material(100))', () => {
    const material = { __adt__: true, constructor: 'Material', args: [100] };
    const bindings = { mat: material };
    
    const ast = parseArithmetic('quantity(mat)');
    const result = evaluateArithmeticWithBindings(ast, bindings);
    
    expect(result).toBe(100);
  });
  
  test('guard with field accessor: quantity(mat) >= 50', () => {
    const material = { __adt__: true, constructor: 'Material', args: [100] };
    const bindings = { mat: material };
    
    const guardAst = parseBooleanExpr('quantity(mat) >= 50');
    const result = evaluateBooleanWithBindings(guardAst, bindings, parseArithmetic);
    
    expect(result).toBe(true);
  });
  
  test('constructor comparison: priority(ord) == High()', () => {
    const order = { __adt__: true, constructor: 'Order', args: [
      1,
      { __adt__: true, constructor: 'High', args: [] }
    ]};
    const bindings = { ord: order };
    
    const guardAst = parseBooleanExpr('priority(ord) == High()');
    const result = evaluateBooleanWithBindings(guardAst, bindings, parseArithmetic);
    
    expect(result).toBe(true);
  });
  
  test('nested accessor: priority(order(Job(...)))', () => {
    const order = { __adt__: true, constructor: 'Order', args: [
      1,
      { __adt__: true, constructor: 'High', args: [] }
    ]};
    const material = { __adt__: true, constructor: 'Material', args: [100] };
    const job = { __adt__: true, constructor: 'Job', args: [order, material] };
    const bindings = { j: job };
    
    const guardAst = parseBooleanExpr('priority(order(j)) == High()');
    const result = evaluateBooleanWithBindings(guardAst, bindings, parseArithmetic);
    
    expect(result).toBe(true);
  });
  
  test('insufficient material guard fails', () => {
    const material = { __adt__: true, constructor: 'Material', args: [30] };
    const bindings = { mat: material };
    
    const guardAst = parseBooleanExpr('quantity(mat) >= 50');
    const result = evaluateBooleanWithBindings(guardAst, bindings, parseArithmetic);
    
    expect(result).toBe(false);
  });
});
