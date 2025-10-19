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
});


