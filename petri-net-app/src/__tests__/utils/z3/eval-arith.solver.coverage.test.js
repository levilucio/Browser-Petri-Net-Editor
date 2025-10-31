import { evaluateArithmetic } from '../../../utils/z3/eval-arith';

describe('evaluateArithmetic solver integrations', () => {
  test('solves simple integer expressions', async () => {
    const ast = {
      type: 'bin',
      op: '+',
      left: { type: 'int', value: 5 },
      right: { type: 'int', value: 3 },
    };

    await expect(evaluateArithmetic(ast)).resolves.toBe(8);
  });

  test('throws on division by zero', async () => {
    const ast = {
      type: 'bin',
      op: '/',
      left: { type: 'int', value: 1 },
      right: { type: 'int', value: 0 },
    };

    await expect(evaluateArithmetic(ast)).rejects.toThrow('Division by zero');
  });

  test('rejects unknown operators', async () => {
    const ast = {
      type: 'bin',
      op: '%',
      left: { type: 'int', value: 4 },
      right: { type: 'int', value: 2 },
    };

    await expect(evaluateArithmetic(ast)).rejects.toThrow("Unknown operator '%'");
  });
});


