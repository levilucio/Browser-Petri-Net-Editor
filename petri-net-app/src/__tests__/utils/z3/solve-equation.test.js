import { solveEquation, solveInequality } from '../../../utils/z3/eval-bool';

describe('Z3 solveEquation and solveInequality', () => {
  test('solveEquation x + 2 = 5', async () => {
    const lhs = { type: 'binop', op: '+', left: { type: 'var', name: 'x' }, right: { type: 'int', value: 2 } };
    const rhs = { type: 'int', value: 5 };
    const { solutions } = await solveEquation(lhs, rhs, 1);
    expect(solutions.length).toBeGreaterThan(0);
    expect(solutions[0].x).toBe(3);
  });

  test('solveInequality x < 3', async () => {
    const lhs = { type: 'var', name: 'x' };
    const rhs = { type: 'int', value: 3 };
    const { solutions } = await solveInequality(lhs, rhs, '<', 1);
    expect(solutions.length).toBeGreaterThan(0);
    expect(typeof solutions[0].x).toBe('number');
  });
});


