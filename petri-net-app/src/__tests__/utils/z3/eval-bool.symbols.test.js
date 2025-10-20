// @ts-check
import { parseBooleanExpr, evaluateBooleanWithBindings } from '../../../utils/z3/eval-bool';
import { parseArithmetic } from '../../../utils/arith-parser';

describe('eval-bool symbol operators and invalid inputs', () => {
  test('! && || precedence and grouping (with parens)', () => {
    const ast = parseBooleanExpr('!(1 == 2) && ((2 < 3) || (4 < 3))', parseArithmetic);
    expect(evaluateBooleanWithBindings(ast, {}, parseArithmetic)).toBe(true);
  });

  test('mixed words and symbols with precedence (with parens)', () => {
    const ast = parseBooleanExpr('(not (x < 2)) || ((y >= 3) && (z == 5))', parseArithmetic);
    expect(evaluateBooleanWithBindings(ast, { x: 1, y: 3, z: 5 }, parseArithmetic)).toBe(true);
  });

  test('invalid inputs throw', () => {
    expect(() => parseBooleanExpr('and (1 == 1)', parseArithmetic)).toThrow();
    expect(() => parseBooleanExpr('(', parseArithmetic)).toThrow();
  });
});


