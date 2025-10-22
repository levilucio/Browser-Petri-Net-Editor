import { HistoryManager } from '../../../features/history/historyManager';

describe('HistoryManager diffs paths', () => {
  const base = {
    places: [ { id: 'p1', x: 0, y: 0, tokens: 0 } ],
    transitions: [ { id: 't1', x: 0, y: 0 } ],
    arcs: [ { id: 'a1', source: 'p1', target: 't1', weight: 1, label: 'L' } ],
  };

  test('transition count difference triggers new state', () => {
    const hm = new HistoryManager(base);
    const s2 = { ...base, transitions: [ ...base.transitions, { id: 't2', x: 1, y: 1 } ] };
    const info = hm.addState(s2);
    expect(info.canUndo).toBe(true);
  });

  test('arc secondary property difference triggers new state', () => {
    const hm = new HistoryManager(base);
    const s2 = { ...base, arcs: [ { ...base.arcs[0], label: 'Z' } ] };
    const info = hm.addState(s2);
    expect(info.canUndo).toBe(true);
  });
});


