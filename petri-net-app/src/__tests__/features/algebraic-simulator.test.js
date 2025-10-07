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

  test('bool guard with bool tokens enables and fires', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [true] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'b and true' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['b:bool'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['b:bool'] },
      ],
      netMode: 'algebraic-int'
    };
    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });
    const enabled = await sim.getEnabledTransitions();
    expect(enabled).toContain('t1');
    const after = await sim.fireTransition('t1');
    const p2 = after.places.find(p => p.id === 'p2');
    expect(p2.valueTokens).toEqual([true]);
  }, 15000);

  test('typed bindings x:int, y:bool consume tokens on step', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [2, true, 1, false] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'T' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x:int', 'y:bool'] },
      ],
      netMode: 'algebraic'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });

    const enabled = await sim.getEnabledTransitions();
    expect(enabled).toContain('t1');

    const before = sim.getCurrentState();
    const p1Before = before.places.find(p => p.id === 'p1');
    expect(p1Before.valueTokens.length).toBe(4);

    const after = await sim.fireTransition('t1');
    const p1After = after.places.find(p => p.id === 'p1');
    expect(p1After.valueTokens.length).toBe(2);
  }, 15000);

  test('typed bindings produce x to P2 and y to P3 with correct bools', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [false, 2, 11, true, 6] },
        { id: 'p2', label: 'P2', x: 300, y: 0, valueTokens: [] },
        { id: 'p3', label: 'P3', x: 300, y: 100, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 150, y: 0, guard: 'x < 10' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x:int', 'y:bool'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['x'] },
        { id: 'a3', sourceId: 't1', targetId: 'p3', sourceType: 'transition', targetType: 'place', bindings: ['y'] },
      ],
      netMode: 'algebraic'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });

    // Fire twice
    await sim.fireTransition('t1');
    await sim.fireTransition('t1');

    const after = sim.getCurrentState();
    const p1 = after.places.find(p => p.id === 'p1');
    const p2 = after.places.find(p => p.id === 'p2');
    const p3 = after.places.find(p => p.id === 'p3');
    expect(p2.valueTokens).toEqual([2, 6]);
    expect(p3.valueTokens).toEqual([false, true]);
    expect(p1.valueTokens).toEqual([11]);
  }, 20000);

  test('maximal mode fires non-conflicting int/bool transitions concurrently', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [false, 11, true, 6] },
        { id: 'p2', label: 'P2', x: 300, y: 0, valueTokens: [] },
        { id: 'p3', label: 'P3', x: 300, y: 120, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 150, y: 0, guard: 'x < 10' },
        { id: 't2', label: 'T2', x: 150, y: 120, guard: 'T' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x:int'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['x'] },
        { id: 'a3', sourceId: 'p1', targetId: 't2', sourceType: 'place', targetType: 'transition', bindings: ['y:bool'] },
        { id: 'a4', sourceId: 't2', targetId: 'p3', sourceType: 'transition', targetType: 'place', bindings: ['y'] },
      ],
      netMode: 'algebraic'
    };

    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'maximal' });

    // Compute enabled then simulate maximal step by calling both in arbitrary order
    const enabled = await sim.getEnabledTransitions();
    expect(enabled).toEqual(expect.arrayContaining(['t1','t2']));
    // Fire both (simulator core would coordinate this; here just sequentially emulate a batch)
    await sim.fireTransition('t1');
    await sim.fireTransition('t2');

    const after = sim.getCurrentState();
    const p1 = after.places.find(p => p.id === 'p1');
    const p2 = after.places.find(p => p.id === 'p2');
    const p3 = after.places.find(p => p.id === 'p3');
    // One int (<10) to P2 and one bool to P3, both consumed
    expect(p2.valueTokens.length).toBe(1);
    expect(typeof p2.valueTokens[0]).toBe('number');
    expect(p3.valueTokens.length).toBe(1);
    expect(typeof p3.valueTokens[0]).toBe('boolean');
    expect(p1.valueTokens.length).toBe(2);
  }, 20000);

  test('mixed multiset place supports ints and bools; bool binding matches on bools only', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [1, false, 3, true] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'b' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['b:bool'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['b:bool'] },
      ],
      netMode: 'algebraic-int'
    };
    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });
    const enabled = await sim.getEnabledTransitions();
    expect(enabled).toContain('t1');
    const after = await sim.fireTransition('t1');
    const p1 = after.places.find(p => p.id === 'p1');
    const p2 = after.places.find(p => p.id === 'p2');
    // Should have consumed a bool from p1 and produced same bool to p2
    expect(p2.valueTokens.some(v => typeof v === 'boolean')).toBe(true);
    expect(p1.valueTokens.length + p2.valueTokens.length).toBe(4);
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


describe('Pairs support', () => {
  test('supports pair tokens and pair equality in guards', async () => {
    const sim = new AlgebraicSimulator();
    const pPair = { __pair__: true, fst: false, snd: 1 };
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [pPair] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 100, y: 0, guard: 'x:pair == (F, 1)' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['x:pair'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['x:pair'] },
      ],
      netMode: 'algebraic-int'
    };
    await sim.initialize(net, { simulationMode: 'single' });
    const enabled = await sim.getEnabledTransitions();
    expect(enabled).toContain('t1');
    const after = await sim.fireTransition('t1');
    const p2 = after.places.find(p => p.id === 'p2');
    expect(Array.isArray(p2.valueTokens)).toBe(true);
    expect(p2.valueTokens.length).toBe(1);
    const out = p2.valueTokens[0];
    expect(out && out.__pair__).toBe(true);
    expect(out.fst).toBe(false);
    expect(out.snd).toBe(1);
  }, 20000);

  test('type mismatch between input (String) and output (Int) keeps transition disabled', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [{ __pair__: true, fst: 1, snd: { __pair__: true, fst: 2, snd: 'hello' } }] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'T' },
      ],
      arcs: [
        // Input arc binds x as String (nested in pair)
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['(1,(2,x:String))'] },
        // Output expects x as Int, which should mismatch with String env
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['x:Int'] },
      ],
      netMode: 'algebraic-int'
    };
    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });
    const enabled = await sim.getEnabledTransitions();
    expect(enabled).not.toContain('t1');
  }, 20000);

  test('output arc fst(z:Pair) projects first component', async () => {
    const sim = new AlgebraicSimulator();
    const pPair = { __pair__: true, fst: true, snd: 42 };
    const net = {
      places: [
        { id: 'p4', label: 'P4', x: 0, y: 0, valueTokens: [pPair] },
        { id: 'p5', label: 'P5', x: 0, y: 0, valueTokens: [true] },
        { id: 'p3', label: 'P3', x: 0, y: 0, valueTokens: [true] },
        { id: 'p6', label: 'P6', x: 0, y: 0, valueTokens: [] },
      ],
      transitions: [
        { id: 't3', label: 'T3', x: 100, y: 0, guard: 'x:Bool' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p3', targetId: 't3', sourceType: 'place', targetType: 'transition', bindings: ['x:Bool'] },
        { id: 'a2', sourceId: 'p5', targetId: 't3', sourceType: 'place', targetType: 'transition', bindings: ['y:Bool'] },
        { id: 'a3', sourceId: 'p4', targetId: 't3', sourceType: 'place', targetType: 'transition', bindings: ['z:Pair'] },
        { id: 'a4', sourceId: 't3', targetId: 'p6', sourceType: 'transition', targetType: 'place', bindings: ['fst(z:Pair)'] },
      ],
      netMode: 'algebraic-int'
    };
    await sim.initialize(net, { simulationMode: 'single' });
    const enabled = await sim.getEnabledTransitions();
    expect(enabled).toContain('t3');
    const after = await sim.fireTransition('t3');
    const p6 = after.places.find(p => p.id === 'p6');
    expect(p6.valueTokens).toEqual([true]);
  }, 20000);

  test('list deconstruction [1,x:Int,y:Int,z:Int,5] enables transition', async () => {
    const net = {
      places: [
        { id: 'p1', label: 'P1', x: 0, y: 0, valueTokens: [[1,2,3,4,5]] },
        { id: 'p2', label: 'P2', x: 0, y: 0, valueTokens: [] },
      ],
      transitions: [
        { id: 't1', label: 'T1', x: 0, y: 0, guard: 'T' },
      ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['[1,x:Int,y:Int,z:Int,5]'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['x:Int', 'y:Int', 'z:Int'] },
      ],
      netMode: 'algebraic-int'
    };
    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });
    const enabled = await sim.getEnabledTransitions();
    expect(enabled).toContain('t1');
  }, 20000);

  test('output list construction with variables produces a list token', async () => {
    const net = {
      places: [
        { id: 'p1', valueTokens: [[1,2,3,4,5]] },
        { id: 'p2', valueTokens: [] },
      ],
      transitions: [ { id: 't1', guard: 'T' } ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['[1,x:Int,y:Int,z:Int,5]'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['[x:Int, y:Int, z:Int]'] },
      ],
      netMode: 'algebraic-int'
    };
    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });
    const enabled = await sim.getEnabledTransitions();
    expect(enabled).toContain('t1');
    const after = await sim.fireTransition('t1');
    const p2 = after.places.find(p => p.id === 'p2');
    expect(Array.isArray(p2.valueTokens)).toBe(true);
    expect(p2.valueTokens.length).toBe(1);
    expect(p2.valueTokens[0]).toEqual([2,3,4]);
  }, 20000);

  test('output list construction with literals produces a list token', async () => {
    const net = {
      places: [
        { id: 'p1', valueTokens: [[1,2,3,4,5]] },
        { id: 'p2', valueTokens: [] },
      ],
      transitions: [ { id: 't1', guard: 'T' } ],
      arcs: [
        { id: 'a1', sourceId: 'p1', targetId: 't1', sourceType: 'place', targetType: 'transition', bindings: ['[1,x:Int,y:Int,z:Int,5]'] },
        { id: 'a2', sourceId: 't1', targetId: 'p2', sourceType: 'transition', targetType: 'place', bindings: ['[10, 20]'] },
      ],
      netMode: 'algebraic-int'
    };
    const sim = new AlgebraicSimulator();
    await sim.initialize(net, { simulationMode: 'single' });
    const after = await sim.fireTransition('t1');
    const p2 = after.places.find(p => p.id === 'p2');
    expect(p2.valueTokens).toEqual([[10, 20]]);
  }, 20000);
});


