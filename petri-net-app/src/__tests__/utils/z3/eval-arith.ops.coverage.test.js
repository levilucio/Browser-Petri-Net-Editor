// @ts-check
import { parseArithmetic } from '../../../utils/arith-parser';
import { evaluateArithmeticWithBindings } from '../../../utils/z3/eval-arith';

describe('eval-arith operators and ADT functions coverage', () => {
  test('numeric binops + - * / precedence', () => {
    const ast = parseArithmetic('1 + 2 * 3 - 4 / 2');
    const v = evaluateArithmeticWithBindings(ast, {});
    expect(v).toBe(5);
  });

  test('list concat and length', () => {
    const ast = parseArithmetic('length(concat([1,2], [3]))');
    const v = evaluateArithmeticWithBindings(ast, {});
    expect(v).toBe(3);
  });

  test('head and tail success including empty tail', () => {
    expect(evaluateArithmeticWithBindings(parseArithmetic('head([7,8])'), {})).toBe(7);
    expect(evaluateArithmeticWithBindings(parseArithmetic('tail([7,8])'), {})).toEqual([8]);
    expect(evaluateArithmeticWithBindings(parseArithmetic('tail([])'), {})).toEqual([]);
  });

  test('append and sublist', () => {
    expect(evaluateArithmeticWithBindings(parseArithmetic('append([1,2], 3)'), {})).toEqual([1,2,3]);
    expect(evaluateArithmeticWithBindings(parseArithmetic('sublist([1,2,3,4], 1, 2)'), {})).toEqual([2,3]);
  });

  test('isSublistOf true and false', () => {
    expect(evaluateArithmeticWithBindings(parseArithmetic('isSublistOf([2,3], [1,2,3,4])'), {})).toBe(true);
    expect(evaluateArithmeticWithBindings(parseArithmetic('isSublistOf([2,4], [1,2,3,4])'), {})).toBe(false);
  });

  test('fst and snd on pair', () => {
    expect(evaluateArithmeticWithBindings(parseArithmetic('fst((5,6))'), {})).toBe(5);
    expect(evaluateArithmeticWithBindings(parseArithmetic('snd((5,6))'), {})).toBe(6);
  });

  test('isSubstringOf returns boolean', () => {
    expect(evaluateArithmeticWithBindings(parseArithmetic("isSubstringOf('bar','foobarbaz')"), {})).toBe(true);
  });
});


