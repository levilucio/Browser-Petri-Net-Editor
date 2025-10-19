import { collectSelection, remapIdsForPaste } from '../../features/selection/clipboard-utils';

describe('clipboard-utils', () => {
  const state = {
    places: [{ id: 'p1', x: 10, y: 10 }, { id: 'p2', x: 100, y: 100 }],
    transitions: [{ id: 't1', x: 20, y: 20 }],
    arcs: [
      { id: 'a1', source: 'p1', target: 't1' },
      { id: 'a2', source: 'p2', target: 't1' },
    ],
  };

  test('collectSelection returns only selected nodes and arcs connecting selected endpoints', () => {
    const selection = [{ id: 'p1', type: 'place' }, { id: 't1', type: 'transition' }];
    const clip = collectSelection(state, selection);
    expect(clip.places.map(p => p.id)).toEqual(['p1']);
    expect(clip.transitions.map(t => t.id)).toEqual(['t1']);
    expect(clip.arcs.map(a => a.id)).toEqual(['a1']);
  });

  test('remapIdsForPaste creates new IDs and offsets coordinates', () => {
    const selection = [{ id: 'p1', type: 'place' }, { id: 't1', type: 'transition' }];
    const clip = collectSelection(state, selection);
    let nextId = 1;
    const idFactory = () => `n${nextId++}`;
    const { newPlaces, newTransitions, newArcs, newSelection } = remapIdsForPaste(clip, idFactory, { x: 40, y: 10 });
    expect(newPlaces).toHaveLength(1);
    expect(newTransitions).toHaveLength(1);
    expect(newArcs).toHaveLength(1);
    expect(newPlaces[0].id).toBe('n1');
    expect(newTransitions[0].id).toBe('n2');
    expect(newPlaces[0]).toMatchObject({ x: 50, y: 20 });
    expect(newTransitions[0]).toMatchObject({ x: 60, y: 30 });
    expect(newArcs[0].source).toBe('n1');
    expect(newArcs[0].target).toBe('n2');
    expect(newSelection).toEqual(expect.arrayContaining([{ id: 'n1', type: 'place' }, { id: 'n2', type: 'transition' }]));
  });
});


