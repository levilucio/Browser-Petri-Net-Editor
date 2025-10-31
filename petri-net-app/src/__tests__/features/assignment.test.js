// @ts-check
import { findSatisfyingAssignment } from '../../features/simulation/assignment';

function makeBaseDeps(overrides = {}) {
  const defaults = {
    transition: { id: 't1' },
    inputArcs: [{ id: 'a1', sourceId: 'p1', weight: 1 }],
    placesById: { p1: { id: 'p1', valueTokens: [10, 20] } },
    bindingAstsByArc: new Map([
      ['a1', [{ kind: 'pattern', ast: { node: 'pattern' } }]],
    ]),
    guardAst: null,
    parseArithmetic: jest.fn(),
    evaluateBooleanPredicate: jest.fn(),
    matchPattern: jest.fn((ast, tok) => ({ token: tok })),
    getTokensForPlace: jest.fn((place) => place.valueTokens.slice()),
    evaluateArithmeticWithBindings: jest.fn(),
    evaluateBooleanWithBindings: jest.fn(() => true),
    evaluatePatternLiteral: jest.fn(),
    maxTokensPerPlace: 5,
  };
  return { ...defaults, ...overrides };
}

describe('findSatisfyingAssignment', () => {
  test('returns environment and picks when bindings succeed', async () => {
    const deps = makeBaseDeps();

    const result = await findSatisfyingAssignment(deps);

    expect(result).toBeTruthy();
    expect(result?.env).toEqual({ token: 10 });
    expect(result?.picks).toHaveLength(1);
    expect(result?.picks[0]).toMatchObject({ arcId: 'a1', srcId: 'p1', tokenIndex: 0, value: 10, countFallback: false });
  });

  test('falls back to evaluateBooleanPredicate when pure guard evaluation fails', async () => {
    const deps = makeBaseDeps({
      guardAst: { node: 'guard' },
      evaluateBooleanWithBindings: jest.fn(() => { throw new Error('pure fail'); }),
      evaluateBooleanPredicate: jest.fn(async () => true),
    });

    const result = await findSatisfyingAssignment(deps);

    expect(deps.evaluateBooleanWithBindings).toHaveBeenCalled();
    expect(deps.evaluateBooleanPredicate).toHaveBeenCalledWith(deps.guardAst, { token: 10 }, deps.parseArithmetic);
    expect(result).toBeTruthy();
  });

  test('returns null when insufficient tokens are available', async () => {
    const deps = makeBaseDeps({
      getTokensForPlace: jest.fn(() => []),
    });

    const result = await findSatisfyingAssignment(deps);
    expect(result).toBeNull();
  });

  test('returns null when guard evaluation fails for all strategies', async () => {
    const deps = makeBaseDeps({
      guardAst: { node: 'guard' },
      evaluateBooleanWithBindings: jest.fn(() => { throw new Error('boom'); }),
      evaluateBooleanPredicate: jest.fn(async () => { throw new Error('fallback boom'); }),
    });

    const result = await findSatisfyingAssignment(deps);
    expect(result).toBeNull();
  });

  test('pattern binding rejects conflicting variable assignments', async () => {
    const deps = makeBaseDeps({
      bindingAstsByArc: new Map([
        ['a1', [{ kind: 'pattern', ast: {} }, { kind: 'pattern', ast: {} }]],
      ]),
      getTokensForPlace: jest.fn(() => [10, 11]),
      matchPattern: jest.fn((ast, tok) => ({ token: tok })),
    });

    const result = await findSatisfyingAssignment(deps);
    expect(result).toBeNull();
  });

  test('arith binding requires evaluated value to match numeric token', async () => {
    const deps = makeBaseDeps({
      bindingAstsByArc: new Map([
        ['a1', [{ kind: 'arith', ast: { expr: 'x' } }]],
      ]),
      evaluateArithmeticWithBindings: jest.fn(() => 99),
    });

    const result = await findSatisfyingAssignment(deps);
    expect(result).toBeNull();
  });

  test('bool binding accepts only matching boolean tokens', async () => {
    const deps = makeBaseDeps({
      getTokensForPlace: jest.fn(() => [true]),
      bindingAstsByArc: new Map([
        ['a1', [{ kind: 'bool', ast: { expr: 'flag' } }]],
      ]),
      evaluateBooleanWithBindings: jest.fn(() => false),
    });

    const result = await findSatisfyingAssignment(deps);
    expect(result).toBeNull();
  });

  test('pair binding matches literal pair structures', async () => {
    const pairToken = { __pair__: true, fst: 1, snd: 2 };
    const deps = makeBaseDeps({
      getTokensForPlace: jest.fn(() => [pairToken]),
      bindingAstsByArc: new Map([
        ['a1', [{ kind: 'pair', ast: { type: 'pairLit' } }]],
      ]),
      evaluatePatternLiteral: jest.fn(() => pairToken),
    });

    const result = await findSatisfyingAssignment(deps);
    expect(result).toBeTruthy();
    expect(result?.picks).toHaveLength(1);
  });
});


