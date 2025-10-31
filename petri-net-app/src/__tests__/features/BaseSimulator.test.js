// @ts-check
import { BaseSimulator } from '../../features/simulation/BaseSimulator';
import { SimulationEvents } from '../../features/simulation/SimulationEventBus';

class TestSimulator extends BaseSimulator {
  constructor() {
    super();
    this.initCalls = 0;
    this.updateCalls = 0;
    this.fireCalls = [];
    this.enabledList = [];
    this.resetCalls = 0;
  }

  async initializeSpecific(net) {
    this.initCalls += 1;
    this.petriNet = net;
  }

  async updateSpecific(net) {
    this.updateCalls += 1;
    this.petriNet = net;
  }

  async getEnabledTransitionsSpecific() {
    return this.enabledList.slice();
  }

  async fireTransitionSpecific(id) {
    this.fireCalls.push(id);
    return this.petriNet;
  }

  resetSpecific() {
    this.resetCalls += 1;
  }

  getType() {
    return 'test';
  }
}

function makeMinimalNet() {
  return {
    places: [{ id: 'p1', tokens: 1 }],
    transitions: [{ id: 't1' }],
    arcs: [{ id: 'a1', source: 'p1', target: 't1' }],
  };
}

describe('BaseSimulator', () => {
  test('initialize validates input and sets simulator state', async () => {
    const sim = new TestSimulator();
    await expect(sim.initialize(null)).rejects.toThrow('Invalid Petri net structure');

    const net = makeMinimalNet();
    await sim.initialize(net, { simulationMode: 'maximal' });

    expect(sim.isInitialized).toBe(true);
    expect(sim.simulationMode).toBe('maximal');
    expect(sim.initCalls).toBe(1);
  });

  test('update enforces initialization and normalizes nets', async () => {
    const sim = new TestSimulator();
    const net = makeMinimalNet();
    await expect(sim.update(net)).rejects.toThrow('Simulator not initialized');

    await sim.initialize(net);
    const updated = {
      places: [{ id: 1, valueTokens: [1, 2], tokens: 0, name: 'Place 1' }],
      transitions: [{ id: 7 }],
      arcs: [{ id: 5, source: 1, target: 7, weight: 0, binding: 'x:int' }],
    };
    await sim.update(updated);

    expect(sim.updateCalls).toBe(1);
    expect(sim.petriNet.places[0].tokens).toBe(2);
    expect(sim.petriNet.places[0].label).toBe('Place 1');
    expect(sim.petriNet.arcs[0].sourceId).toBe('1');
    expect(sim.petriNet.arcs[0].weight).toBe(1);
    expect(sim.petriNet.arcs[0].bindings).toEqual(['x:int']);
  });

  test('fireTransition checks readiness and enabled transitions', async () => {
    const sim = new TestSimulator();
    await sim.initialize(makeMinimalNet());
    sim.enabledList = ['t1'];

    await expect(sim.fireTransition('t2')).rejects.toThrow('Transition t2 is not enabled');

    const result = await sim.fireTransition('t1');
    expect(result).toBe(sim.petriNet);
    expect(sim.fireCalls).toEqual(['t1']);
  });

  test('emitTransitionsChanged and emitTransitionFired normalize payloads', () => {
    const sim = new TestSimulator();
    const emitted = [];
    sim.setEventBus({
      emit: (event, payload) => emitted.push({ event, payload }),
    });

    sim.emitTransitionsChanged({ enabled: 'not-array', previouslyEnabled: 'old' });
    sim.emitTransitionFired({ transitionId: 't1', newPetriNet: { id: 1 } });
    sim.emitTransitionFired({}); // ignored

    expect(emitted).toEqual([
      {
        event: SimulationEvents.transitionsChanged,
        payload: { enabled: [], previouslyEnabled: [], hasEnabled: false },
      },
      {
        event: SimulationEvents.transitionFired,
        payload: { transitionId: 't1', newPetriNet: { id: 1 } },
      },
    ]);
  });

  test('reset clears state and delegates to subclass resetSpecific', async () => {
    const sim = new TestSimulator();
    await sim.initialize(makeMinimalNet());
    sim.enabledList = ['t1'];
    sim.reset();

    expect(sim.isInitialized).toBe(false);
    expect(sim.petriNet).toBeNull();
    expect(sim.simulationMode).toBe('single');
    expect(sim.resetCalls).toBe(1);
  });

  test('getSimulationStats returns totals when initialized', async () => {
    const sim = new TestSimulator();
    expect(sim.getSimulationStats()).toEqual({
      enabledTransitions: [],
      totalTokens: 0,
      totalPlaces: 0,
      totalTransitions: 0,
    });

    const net = {
      places: [{ id: 'p1', tokens: 2 }, { id: 'p2', tokens: 3 }],
      transitions: [{ id: 't1' }],
      arcs: [],
    };
    await sim.initialize(net);
    const stats = sim.getSimulationStats();
    expect(stats.totalTokens).toBe(5);
    expect(stats.totalPlaces).toBe(2);
    expect(stats.totalTransitions).toBe(1);
  });
});


