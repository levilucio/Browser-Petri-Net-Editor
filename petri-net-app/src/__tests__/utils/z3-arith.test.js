// @ts-check
import { evaluateAction, evaluatePredicate } from '../../utils/z3-arith';

jest.mock('../../utils/z3/eval-arith.js', () => ({
  evaluateArithmeticWithBindings: jest.fn(),
}));

jest.mock('../../utils/z3/eval-bool.js', () => ({
  evaluateBooleanPredicate: jest.fn(),
}));

const { evaluateArithmeticWithBindings } = jest.requireMock('../../utils/z3/eval-arith.js');
const { evaluateBooleanPredicate } = jest.requireMock('../../utils/z3/eval-bool.js');

describe('z3-arith convenience exports', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('evaluateAction returns empty object for falsy or malformed input', () => {
    expect(evaluateAction('', {})).toEqual({});
    expect(evaluateAction(null, {})).toEqual({});
    expect(evaluateAction(' , , ', {})).toEqual({});
  });

  test('evaluateAction parses assignments and evaluates expressions', () => {
    const parseArithmetic = jest.fn((expr) => ({ expr }));
    evaluateArithmeticWithBindings
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(20);

    const bindings = { marker: 'm' };
    const result = evaluateAction('x = 1 + 2, y=foo', bindings, parseArithmetic);

    expect(parseArithmetic).toHaveBeenCalledTimes(2);
    expect(parseArithmetic).toHaveBeenNthCalledWith(1, '1 + 2');
    expect(parseArithmetic).toHaveBeenNthCalledWith(2, 'foo');

    expect(evaluateArithmeticWithBindings).toHaveBeenCalledTimes(2);
    expect(evaluateArithmeticWithBindings).toHaveBeenNthCalledWith(1, { expr: '1 + 2' }, bindings);
    expect(evaluateArithmeticWithBindings).toHaveBeenNthCalledWith(2, { expr: 'foo' }, bindings);

    expect(result).toEqual({ x: 10, y: 20 });
  });

  test('evaluateAction skips segments without assignment target', () => {
    const parseArithmetic = jest.fn((expr) => ({ expr }));
    evaluateArithmeticWithBindings.mockReturnValueOnce(undefined);

    const result = evaluateAction('noEquals, =rightOnly, leftOnly=', {}, parseArithmetic);

    expect(parseArithmetic).toHaveBeenCalledTimes(1);
    expect(parseArithmetic).toHaveBeenCalledWith('');
    expect(evaluateArithmeticWithBindings).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ leftOnly: undefined });
  });

  test('evaluatePredicate proxies to evaluateBooleanPredicate', async () => {
    evaluateBooleanPredicate.mockResolvedValueOnce(true);
    const parseArithmetic = jest.fn();

    await expect(evaluatePredicate('guard', { flag: true }, parseArithmetic)).resolves.toBe(true);

    expect(evaluateBooleanPredicate).toHaveBeenCalledTimes(1);
    expect(evaluateBooleanPredicate).toHaveBeenCalledWith('guard', { flag: true }, parseArithmetic);
  });
});


