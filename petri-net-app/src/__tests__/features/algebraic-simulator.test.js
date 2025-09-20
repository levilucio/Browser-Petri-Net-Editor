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

  test('updates enabled transitions when guard changes without re-initialize', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [1] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'x > 5' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x'] },
      ],
      netMode: 'algebraic-int'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });

    let enabled = await sim.getEnabledTransitions();
    expect(enabled).not.toContain('t1');

    // Change guard to allow current token
    const updated = JSON.parse(JSON.stringify(net));
    updated.transitions = updated.transitions.map(t => t.id === 't1' ? { ...t, guard: 'x >= 1' } : t);
    await sim.update(updated);

    enabled = await sim.getEnabledTransitions();
    expect(enabled).toContain('t1');
  }, 15000);

  test('updates output production when output arc bindings change without reload', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [3, 5] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'x >= 0' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['x'] },
      ],
      netMode: 'algebraic-int'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });

    // Fire once: should copy x (first token 3)
    const after1 = await sim.fireTransition('t1');
    const p2a = after1.places.find(p => p.id === 'p2');
    expect(p2a.valueTokens).toEqual([3]);

    // Change output binding to x+1 and fire again without re-init
    const updated = JSON.parse(JSON.stringify(after1));
    updated.arcs = updated.arcs.map(a => a.id === 'a2' ? { ...a, bindings: ['x+1'] } : a);
    await sim.update(updated);

    const after2 = await sim.fireTransition('t1');
    const p2b = after2.places.find(p => p.id === 'p2');
    // Should now include 6 from x+1 applied to second token 5
    expect(p2b.valueTokens).toEqual(expect.arrayContaining([3, 6]));
  }, 15000);
});


