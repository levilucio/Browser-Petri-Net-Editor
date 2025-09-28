import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';

describe('Pattern Output Production', () => {
  test('produces pattern literal (T,2) on output arc', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [4] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'T' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p2', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x:int'] },
        { id: 'a2', sourceId: 't1', targetId: 'p1', sourceType: 'transition', targetType: 'place', bindings: ['(T,2)'] },
      ],
      netMode: 'algebraic-int'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });

    const enabledBefore = await sim.getEnabledTransitions();
    expect(enabledBefore).toContain('t1');

    const after = await sim.fireTransition('t1');
    const p1 = after.places.find(p => p.id === 'p1');
    const p2 = after.places.find(p => p.id === 'p2');
    
    expect(p2.tokens).toBe(0); // Token consumed
    expect(p1.valueTokens).toHaveLength(1);
    expect(p1.valueTokens[0]).toEqual({ __pair__: true, fst: true, snd: 2 });
  }, 15000);

  test('produces pattern literal (F,1) on output arc', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [3] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'T' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p2', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x:int'] },
        { id: 'a2', sourceId: 't1', targetId: 'p1', sourceType: 'transition', targetType: 'place', bindings: ['(F,1)'] },
      ],
      netMode: 'algebraic-int'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });

    const after = await sim.fireTransition('t1');
    const p1 = after.places.find(p => p.id === 'p1');
    
    expect(p1.valueTokens).toHaveLength(1);
    expect(p1.valueTokens[0]).toEqual({ __pair__: true, fst: false, snd: 1 });
  }, 15000);

  test('produces multiple pattern literals on different output arcs', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [] },
        { id: 'p3', label: 'P3', x: 0, y: 0, valueTokens: [5] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'T' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p3', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x:int'] },
        { id: 'a2', sourceId: 't1', targetId: 'p1', sourceType: 'transition', targetType: 'place', bindings: ['(T,2)'] },
        { id: 'a3', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['(F,x)'] },
      ],
      netMode: 'algebraic-int'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });

    const after = await sim.fireTransition('t1');
    const p1 = after.places.find(p => p.id === 'p1');
    const p2 = after.places.find(p => p.id === 'p2');
    
    expect(p1.valueTokens).toHaveLength(1);
    expect(p1.valueTokens[0]).toEqual({ __pair__: true, fst: true, snd: 2 });
    
    expect(p2.valueTokens).toHaveLength(1);
    expect(p2.valueTokens[0]).toEqual({ __pair__: true, fst: false, snd: 5 });
  }, 15000);
});
