// @ts-check
import { parseArithmetic } from '../../../utils/arith-parser';
import { evaluateArithmeticWithBindings } from '../../../utils/z3/eval-arith';

describe('eval-arith JS reductions', () => {
  test('pair literal and list length', async () => {
    const ast = parseArithmetic('(1, length([2,3,4]))');
    const value = await evaluateArithmeticWithBindings(ast, {});
    expect(value).toEqual({ __pair__: true, fst: 1, snd: 3 });
  });

  test('string concat and substring', async () => {
    const a = parseArithmetic(`concat('hello','world!')`);
    const av = await evaluateArithmeticWithBindings(a, {});
    expect(av).toBe('helloworld!');
  });

  test('list concat merges arrays', () => {
    const ast = parseArithmetic('concat([1,2],[3,4])');
    expect(evaluateArithmeticWithBindings(ast, {})).toEqual([1, 2, 3, 4]);
  });

  test('isSubstringOf returns expected booleans', () => {
    const astTrue = parseArithmetic(`isSubstringOf('lo','hello')`);
    const astFalse = parseArithmetic(`isSubstringOf('bye','hello')`);
    expect(evaluateArithmeticWithBindings(astTrue, {})).toBe(true);
    expect(evaluateArithmeticWithBindings(astFalse, {})).toBe(false);
  });

  test('fst and snd extract pair components', () => {
    const pairLiteral = { type: 'pair', fst: { type: 'int', value: 7 }, snd: { type: 'int', value: 9 } };
    const fstAst = { type: 'funcall', name: 'fst', args: [pairLiteral] };
    const sndAst = { type: 'funcall', name: 'snd', args: [pairLiteral] };
    expect(evaluateArithmeticWithBindings(fstAst, {})).toBe(7);
    expect(evaluateArithmeticWithBindings(sndAst, {})).toBe(9);
  });

  test('tail returns empty list for empty inputs', () => {
    const emptyList = { type: 'list', elements: [] };
    const tailAst = { type: 'funcall', name: 'tail', args: [emptyList] };
    expect(evaluateArithmeticWithBindings(tailAst, {})).toEqual([]);
  });

  test('variable resolution pulls from provided bindings', () => {
    const ast = { type: 'var', name: 'x' };
    expect(evaluateArithmeticWithBindings(ast, { x: 42 })).toBe(42);
    expect(() => evaluateArithmeticWithBindings(ast, {})).toThrow("Unbound variable 'x'");
  });
});


