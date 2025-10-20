// @ts-check
import { applyMultiDragDeltaFromSnapshot } from '../../features/selection/selection-utils';

describe('selection-utils no-snap path', () => {
  test('applyMultiDragDeltaFromSnapshot without snapping uses raw deltas', () => {
    const state = {
      places: [{ id: 'p1', x: 10, y: 10 }],
      transitions: [{ id: 't1', x: 20, y: 20 }],
      arcs: [{ id: 'a1', source: 'p1', target: 't1', anglePoints: [{ x: 5, y: 5 }] }],
    };
    const snapshot = {
      startPositions: new Map([
        ['p1', { type: 'place', x: 10, y: 10 }],
        ['t1', { type: 'transition', x: 20, y: 20 }],
      ]),
      startArcPoints: new Map([
        ['a1', [{ x: 5, y: 5 }]],
      ]),
    };
    const next = applyMultiDragDeltaFromSnapshot(state, snapshot, { dx: 7, dy: -3 }, { gridSnappingEnabled: false });
    expect(next.places.find(p => p.id === 'p1')).toMatchObject({ x: 17, y: 7 });
    expect(next.transitions.find(t => t.id === 't1')).toMatchObject({ x: 27, y: 17 });
    expect(next.arcs.find(a => a.id === 'a1').anglePoints[0]).toEqual({ x: 12, y: 2 });
  });
});


