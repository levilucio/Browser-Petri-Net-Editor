import { getContext } from '../../../utils/z3/context';
import { buildZ3Expr } from '../../../utils/z3/builders';

describe('builders string support', () => {
  test('String.val and length via builder', async () => {
    const { ctx } = await getContext();
    const sym = () => {};
    const ast = { type: 'funcall', name: 'length', args: [ { type: 'string', value: 'abc' } ] };
    const expr = buildZ3Expr(ctx, ast, sym);
    // When evaluated in a solver, should equal 3
    const { Int, Solver } = ctx;
    const s = new Solver();
    const res = Int.const('r');
    s.add(res.eq(expr));
    const st = await s.check();
    expect(String(st)).toBe('sat');
    const m = s.model();
    const v = m.eval(res, true);
    expect(Number.parseInt(v.asString?.() ?? String(v), 10)).toBe(3);
  });
});


