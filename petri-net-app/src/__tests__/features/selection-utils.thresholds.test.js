import { applyMultiDragDeltaFromSnapshot, buildSelectionFromRect } from '../../features/selection/selection-utils';

describe('selection-utils small branches', () => {
  test('applyMultiDragDeltaFromSnapshot returns prev when snapshot missing', () => {
    const state = { places: [{ id: 'p1', x: 0, y: 0 }], transitions: [] };
    const next = applyMultiDragDeltaFromSnapshot(state, null, { dx: 10, dy: 10 });
    expect(next).toBe(state);
  });

  test('buildSelectionFromRect returns empty when null inputs', () => {
    expect(buildSelectionFromRect(null, null)).toEqual([]);
  });
});


