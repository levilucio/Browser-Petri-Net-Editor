import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';

describe('AlgebraicSimulator (smoke)', () => {
  test('enables transition with simple variable binding and guard, consumes and produces', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [2, 5] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'x >= 2' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['x'] },
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
    expect(p1.tokens).toBe(1);
    expect(Array.isArray(p2.valueTokens)).toBe(true);
    expect(p2.valueTokens.length).toBe(1);
    expect([2,5]).toContain(p2.valueTokens[0]);
  }, 15000);
});


