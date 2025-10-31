import { SimulatorFactory } from '../../features/simulation/SimulatorFactory';
import { SimulatorCore } from '../../features/simulation/simulator-core';

class StubSimulator {
  constructor(type) {
    this.type = type;
    this.petriNet = null;
    this.isReady = jest.fn(() => true);
    this.initialize = jest.fn(async (net) => {
      this.petriNet = JSON.parse(JSON.stringify(net));
    });
    this.update = jest.fn(async (net) => {
      this.petriNet = JSON.parse(JSON.stringify(net));
    });
    this.getEnabledTransitions = jest.fn(async () => []);
    this.fireTransition = jest.fn(async (id) => {
      (this.fired || (this.fired = [])).push(id);
      return this.petriNet;
    });
    this.reset = jest.fn();
    this.setEventBus = jest.fn();
    this.simulationMode = 'single';
    this.setSimulationMode = jest.fn((mode) => { this.simulationMode = mode; });
  }

  getType() {
    return this.type;
  }
}

describe('SimulatorCore', () => {
  let createSpy;

  beforeEach(() => {
    createSpy = jest.spyOn(SimulatorFactory, 'createSimulator').mockImplementation((mode) => new StubSimulator(mode));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const baseNet = {
    netMode: 'pt',
    places: [{ id: 'p1', tokens: 1, x: 0, y: 0 }],
    transitions: [{ id: 't1', x: 0, y: 0 }],
    arcs: [{ id: 'a1', sourceId: 'p1', targetId: 't1', weight: 1 }],
  };

  test('initializes simulator with configured mode', async () => {
    const core = new SimulatorCore();
    await core.initialize(baseNet, { netMode: 'pt' });

    expect(createSpy).toHaveBeenCalledWith('pt');
    expect(core.getSimulatorType()).toBe('pt');
    expect(await core.isReady()).toBe(true);
    const status = core.getSimulatorStatus();
    expect(status.netMode).toBe('pt');
    expect(status.isReady).toBe(true);
  });

  test('determineNetMode falls back to algebraic when guards present', () => {
    const core = new SimulatorCore();
    const mode = core.determineNetMode({
      places: [],
      transitions: [{ id: 't1', guard: 'x > 0' }],
      arcs: [],
    }, {});
    expect(mode).toBe('algebraic');
  });

  test('update delegates to underlying simulator', async () => {
    const core = new SimulatorCore();
    await core.initialize(baseNet, { netMode: 'pt' });
    const sim = core.currentSimulator;
    const updated = { ...baseNet, places: [{ id: 'p1', tokens: 2, x: 0, y: 0 }] };
    await core.update(updated);
    expect(sim.update).toHaveBeenCalledWith(updated);
    expect(sim.petriNet.places[0].tokens).toBe(2);
  });

  test('stepSimulation returns current state when no transitions enabled', async () => {
    const core = new SimulatorCore();
    await core.initialize(baseNet, { netMode: 'pt' });
    const result = await core.stepSimulation();
    expect(result).toEqual(baseNet);
  });

  test('runToCompletion fires enabled transitions until exhausted', async () => {
    const core = new SimulatorCore();
    await core.initialize(baseNet, { netMode: 'pt' });
    const sim = core.currentSimulator;
    sim.getEnabledTransitions
      .mockResolvedValueOnce(['t1'])
      .mockResolvedValue([]);
    const final = await core.runToCompletion({ maxSteps: 5 });
    expect(sim.fireTransition).toHaveBeenCalledWith('t1');
    expect(final).toEqual(core.currentSimulator.petriNet);
  });

  test('reset clears simulator reference', async () => {
    const core = new SimulatorCore();
    await core.initialize(baseNet, { netMode: 'pt' });
    const sim = core.currentSimulator;
    core.reset();
    expect(sim.reset).toHaveBeenCalled();
    expect(core.getSimulatorType()).toBe('none');
  });

  test('reuses simulator when mode unchanged and queues listeners before initialization', async () => {
    const core = new SimulatorCore();
    const eventBus = { on: jest.fn(), emit: jest.fn() };
    core.__queueListener('transitionsChanged', eventBus.emit);
    core.setEventBus(eventBus);

    await core.initialize(baseNet, { netMode: 'pt' });
    const firstSimulator = core.currentSimulator;
    expect(eventBus.on).toHaveBeenCalledWith('transitionsChanged', eventBus.emit);
    eventBus.on.mockClear();
    createSpy.mockClear();

    await core.initialize(baseNet, { netMode: 'pt' });
    expect(createSpy).not.toHaveBeenCalled();
    expect(core.currentSimulator).toBe(firstSimulator);
  });

  test('determineNetMode covers algebraic-int alias, bindings, and valueTokens', () => {
    const core = new SimulatorCore();

    const aliasMode = core.determineNetMode({ netMode: 'algebraic-int' }, {});
    expect(aliasMode).toBe('algebraic');

    const bindingMode = core.determineNetMode({
      places: [],
      transitions: [],
      arcs: [{ bindings: ['x:integer'] }],
    }, {});
    expect(bindingMode).toBe('algebraic');

    const valueTokensMode = core.determineNetMode({
      places: [{ valueTokens: [1] }],
      transitions: [],
      arcs: [],
    }, {});
    expect(valueTokensMode).toBe('algebraic');

    const defaultMode = core.determineNetMode({ places: [], transitions: [], arcs: [] }, {});
    expect(defaultMode).toBe('pt');
  });

  test('getEnabledTransitions and fireTransition handle error scenarios gracefully', async () => {
    const core = new SimulatorCore();
    await core.initialize(baseNet, { netMode: 'pt' });
    const sim = core.currentSimulator;
    sim.getEnabledTransitions.mockRejectedValueOnce(new Error('boom'));
    const enabled = await core.getEnabledTransitions();
    expect(enabled).toEqual([]);

    sim.fireTransition.mockRejectedValueOnce(new Error('boom'));
    await expect(core.fireTransition('t1')).rejects.toThrow('boom');

    core.reset();
    await expect(core.fireTransition('t1')).rejects.toThrow('Simulator not initialized');
  });

  test('activateSimulation throws when simulator missing and logs when present', async () => {
    const core = new SimulatorCore();
    await expect(() => core.activateSimulation()).toThrow('Simulator not initialized');

    await core.initialize(baseNet, { netMode: 'pt' });
    expect(() => core.activateSimulation(true)).not.toThrow();
  });

  test('runToCompletion in maximal mode reports progress, honors cancel, and restores event bus', async () => {
    const core = new SimulatorCore();
    await core.initialize(baseNet, { netMode: 'pt' });
    const sim = core.currentSimulator;
    sim.petriNet = {
      ...baseNet,
      arcs: [
        { sourceId: 'p1', targetId: 't1', type: 'place-to-transition' },
        { sourceId: 'p2', targetId: 't2', type: 'place-to-transition' },
      ],
    };

    const enabledSequences = [
      ['t1', 't2'],
      ['t2'],
      [],
    ];
    sim.getEnabledTransitions.mockImplementation(async () => enabledSequences.shift() || []);
    sim.fireTransition.mockImplementation(async (id) => {
      (sim.steps || (sim.steps = [])).push(id);
      return sim.petriNet;
    });

    const onProgress = jest.fn();
    let cancelCalls = 0;
    const shouldCancel = jest.fn(() => {
      cancelCalls += 1;
      return cancelCalls > 5;
    });

    let tick = 0;
    const nowSpy = global.performance ? jest.spyOn(global.performance, 'now').mockImplementation(() => (tick += 5)) : null;

    const originalRandom = Math.random;
    Math.random = () => 0; // deterministic batching

    const originalSetTimeout = global.setTimeout;
    global.setTimeout = (cb) => { cb?.(); return 0; };

    const originalRAF = global.requestAnimationFrame;
    global.requestAnimationFrame = (cb) => { cb?.(); return 0; };

    try {
      const result = await core.runToCompletion({
        mode: 'maximal',
        batchMax: 2,
        maxSteps: 10,
        yieldEvery: 1,
        progressEveryMs: 5,
        yieldEveryMs: 5,
        shouldCancel,
        onProgress,
      });

      expect(result).toEqual(sim.petriNet);
      expect(sim.fireTransition).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalled();
      expect(shouldCancel).toHaveBeenCalled();
    } finally {
      nowSpy?.mockRestore();
      Math.random = originalRandom;
      global.setTimeout = originalSetTimeout;
      global.requestAnimationFrame = originalRAF;
    }
  });

  test('runToCompletion restores event bus even when firing fails', async () => {
    const core = new SimulatorCore();
    await core.initialize(baseNet, { netMode: 'pt' });
    const sim = core.currentSimulator;
    const prevBus = { emitted: false };
    sim.setEventBus.mockImplementation((bus) => { sim.eventBus = bus; });
    sim.setEventBus(prevBus);
    sim.setEventBus.mockClear();
    sim.getEnabledTransitions.mockResolvedValue(['t1']);
    sim.fireTransition.mockRejectedValue(new Error('fail'));

    await expect(core.runToCompletion({ maxSteps: 1 })).rejects.toThrow('fail');
    const calls = sim.setEventBus.mock.calls;
    expect(calls[0][0]).toBe(null);
    expect(calls[calls.length - 1][0]).toBe(prevBus);
  });
});



