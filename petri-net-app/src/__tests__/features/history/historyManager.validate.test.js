import { HistoryManager } from '../../../features/history/historyManager';

describe('HistoryManager validateState basics', () => {
  test('coerces empty or missing structures to empty arrays', () => {
    const hm = new HistoryManager({});
    const v = hm.validateState(null);
    expect(v).toEqual({ places: [], transitions: [], arcs: [] });
  });
});


