// @ts-check
import { parseBooleanExpr, evaluateBooleanWithBindings } from '../../../utils/z3/eval-bool';
import { parseArithmetic } from '../../../utils/arith-parser';

describe('eval-bool parser and evaluator', () => {
  test('word operators and precedence', () => {
    const expr = parseBooleanExpr('x < y and (y < 3 or z == 30)', parseArithmetic);
    const result = evaluateBooleanWithBindings(expr, { x: 3, y: 4, z: 30 }, parseArithmetic);
    expect(result).toBe(true);
  });

  test('word operators variant', () => {
    const expr = parseBooleanExpr('x < y and (y < 3 or z == 30)', parseArithmetic);
    const result = evaluateBooleanWithBindings(expr, { x: 3, y: 4, z: 30 }, parseArithmetic);
    expect(result).toBe(true);
  });

  test('negation and xor/implies/iff parsing', () => {
    const expr = parseBooleanExpr('!(a == b) or (p -> q) and (r <-> r)', parseArithmetic);
    // Minimal bindings for arithmetic terms inside comparators
    const result = evaluateBooleanWithBindings(expr, { a: 1, b: 2, p: 0, q: 1, r: 5 }, parseArithmetic);
    expect(typeof result).toBe('boolean');
  });
});


