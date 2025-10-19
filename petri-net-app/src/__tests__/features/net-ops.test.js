import { deleteNodesAndIncidentArcs, copySelection, pasteClipboard } from '../../features/net/net-ops';

describe('net-ops', () => {
  const base = {
    places: [{ id: 'p1', x: 10, y: 10 }, { id: 'p2', x: 0, y: 0 }],
    transitions: [{ id: 't1', x: 20, y: 20 }],
    arcs: [
      { id: 'a1', source: 'p1', target: 't1' },
      { id: 'a2', source: 'p2', target: 't1' },
    ],
  };

  test('deleteNodesAndIncidentArcs removes nodes and their incident arcs', () => {
    const next = deleteNodesAndIncidentArcs(base, [{ id: 'p1' }, { id: 't1' }]);
    expect(next.places.map(p => p.id)).toEqual(['p2']);
    expect(next.transitions).toHaveLength(0);
    expect(next.arcs).toHaveLength(0);
  });

  test('copySelection returns nodes and arcs with both endpoints selected', () => {
    const clip = copySelection(base, [{ id: 'p1', type: 'place' }, { id: 't1', type: 'transition' }]);
    expect(clip.places.map(p => p.id)).toEqual(['p1']);
    expect(clip.transitions.map(t => t.id)).toEqual(['t1']);
    expect(clip.arcs.map(a => a.id)).toEqual(['a1']);
  });

  test('pasteClipboard remaps IDs and offsets positions', () => {
    const clip = copySelection(base, [{ id: 'p1', type: 'place' }, { id: 't1', type: 'transition' }]);
    let nextId = 1;
    const idFactory = () => `n${nextId++}`;
    const { next, newSelection } = pasteClipboard(base, clip, idFactory, { x: 40, y: 10 });
    const addedPlaces = next.places.filter(p => p.id.startsWith('n'));
    const addedTransitions = next.transitions.filter(t => t.id.startsWith('n'));
    expect(addedPlaces).toHaveLength(1);
    expect(addedTransitions).toHaveLength(1);
    expect(addedPlaces[0]).toMatchObject({ x: 50, y: 20 });
    expect(addedTransitions[0]).toMatchObject({ x: 60, y: 30 });
    const addedArc = next.arcs.find(a => a.id.startsWith('n'));
    expect(addedArc.source).toBe(addedPlaces[0].id);
    expect(addedArc.target).toBe(addedTransitions[0].id);
    expect(newSelection.map(s => s.type).sort()).toEqual(['place', 'transition']);
  });
});


