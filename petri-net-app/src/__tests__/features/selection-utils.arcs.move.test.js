import { applyMultiDragDelta } from '../../features/selection/selection-utils';

describe('applyMultiDragDelta moves arc anglePoints only when both endpoints are selected', () => {
  test('angle points move when both ends selected; remain when not', () => {
    const state = {
      places: [{ id: 'p1', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 100, y: 100 }, { id: 't2', x: 200, y: 200 }],
      arcs: [
        { id: 'aMove', source: 'p1', target: 't1', anglePoints: [{ x: 10, y: 10 }] },
        { id: 'aStay', source: 'p1', target: 't2', anglePoints: [{ x: 20, y: 20 }] },
      ],
    };
    const selection = [{ id: 'p1', type: 'place' }, { id: 't1', type: 'transition' }];
    const next = applyMultiDragDelta(state, selection, { dx: 5, dy: 7 });
    const move = next.arcs.find(a => a.id === 'aMove');
    const stay = next.arcs.find(a => a.id === 'aStay');
    expect(move.anglePoints[0]).toEqual({ x: 15, y: 17 });
    expect(stay.anglePoints[0]).toEqual({ x: 20, y: 20 });
  });
});


