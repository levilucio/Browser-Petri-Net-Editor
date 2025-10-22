import { evaluateTermWithBindings } from '../../../utils/z3/eval-arith';

describe('evaluateTermWithBindings (Z3-backed)', () => {
  test('simple numeric term under bindings', async () => {
    const ast = { type: 'binop', op: '+', left: { type: 'var', name: 'x' }, right: { type: 'int', value: 2 } };
    const res = await evaluateTermWithBindings(ast, { x: 5 });
    expect(res).toBe(7);
  });

  test('complex numeric expression under bindings', async () => {
    const ast = { type: 'binop', op: '-', left: { type: 'binop', op: '*', left: { type: 'var', name: 'x' }, right: { type: 'int', value: 3 } }, right: { type: 'int', value: 4 } };
    const res = await evaluateTermWithBindings(ast, { x: 3 });
    expect(res).toBe(5);
  });

  test('length over string literal via Z3 string theory', async () => {
    const ast = { type: 'funcall', name: 'length', args: [ { type: 'string', value: 'abcd' } ] };
    const res = await evaluateTermWithBindings(ast, {});
    expect(res).toBe(4);
  });
});


