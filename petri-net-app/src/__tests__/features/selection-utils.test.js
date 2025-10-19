import { isCenterInRect, buildSelectionFromRect, toggleSelection, applyMultiDragDeltaFromSnapshot, applyMultiDragDelta } from '../../features/selection/selection-utils';

describe('selection-utils', () => {
  test('isCenterInRect detects points inside regardless of rect direction', () => {
    const rect1 = { x: 10, y: 10, w: 20, h: 30 };
    const rect2 = { x: 30, y: 40, w: -20, h: -30 }; // inverted
    expect(isCenterInRect({ x: 20, y: 25 }, rect1)).toBe(true);
    expect(isCenterInRect({ x: 20, y: 25 }, rect2)).toBe(true);
    expect(isCenterInRect({ x: 5, y: 5 }, rect1)).toBe(false);
  });

  test('buildSelectionFromRect collects places and transitions whose centers are inside', () => {
    const elements = {
      places: [{ id: 'p1', x: 10, y: 10 }, { id: 'p2', x: 100, y: 100 }],
      transitions: [{ id: 't1', x: 15, y: 15 }, { id: 't2', x: 200, y: 200 }],
    };
    const rect = { x: 0, y: 0, w: 30, h: 30 };
    const sel = buildSelectionFromRect(elements, rect);
    expect(sel).toEqual(expect.arrayContaining([
      { id: 'p1', type: 'place' },
      { id: 't1', type: 'transition' },
    ]));
    expect(sel).toHaveLength(2);
  });

  test('toggleSelection adds and removes items by id/type', () => {
    let sel = [];
    sel = toggleSelection(sel, { id: 'p1', type: 'place' });
    expect(sel).toEqual([{ id: 'p1', type: 'place' }]);
    sel = toggleSelection(sel, { id: 'p1', type: 'place' });
    expect(sel).toEqual([]);
  });

  test('applyMultiDragDeltaFromSnapshot shifts selected nodes and arc points; supports snapping', () => {
    const state = {
      places: [{ id: 'p1', x: 10, y: 10 }, { id: 'p2', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 20, y: 20 }],
      arcs: [{ id: 'a1', source: 'p1', target: 't1', anglePoints: [{ x: 5, y: 5 }, { x: 6, y: 6 }] }],
    };
    const snapshot = {
      startPositions: new Map([
        ['p1', { type: 'place', x: 10, y: 10 }],
        ['t1', { type: 'transition', x: 20, y: 20 }],
      ]),
      startArcPoints: new Map([
        ['a1', [{ x: 5, y: 5 }, { x: 6, y: 6 }]],
      ]),
    };
    const snapToGrid = (x, y) => ({ x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 });
    const next = applyMultiDragDeltaFromSnapshot(state, snapshot, { dx: 7, dy: 7 }, { gridSnappingEnabled: true, snapToGrid });
    const p1 = next.places.find(p => p.id === 'p1');
    const t1 = next.transitions.find(t => t.id === 't1');
    expect(p1).toMatchObject({ x: 20, y: 20 });
    expect(t1).toMatchObject({ x: 30, y: 30 });
    const a1 = next.arcs.find(a => a.id === 'a1');
    expect(a1.anglePoints[0]).toEqual({ x: 12, y: 12 });
    expect(a1.anglePoints[1]).toEqual({ x: 13, y: 13 });
  });

  test('applyMultiDragDelta shifts only selected nodes and arcs whose endpoints are selected', () => {
    const state = {
      places: [{ id: 'p1', x: 10, y: 10 }, { id: 'p2', x: 0, y: 0 }],
      transitions: [{ id: 't1', x: 20, y: 20 }],
      arcs: [
        { id: 'a1', source: 'p1', target: 't1', anglePoints: [{ x: 5, y: 5 }] },
        { id: 'a2', source: 'p2', target: 't1', anglePoints: [{ x: 1, y: 1 }] },
      ],
    };
    const selection = [{ id: 'p1', type: 'place' }, { id: 't1', type: 'transition' }];
    const next = applyMultiDragDelta(state, selection, { dx: 5, dy: 5 }, {});
    const p1 = next.places.find(p => p.id === 'p1');
    const t1 = next.transitions.find(t => t.id === 't1');
    expect(p1).toMatchObject({ x: 15, y: 15 });
    expect(t1).toMatchObject({ x: 25, y: 25 });
    const a1 = next.arcs.find(a => a.id === 'a1');
    const a2 = next.arcs.find(a => a.id === 'a2');
    expect(a1.anglePoints[0]).toEqual({ x: 10, y: 10 }); // moved
    expect(a2.anglePoints[0]).toEqual({ x: 1, y: 1 }); // unchanged
  });
});


