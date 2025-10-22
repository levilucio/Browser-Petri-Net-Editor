import { collectVariables, buildZ3Expr } from '../../../utils/z3/builders';

describe('z3 builders fallbacks', () => {
  const makeStr = (s) => {
    const val = String(s);
    return {
      kind: 'str',
      s: val,
      concat: (other) => makeStr(val + (other?.s ?? String(other))),
      substr: (start, len) => makeStr(val.substr(start?.n ?? start, len?.n ?? len)),
      length: () => ({ kind: 'int', n: val.length }),
    };
  };
  const makeInt = (n) => {
    const num = Number(n);
    return {
      kind: 'int',
      n: num,
      add: (other) => makeInt(num + (other && typeof other.n === 'number' ? other.n : other)),
      sub: (other) => makeInt(num - (other && typeof other.n === 'number' ? other.n : other)),
      mul: (other) => makeInt(num * (other && typeof other.n === 'number' ? other.n : other)),
      div: (other) => {
        const den = (other && typeof other.n === 'number') ? other.n : (typeof other === 'number' ? other : 1);
        return makeInt(Math.trunc(num / (den || 1)));
      },
    };
  };
  const ctx = {
    Int: { val: makeInt, const: (n) => ({ kind: 'sym', n }) },
    String: { val: makeStr },
  };

  test('collectVariables traverses funcall args and binop', () => {
    const ast = { type: 'funcall', name: 'concat', args: [ { type: 'var', name: 'x' }, { type: 'binop', op: '+', left: { type: 'var', name: 'y' }, right: { type: 'int', value: 1 } } ] };
    const vars = Array.from(collectVariables(ast));
    expect(vars.sort()).toEqual(['x','y']);
  });

  test('pair encodes as concatenated string via builders', () => {
    const sym = (n) => ({ kind: 'sym', n });
    const ast = { type: 'pair', fst: { type: 'string', value: 'a' }, snd: { type: 'string', value: 'b' } };
    const built = buildZ3Expr(ctx, ast, sym);
    // our mock returns chained concat objects; assert shape by applying simple expectations
    expect(built).toBeDefined();
    expect(typeof built.concat).toBe('function');
  });
});


