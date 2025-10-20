// @ts-check
import { parseArithmetic } from '../../../utils/arith-parser';
import { evaluateArithmeticWithBindings } from '../../../utils/z3/eval-arith';

describe('eval-arith error branches', () => {
  test('concat type errors', () => {
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('concat([1], "x")'), {})).toThrow();
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('concat(1, 2)'), {})).toThrow();
  });

  test('substring type/arity errors', () => {
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('substring("abc", "1", 2)'), {})).toThrow();
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('substring("abc", 1, "2")'), {})).toThrow();
  });

  test('length invalid type', () => {
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('length(1)'), {})).toThrow();
  });

  test('head/tail errors', () => {
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('head([])'), {})).toThrow();
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('tail(1)'), {})).toThrow();
  });

  test('append/sublist errors', () => {
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('append(1, 2)'), {})).toThrow();
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('sublist([1,2], "0", 1)'), {})).toThrow();
  });

  test('isSublistOf type errors', () => {
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('isSublistOf(1, [1,2])'), {})).toThrow();
  });

  test('fst/snd require pair', () => {
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('fst(1)'), {})).toThrow();
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('snd(1)'), {})).toThrow();
  });

  test('division by zero', () => {
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('1 / 0'), {})).toThrow();
  });

  test('unknown function throws', () => {
    expect(() => evaluateArithmeticWithBindings(parseArithmetic('foo(1)'), {})).toThrow();
  });
});


