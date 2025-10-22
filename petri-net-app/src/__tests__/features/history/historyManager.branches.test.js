import { HistoryManager } from '../../../features/history/historyManager';

describe('HistoryManager branches', () => {
  const empty = { places: [], transitions: [], arcs: [] };

  test('no-op add when states equal', () => {
    const hm = new HistoryManager(empty);
    const info = hm.addState(empty);
    expect(info.canUndo).toBe(false);
    expect(info.canRedo).toBe(false);
  });

  test('undo/redo return null when not possible', () => {
    const hm = new HistoryManager(empty);
    expect(hm.undo()).toBeNull();
    expect(hm.redo()).toBeNull();
  });
});


