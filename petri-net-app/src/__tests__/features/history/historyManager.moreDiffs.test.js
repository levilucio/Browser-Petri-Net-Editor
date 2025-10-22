import { HistoryManager } from '../../../features/history/historyManager';

describe('HistoryManager compareStates additional branches', () => {
  const base = {
    places: [ { id: 'p1', x: 0, y: 0, tokens: 0, label: 'P1', name: 'P1', valueTokens: [] } ],
    transitions: [ { id: 't1', x: 0, y: 0, label: 'T1', name: 'T1', guard: '' } ],
    arcs: [ { id: 'a1', source: 'p1', target: 't1', weight: 1, label: 'L', sourceType: 'place', targetType: 'transition', bindings: [], anglePoints: [] } ],
  };

  test('place valueTokens difference triggers new state', () => {
    const hm = new HistoryManager(base);
    const s2 = { ...base, places: [ { ...base.places[0], valueTokens: [1] } ] };
    const info = hm.addState(s2);
    expect(info.canUndo).toBe(true);
  });

  test('transition guard change triggers new state', () => {
    const hm = new HistoryManager(base);
    const s2 = { ...base, transitions: [ { ...base.transitions[0], guard: 'x>0' } ] };
    const info = hm.addState(s2);
    expect(info.canUndo).toBe(true);
  });

  test('arc bindings change triggers new state', () => {
    const hm = new HistoryManager(base);
    const s2 = { ...base, arcs: [ { ...base.arcs[0], bindings: [ { x: 1 } ] } ] };
    const info = hm.addState(s2);
    expect(info.canUndo).toBe(true);
  });

  test('arc anglePoints change triggers new state', () => {
    const hm = new HistoryManager(base);
    const s2 = { ...base, arcs: [ { ...base.arcs[0], anglePoints: [ { x: 5, y: 6 } ] } ] };
    const info = hm.addState(s2);
    expect(info.canUndo).toBe(true);
  });

  test('arc label/sourceType/targetType difference triggers new state', () => {
    const hm = new HistoryManager(base);
    const s2 = { ...base, arcs: [ { ...base.arcs[0], label: 'Z', sourceType: 'transition', targetType: 'place' } ] };
    const info = hm.addState(s2);
    expect(info.canUndo).toBe(true);
  });

  test('deepCopyState produces independent copies', () => {
    const hm = new HistoryManager(base);
    const current = hm.getCurrentState();
    expect(current).not.toBe(base);
    expect(current.places[0]).not.toBe(base.places[0]);
    // mutate original and ensure history copy unaffected
    base.places[0].x = 99;
    expect(hm.getCurrentState().places[0].x).toBe(0);
  });
});


