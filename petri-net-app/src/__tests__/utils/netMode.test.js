import { detectNetModeFromContent } from '../../utils/netMode';

describe('detectNetModeFromContent', () => {
  test('returns pt for empty or non-algebraic nets', () => {
    expect(detectNetModeFromContent(null)).toBe('pt');
    expect(detectNetModeFromContent({ places: [], transitions: [], arcs: [] })).toBe('pt');
  });

  test('returns algebraic-int when algebraic features present', () => {
    const net = {
      places: [{ id: 'p1', valueTokens: [1] }],
      transitions: [],
      arcs: [],
    };
    expect(detectNetModeFromContent(net)).toBe('algebraic-int');
  });

  test('detects algebraic via transition guard or arc bindings', () => {
    expect(detectNetModeFromContent({ places: [], transitions: [{ id: 't1', guard: 'x>0' }], arcs: [] })).toBe('algebraic-int');
    expect(detectNetModeFromContent({ places: [], transitions: [], arcs: [{ id: 'a1', bindings: ['x=1'] }] })).toBe('algebraic-int');
  });
});


