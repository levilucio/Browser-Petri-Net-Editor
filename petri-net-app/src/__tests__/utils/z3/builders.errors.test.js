import { buildZ3Expr } from '../../../utils/z3/builders';

describe('z3 builders error branches', () => {
  const ctx = {
    Int: { val: (n) => ({ kind: 'int', n }), const: (n) => ({ kind: 'sym', n }) },
    String: { val: (s) => ({ kind: 'str', s, concat: function(o){ return this; }, substr: function(){ return this; }, length: function(){ return { kind:'int', n:0 }; } }) },
  };
  const sym = (n) => ({ kind: 'sym', n });

  test('unknown function throws', () => {
    expect(() => buildZ3Expr(ctx, { type: 'funcall', name: 'unknown', args: [] }, sym)).toThrow();
  });

  test('unknown operator throws', () => {
    expect(() => buildZ3Expr(ctx, { type: 'binop', op: '%', left: { type: 'int', value: 1 }, right: { type: 'int', value: 2 } }, sym)).toThrow();
  });
});


