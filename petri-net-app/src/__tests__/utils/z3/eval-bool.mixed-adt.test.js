import { parseBooleanExpr, evaluateBooleanWithBindings } from '../../../utils/z3/eval-bool';
import { evaluateArithmeticWithBindings } from '../../../utils/z3/eval-arith';
import { parseArithmetic } from '../../../utils/arith-parser';

describe('boolean with mixed ADT terms', () => {
  test("length(concat([], tail(['x','a']))) == 1 and fst((1,2)) < 3", () => {
    const expr = "length(concat([], tail(['x','a']))) == 1 and fst((1,2)) < 3";
    const ast = parseBooleanExpr(expr, parseArithmetic);
    const res = evaluateBooleanWithBindings(ast, {}, evaluateArithmeticWithBindings);
    expect(res).toBe(true);
  });

  test("isSubstringOf('lo', concat('hel','lo')) and snd((2,3)) == 3", () => {
    const expr = "isSubstringOf('lo', concat('hel','lo')) and snd((2,3)) == 3";
    const ast = parseBooleanExpr(expr, parseArithmetic);
    const res = evaluateBooleanWithBindings(ast, {}, evaluateArithmeticWithBindings);
    expect(res).toBe(true);
  });
});


