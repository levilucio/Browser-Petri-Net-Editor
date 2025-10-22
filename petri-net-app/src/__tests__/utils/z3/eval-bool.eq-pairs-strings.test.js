import { parseBooleanExpr, evaluateBooleanWithBindings } from '../../../utils/z3/eval-bool';
import { parseArithmetic } from '../../../utils/arith-parser';
import { evaluateArithmeticWithBindings } from '../../../utils/z3/eval-arith';

describe('eval-bool equality over pairs and strings', () => {
  test("('ab' == concat('a','b')) and ((1,2) == (1,2))", () => {
    const expr = "'ab' == concat('a','b') and (1,2) == (1,2)";
    const ast = parseBooleanExpr(expr, parseArithmetic);
    const res = evaluateBooleanWithBindings(ast, {}, evaluateArithmeticWithBindings);
    expect(res).toBe(true);
  });

  test("('ab' != 'ac') and ((1,2) != (2,1))", () => {
    const expr = "'ab' != 'ac' and (1,2) != (2,1)";
    const ast = parseBooleanExpr(expr, parseArithmetic);
    const res = evaluateBooleanWithBindings(ast, {}, evaluateArithmeticWithBindings);
    expect(res).toBe(true);
  });
});


