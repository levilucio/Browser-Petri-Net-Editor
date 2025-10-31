// @ts-check
import { consumeTokens, produceTokens } from '../../features/simulation/token-io';

describe('token-io helpers', () => {
  test('consumeTokens reduces fallback counts and removes indexed value tokens', () => {
    const picks = [
      { srcId: 'p1', countFallback: true },
      { srcId: 'p1', tokenIndex: 1, countFallback: false },
      { srcId: 'p1', tokenIndex: 4, countFallback: false }, // out of bounds ignored
      { srcId: 'p2', countFallback: true },
      { srcId: 'missing', countFallback: true },
    ];

    const placesById = {
      p1: { id: 'p1', tokens: 3, valueTokens: [10, 20, 30] },
      p2: { id: 'p2', tokens: 2 },
    };

    consumeTokens(picks, placesById);

    expect(placesById.p1.tokens).toBe(2);
    expect(placesById.p1.valueTokens).toEqual([10, 30]);
    expect(placesById.p2.tokens).toBe(1);
  });

  test('produceTokens handles binding varieties, weights, and defaults', () => {
    const pairToken = { __pair__: true, fst: 'L', snd: 'R' };
    const arcs = [
      { id: 'a1', targetId: 'p1' },
      { id: 'a2', targetId: 'p2', weight: 2 },
      { id: 'a3', targetId: 'p3' },
    ];

    const bindingAstsByArc = new Map([
      ['a1', [
        { ast: { type: 'var', name: 'x' } },
        { kind: 'bool', ast: { expr: 'flag' } },
        { kind: 'pattern', ast: { node: 'pattern' } },
        { kind: 'pair', ast: { type: 'pairLit' } },
        { kind: 'arith', ast: { expr: 'list' } },
        { kind: 'arith', ast: { expr: 'fail' } },
        { ast: { type: 'var', name: 'tuple' } },
      ]],
    ]);

    const env = {
      x: 21,
      flag: true,
      tuple: ['alpha', 'beta'],
    };

    const evaluateArithmeticWithBindings = jest
      .fn()
      .mockReturnValueOnce([9, 10])
      .mockImplementationOnce(() => { throw new Error('boom'); });
    const evaluateBooleanWithBindings = jest.fn(() => false);
    const evaluatePatternLiteral = jest
      .fn()
      .mockReturnValueOnce('pattern-token')
      .mockReturnValueOnce(pairToken);
    const parseArithmetic = jest.fn();

    const placesById = {
      p1: { id: 'p1', valueTokens: [] },
      p2: { id: 'p2', valueTokens: [] },
      p3: { id: 'p3', tokens: 5 },
    };

    produceTokens(
      arcs,
      bindingAstsByArc,
      env,
      placesById,
      { evaluateArithmeticWithBindings, evaluateBooleanWithBindings, evaluatePatternLiteral, parseArithmetic }
    );

    expect(placesById.p1.valueTokens).toEqual([
      21, // from var binding
      false, // bool evaluation normalized
      'pattern-token',
      pairToken,
      [9, 10],
      'alpha',
      'beta',
    ]);
    expect(placesById.p1.tokens).toBe(7);

    expect(placesById.p2.valueTokens).toEqual([21, 21]);
    expect(placesById.p2.tokens).toBe(2);

    expect(placesById.p3.tokens).toBe(6);

    expect(evaluateArithmeticWithBindings).toHaveBeenCalledTimes(2);
    expect(evaluateBooleanWithBindings).toHaveBeenCalledWith(expect.any(Object), env, parseArithmetic);
    expect(evaluatePatternLiteral).toHaveBeenCalledTimes(2);
  });
});


