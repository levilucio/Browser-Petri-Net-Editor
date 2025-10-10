import { buildGraphIndex } from '../../features/simulation/graph-index.js';

describe('buildGraphIndex', () => {
  test('indexes simple PT net with mixed arc id fields', () => {
    const net = {
      places: [{ id: 'p1' }, { id: 'p2' }],
      transitions: [{ id: 't1' }],
      arcs: [
        { id: 'a1', source: 'p1', target: 't1' },
        { id: 'a2', sourceId: 't1', targetId: 'p2' },
      ],
    };
    const idx = buildGraphIndex(net);
    expect(idx.placeById.get('p1')).toBeDefined();
    expect(idx.transitionById.get('t1')).toBeDefined();
    expect(idx.inArcsByTransition.get('t1').map(a => a.id)).toEqual(['a1']);
    expect(idx.outArcsByTransition.get('t1').map(a => a.id)).toEqual(['a2']);
    expect(idx.outArcsByPlace.get('p1').map(a => a.id)).toEqual(['a1']);
    expect(idx.inArcsByPlace.get('p2').map(a => a.id)).toEqual(['a2']);
  });
});


