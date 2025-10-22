import { parseBooleanExpr, evaluateBooleanWithBindings } from '../../../utils/z3/eval-bool';
import { evaluateArithmeticWithBindings } from '../../../utils/z3/eval-arith';

describe('eval-bool function calls', () => {
  test('isSubstringOf("lo", "hello") is true', () => {
    const ast = parseBooleanExpr('isSubstringOf("lo", "hello")', (s) => ({ type: 'string', value: s.replaceAll('"','') }));
    const res = evaluateBooleanWithBindings(ast, {}, evaluateArithmeticWithBindings);
    expect(res).toBe(true);
  });
});


