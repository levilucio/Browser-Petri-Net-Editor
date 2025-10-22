import { evaluatePatternLiteral } from '../../utils/ast-eval';

describe('ast-eval evaluatePatternLiteral', () => {
  test('evaluates pair/list/tuple and vars', () => {
    const env = { x: 1, y: 2 };
    const pair = { type: 'pairLit', fst: { type: 'int', value: 1 }, snd: { type: 'int', value: 2 } };
    expect(evaluatePatternLiteral(pair, env)).toEqual({ __pair__: true, fst: 1, snd: 2 });

    const list = { type: 'list', elements: [{ type: 'int', value: 3 }, { type: 'var', name: 'x' }] };
    expect(evaluatePatternLiteral(list, env)).toEqual([3, 1]);

    const tuple = { type: 'tuplePattern', elements: [{ type: 'var', name: 'y' }, { type: 'boolLit', value: true }] };
    expect(evaluatePatternLiteral(tuple, env)).toEqual([2, true]);
  });
});
