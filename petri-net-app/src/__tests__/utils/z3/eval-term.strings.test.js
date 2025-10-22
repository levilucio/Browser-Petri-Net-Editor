import { evaluateTermWithBindings } from '../../../utils/z3/eval-arith';

describe('evaluateTermWithBindings string variable support', () => {
  test('length(s) with string binding', async () => {
    const ast = { type: 'funcall', name: 'length', args: [ { type: 'var', name: 's' } ] };
    const res = await evaluateTermWithBindings(ast, { s: 'abcd' });
    expect(res).toBe(4);
  });

  test("length(concat(s, 'x')) with string binding", async () => {
    const ast = { type: 'funcall', name: 'length', args: [ { type: 'funcall', name: 'concat', args: [ { type: 'var', name: 's' }, { type: 'string', value: 'x' } ] } ] };
    const res = await evaluateTermWithBindings(ast, { s: 'ab' });
    expect(res).toBe(3);
  });

  test("length(substring(s, 1, 2)) with string binding", async () => {
    const ast = { type: 'funcall', name: 'length', args: [ { type: 'funcall', name: 'substring', args: [ { type: 'var', name: 's' }, { type: 'int', value: 1 }, { type: 'int', value: 2 } ] } ] };
    const res = await evaluateTermWithBindings(ast, { s: 'wxyz' });
    expect(res).toBe(2);
  });
});


