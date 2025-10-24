import { stringifyArithmetic } from '../../../utils/parse/arithmetic-impl';

describe('stringifyArithmetic', () => {
  test('int and string', () => {
    expect(stringifyArithmetic({ type: 'int', value: 42 })).toBe('42');
    expect(stringifyArithmetic({ type: 'string', value: "a'b" })).toBe("'a\\'b'");
  });

  test('list and pair via list of elements rendered', () => {
    const list = { type: 'list', elements: [ { type: 'int', value: 1 }, { type: 'int', value: 2 } ] };
    expect(stringifyArithmetic(list)).toBe('[1, 2]');
  });

  test('binop formatting with nesting', () => {
    const ast = { type: 'binop', op: '+', left: { type: 'int', value: 1 }, right: { type: 'binop', op: '*', left: { type: 'int', value: 2 }, right: { type: 'int', value: 3 } } };
    expect(stringifyArithmetic(ast)).toBe('(1 + (2 * 3))');
  });

  test('funcall formatting with args', () => {
    const ast = { type: 'funcall', name: 'f', args: [ { type: 'int', value: 3 }, { type: 'string', value: 'x' } ] };
    expect(stringifyArithmetic(ast)).toBe("f(3, 'x')");
  });
});


