import { PTSimulator } from '../../features/simulation/pt-simulator';

const makePTNet = () => ({
  places: [
    { id: 'p1', label: 'P1', x: 0, y: 0, tokens: 2 },
    { id: 'p2', label: 'P2', x: 100, y: 0, tokens: 0 },
  ],
  transitions: [
    { id: 't1', label: 'T1', x: 50, y: 0 },
  ],
  arcs: [
    { id: 'a1', sourceId: 'p1', source: 'p1', targetId: 't1', target: 't1', weight: 1 },
    { id: 'a2', sourceId: 't1', source: 't1', targetId: 'p2', target: 'p2', weight: 1 },
  ],
  netMode: 'pt',
});

describe('PTSimulator', () => {
  test('initializes, determines enabled transitions, and fires tokens', async () => {
    const net = makePTNet();
    const sim = new PTSimulator();
    await sim.initialize(net);

    expect(sim.getType()).toBe('pt');
    const enabled = await sim.getEnabledTransitions();
    expect(enabled).toEqual(['t1']);

    const after = await sim.fireTransition('t1');
    const p1 = after.places.find(p => p.id === 'p1');
    const p2 = after.places.find(p => p.id === 'p2');
    expect(p1.tokens).toBe(1);
    expect(p2.tokens).toBe(1);

    const stats = sim.getSimulationStats();
    expect(stats).toMatchObject({
      totalTokens: 2,
      totalPlaces: 2,
      totalTransitions: 1,
    });
  });

  test('validatePTNet rejects algebraic guards and actions', () => {
    const sim = new PTSimulator();
    const algebraicNet = {
      places: [],
      transitions: [{ id: 't-alg', guard: 'x + 1', action: null }],
      arcs: [],
    };
    expect(() => sim.validatePTNet(algebraicNet)).toThrow('P/T simulator cannot handle algebraic expressions');
  });

  test('resetSpecific restores default maxTokens', () => {
    const sim = new PTSimulator();
    sim.maxTokens = 3;
    sim.resetSpecific();
    expect(sim.maxTokens).toBe(Infinity);
  });
});



