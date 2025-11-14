// @ts-check
import { computeGlobalTypeInferenceForState } from '../../../components/hooks/useGlobalTypeInference';

jest.mock('../../../utils/arith-parser', () => ({
  inferTokenType: jest.fn((token) => {
    if (Array.isArray(token)) return 'List';
    if (typeof token === 'number') return 'Int';
    if (typeof token === 'boolean') return 'Bool';
    if (token && typeof token === 'object' && token.__pair__) return 'Pair';
    return 'String';
  }),
  autoAnnotateTypes: jest.fn((expr, map) => {
    const suffix = Array.from(map.entries()).map(([k, v]) => `${k}:${v}`).join('|');
    return suffix ? `${expr}[${suffix}]` : expr;
  }),
}));

const { inferTokenType, autoAnnotateTypes } = jest.requireMock('../../../utils/arith-parser');

describe('computeGlobalTypeInferenceForState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns original state when net mode is not algebraic-int', () => {
    const state = { places: [], transitions: [], arcs: [] };
    const result = computeGlobalTypeInferenceForState(state, 'pt');
    expect(result).toBe(state);
  });

  test('returns original state when no annotations are computed', () => {
    const state = {
      places: [{ id: 'p1', valueTokens: [] }],
      transitions: [],
      arcs: [],
    };
    const result = computeGlobalTypeInferenceForState(state, 'algebraic-int');
    expect(result).toBe(state);
  });

  test('annotates input arc bindings based on place token type', () => {
    const state = {
      places: [{ id: 'p1', valueTokens: [1, 2, 3] }],
      transitions: [{ id: 't1', guard: '' }],
      arcs: [
        { id: 'a1', source: 'p1', target: 't1', bindings: ['x + 1'] },
      ],
    };

    const next = computeGlobalTypeInferenceForState(state, 'algebraic-int');
    expect(next).not.toBe(state);
    const annotatedArc = next.arcs.find(a => a.id === 'a1');
    expect(annotatedArc.bindings[0]).toContain('x:Int');
    expect(autoAnnotateTypes).toHaveBeenCalled();
  });

  test('propagates list element type annotations', () => {
    const state = {
      places: [{ id: 'p1', valueTokens: [[1, 2], [3, 4]] }],
      transitions: [{ id: 't1', guard: '' }],
      arcs: [
        { id: 'a1', source: 'p1', target: 't1', bindings: ['xs'] },
      ],
    };

    const next = computeGlobalTypeInferenceForState(state, 'algebraic-int');
    const annotated = next.arcs.find(a => a.id === 'a1').bindings[0];
    expect(annotated).toContain('xs:Int');
  });

  test('annotates guard and output arcs based on inferred variables', () => {
    const state = {
      places: [{ id: 'p1', valueTokens: [1, 2] }],
      transitions: [
        { id: 't1', guard: 'x > 0', action: '' },
      ],
      arcs: [
        { id: 'aIn', source: 'p1', target: 't1', bindings: ['x:Int'] },
        { id: 'aOut', source: 't1', target: 'p1', bindings: ['x'] },
      ],
    };

    const next = computeGlobalTypeInferenceForState(state, 'algebraic-int');
    const updatedGuard = next.transitions.find(t => t.id === 't1').guard;
    expect(updatedGuard).toContain('x:Int');
    const outArcBinding = next.arcs.find(a => a.id === 'aOut').bindings[0];
    expect(outArcBinding).toContain('x:Int');
  });

  test('annotates all variables in guard and output when input has all types (petri-net19 scenario)', () => {
    const state = {
      places: [{ id: 'p1', valueTokens: [1, 2, 3, 8] }],
      transitions: [
        { id: 't1', guard: 'a:Int + b == 5 and c - d == 7 and a:Int * d == 2' },
      ],
      arcs: [
        { id: 'a1', source: 'p1', target: 't1', bindings: ['a:Int, b:Int, c:Int, d:Int'] },
        { id: 'a2', source: 't1', target: 'p1', bindings: ['[a:Int + b, c - d, a:Int * d]'] },
      ],
    };

    const next = computeGlobalTypeInferenceForState(state, 'algebraic-int', true);
    const updatedGuard = next.transitions.find(t => t.id === 't1').guard;
    // Should annotate b, c, d even though a is already annotated
    expect(autoAnnotateTypes).toHaveBeenCalledWith(
      expect.stringContaining('a:Int + b'),
      expect.objectContaining(new Map([['b', 'Int'], ['c', 'Int'], ['d', 'Int']])),
      null,
      { overwrite: true }
    );
    const outArcBinding = next.arcs.find(a => a.id === 'a2').bindings[0];
    // Should annotate b, c, d in output binding
    expect(autoAnnotateTypes).toHaveBeenCalledWith(
      expect.stringContaining('[a:Int + b'),
      expect.objectContaining(new Map([['b', 'Int'], ['c', 'Int'], ['d', 'Int']])),
      null,
      { overwrite: true }
    );
  });
});


