import { buildZ3Expr } from '../../../utils/z3/builders';

describe('z3 builders errors (unknowns)', () => {
  const ctx = {
    Int: { val: (n) => ({ kind: 'int', n }), const: (n) => ({ kind: 'sym', n }) },
    String: { val: (s) => ({ kind: 'str', s }) },
  };

  test('unknown function throws', () => {
    const ast = { type: 'funcall', name: 'unknownFn', args: [ { type: 'int', value: 1 } ] };
    const sym = () => ({ kind: 'sym' });
    expect(() => buildZ3Expr(ctx, ast, sym)).toThrow();
  });

  test('unknown operator throws', () => {
    const ast = { type: 'binop', op: '%', left: { type: 'int', value: 1 }, right: { type: 'int', value: 2 } };
    const sym = () => ({ kind: 'sym' });
    expect(() => buildZ3Expr(ctx, ast, sym)).toThrow();
  });
});


