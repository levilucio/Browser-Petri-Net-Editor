import { normalizeNet } from '../../utils/pnml/normalize';

describe('pnml normalizeNet', () => {
  test('fills defaults and maps aliases', () => {
    const net = normalizeNet({
      places: [{ id: 'p1', x: '10', y: 20, label: 'P1', tokens: '2' }],
      transitions: [{ id: 't1', x: 5, y: '6', name: 'T1', guard: 'x>0' }],
      arcs: [{ id: 'a1', sourceId: 'p1', targetId: 't1', weight: '3', binding: 'x=1' }],
    });
    expect(net.places[0]).toMatchObject({ id: 'p1', x: 10, y: 20, label: 'P1', name: 'P1', tokens: 2 });
    expect(net.transitions[0]).toMatchObject({ id: 't1', x: 5, y: 6, label: 'T1', name: 'T1', guard: 'x>0' });
    expect(net.arcs[0]).toMatchObject({ id: 'a1', source: 'p1', target: 't1', weight: 3, bindings: ['x=1'] });
  });

  test('preserves valueTokens and derives tokens length', () => {
    const net = normalizeNet({ places: [{ id: 'p2', valueTokens: [1, 2] }] });
    expect(net.places[0]).toMatchObject({ id: 'p2', tokens: 2, valueTokens: [1, 2] });
  });
});
