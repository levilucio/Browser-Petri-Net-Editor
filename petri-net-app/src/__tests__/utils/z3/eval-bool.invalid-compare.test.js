import { parseBooleanExpr, evaluateBooleanWithBindings } from '../../../utils/z3/eval-bool';
import { parseArithmetic } from '../../../utils/arith-parser';
import { evaluateArithmeticWithBindings } from '../../../utils/z3/eval-arith';

describe('eval-bool mixed-type compare behaviour', () => {
  test('comparing list with int yields false (no throw)', () => {
    const expr = '[1,2] == 1';
    const ast = parseBooleanExpr(expr, parseArithmetic);
    const res = evaluateBooleanWithBindings(ast, {}, evaluateArithmeticWithBindings);
    expect(res).toBe(false);
  });
});


