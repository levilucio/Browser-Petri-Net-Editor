import { parseBooleanExpr, evaluateBooleanWithBindings } from '../../../utils/z3/eval-bool';

function evalBool(src, env = {}) {
  const ast = parseBooleanExpr(src);
  return evaluateBooleanWithBindings(ast, env);
}

describe('eval-bool precedence matrix', () => {
  test('not binds tighter than and/or/xor', () => {
    expect(evalBool('not T or F')).toBe(false);
    expect(evalBool('not (T or F)')).toBe(false);
  });

  test('and over or with parentheses', () => {
    expect(evalBool('T and F or T')).toBe(true);
    expect(evalBool('(T and F) or T')).toBe(true);
    expect(evalBool('T and (F or T)')).toBe(true);
  });

  test('xor, implies, iff combinations', () => {
    // xor
    expect(evalBool('T xor T')).toBe(false);
    expect(evalBool('T xor F')).toBe(true);
    // implies
    expect(evalBool('T -> T')).toBe(true);
    expect(evalBool('T -> F')).toBe(false);
    expect(evalBool('F -> T')).toBe(true);
    // iff
    expect(evalBool('T <-> T')).toBe(true);
    expect(evalBool('T <-> F')).toBe(false);
  });

  test('mixed operators precedence sanity', () => {
    expect(evalBool('not F and T or F')).toBe(true);
    expect(evalBool('(not F and T) or F')).toBe(true);
    expect(evalBool('not (F and T) or F')).toBe(true);
  });

  test('invalid sequences throw', () => {
    expect(() => parseBooleanExpr('T and or F')).toThrow();
    expect(() => parseBooleanExpr('T -> -> F')).toThrow();
  });
});


