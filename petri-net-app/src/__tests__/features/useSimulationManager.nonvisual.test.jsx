import React, { useEffect, useRef, useState } from 'react';
import { render, act, cleanup } from '@testing-library/react';
import useSimulationManager from '../../features/simulation/useSimulationManager';

jest.mock('../../workers/worker-factory', () => ({
  createSimulationWorker: jest.fn(),
}));

jest.mock('../../features/simulation/simulation-utils.js', () => {
  const actual = jest.requireActual('../../features/simulation/simulation-utils.js');
  return {
    ...actual,
    getSimulationStats: jest.fn(() => ({ enabledTransitions: [] })),
  };
});

jest.mock('../../utils/z3-remote', () => ({
  setZ3WorkerConfig: jest.fn(),
}));

const { createSimulationWorker } = jest.requireMock('../../workers/worker-factory');
const { getSimulationStats } = jest.requireMock('../../features/simulation/simulation-utils.js');
const { setZ3WorkerConfig } = jest.requireMock('../../utils/z3-remote');

function makeBaseNet() {
  return {
    places: [{ id: 'p1', tokens: 1, valueTokens: [1] }],
    transitions: [{ id: 't1' }],
    arcs: [{ id: 'a1', source: 'p1', target: 't1' }],
    netMode: 'algebraic-int',
  };
}

function createHarness({ simCore, netMode = 'algebraic-int', initialElements, outRef }) {
  function Harness() {
    const [elements, setElements] = useState(initialElements || makeBaseNet());
    const history = useRef([]);
    const updateHistoryRef = useRef(jest.fn((state) => { history.current.push(state); }));
    const manager = useSimulationManager(
      elements,
      setElements,
      updateHistoryRef.current,
      netMode,
      simCore
    );

    useEffect(() => {
      if (outRef) {
        outRef.current = {
          elements,
          setElements,
          history,
          manager,
          updateHistory: updateHistoryRef.current,
        };
      }
    }, [elements, manager]);

    return <div data-testid="harness" />;
  }

  return Harness;
}

class MockWorker {
  constructor() {
    this.listeners = new Map();
    this.messages = [];
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  removeEventListener(type, handler) {
    const current = this.listeners.get(type);
    if (current && current === handler) {
      this.listeners.delete(type);
    }
  }

  postMessage(payload) {
    this.messages.push(payload);
  }

  emit(type, data) {
    const handler = this.listeners.get(type);
    if (handler) {
      handler({ data });
    }
  }
}

function makeSimCore(overrides = {}) {
  const sequence = overrides.enabledSequence || [['t1']];
  let callIndex = 0;
  const core = {
    setEventBus: jest.fn(),
    isReady: jest.fn(async () => true),
    initialize: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getEnabledTransitions: jest
      .fn(async () => sequence[Math.min(callIndex++, sequence.length - 1)] || []),
    getSimulatorType: jest.fn(() => 'z3'),
    getSimulationMode: jest.fn(() => 'single'),
    activateSimulation: jest.fn(async () => {}),
    deactivateSimulation: jest.fn(async () => {}),
    fireTransition: jest.fn(async () => makeBaseNet()),
    runToCompletion: jest.fn(async () => makeBaseNet()),
    ...overrides,
  };
  return core;
}

describe('useSimulationManager non-visual & error paths', () => {
  const originalConsoleError = console.error;
  const originalSettings = {};

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    originalSettings.nonVisual = window.__PETRI_NET_NON_VISUAL_RUN__;
    originalSettings.settings = window.__PETRI_NET_SETTINGS__;
    originalSettings.z3 = window.__Z3_SETTINGS__;
    createSimulationWorker.mockReset();
    getSimulationStats.mockReturnValue({ enabledTransitions: [] });
  });

  afterEach(() => {
    cleanup();
    console.error = originalConsoleError;
    if (originalSettings.nonVisual === undefined) {
      delete window.__PETRI_NET_NON_VISUAL_RUN__;
    } else {
      window.__PETRI_NET_NON_VISUAL_RUN__ = originalSettings.nonVisual;
    }
    if (originalSettings.settings === undefined) {
      delete window.__PETRI_NET_SETTINGS__;
    } else {
      window.__PETRI_NET_SETTINGS__ = originalSettings.settings;
    }
    if (originalSettings.z3 === undefined) {
      delete window.__Z3_SETTINGS__;
    } else {
      window.__Z3_SETTINGS__ = originalSettings.z3;
    }
  });

  test('falls back to getSimulationStats when simulator core reports not ready', async () => {
    getSimulationStats.mockReturnValueOnce({ enabledTransitions: ['stats-route'] });
    const simCore = makeSimCore({ isReady: jest.fn(async () => false) });
    const outRef = { current: null };
    const Harness = createHarness({ simCore, outRef });

    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {});

    expect(simCore.initialize).toHaveBeenCalled();
    expect(simCore.update).toHaveBeenCalled();
    expect(getSimulationStats).toHaveBeenCalledTimes(1);
    expect(outRef.current.manager.enabledTransitionIds).toEqual(['stats-route']);
    expect(outRef.current.manager.isSimulatorReady).toBe(true);
  });

  test('non-visual run uses runToCompletion when worker run disabled', async () => {
    window.__PETRI_NET_NON_VISUAL_RUN__ = true;
    window.__PETRI_NET_SETTINGS__ = { useWorkerRun: false };
    const finalNet = {
      ...makeBaseNet(),
      places: [{ id: 'p1', tokens: 0, valueTokens: [] }],
    };
    let callIndex = 0;
    const simCore = makeSimCore({
      runToCompletion: jest.fn(async () => finalNet),
      getEnabledTransitions: jest
        .fn(async () => (callIndex++ === 0 ? ['t1'] : [])),
    });
    const outRef = { current: null };
    const Harness = createHarness({ simCore, outRef });

    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      await outRef.current.manager.startRunSimulation();
    });
    await act(async () => {});

    expect(simCore.runToCompletion).toHaveBeenCalledTimes(1);
    expect(setZ3WorkerConfig).toHaveBeenCalled();
    expect(outRef.current.elements.places[0].tokens).toBe(0);
    expect(outRef.current.manager.isRunning).toBe(false);
  });

  test('worker run handles progress and completion events', async () => {
    const worker = new MockWorker();
    createSimulationWorker.mockReturnValue(worker);
    window.__PETRI_NET_NON_VISUAL_RUN__ = true;
    window.__PETRI_NET_SETTINGS__ = { useWorkerRun: true, prewarmSimulationWorker: true };
    window.__Z3_SETTINGS__ = { minWorkers: 1, maxWorkers: 2 };

    const finalNet = {
      ...makeBaseNet(),
      places: [{ id: 'p1', tokens: 0, valueTokens: [] }],
    };

    let callIndex = 0;
    const simCore = makeSimCore({
      getSimulationMode: jest.fn(() => 'maximal'),
      getEnabledTransitions: jest
        .fn(async () => (callIndex++ === 0 ? ['t1'] : [])),
    });
    const outRef = { current: null };
    const Harness = createHarness({ simCore, outRef });

    await act(async () => {
      render(<Harness />);
    });

    await act(async () => {
      await outRef.current.manager.startRunSimulation();
    });

    expect(worker.messages.some((m) => m?.op === 'prewarm')).toBe(true);
    const startMessage = worker.messages.find((m) => m?.op === 'start');
    expect(startMessage).toBeTruthy();
    expect(startMessage.payload.run.batchMax).toBe(64);

    await act(async () => {
      worker.emit('message', { op: 'progress', payload: { percent: 0.5 } });
    });
    expect(window.__PETRI_NET_RUN_PROGRESS__).toEqual({ percent: 0.5 });

    await act(async () => {
      worker.emit('message', { op: 'done', payload: { elements: finalNet } });
    });
    await act(async () => {});

    expect(outRef.current.elements.places[0].tokens).toBe(0);
    expect(outRef.current.history.current.length).toBeGreaterThan(0);
    expect(outRef.current.manager.isRunning).toBe(false);
    expect(simCore.deactivateSimulation).toHaveBeenCalled();
  });

  test('handleFireTransition reports errors for invalid simulator state', async () => {
    const simCore = makeSimCore({
      getSimulatorType: jest.fn(() => 'none'),
    });
    const outRef = { current: null };
    const Harness = createHarness({ simCore, outRef });

    await act(async () => {
      render(<Harness />);
    });

    await act(async () => {
      await outRef.current.manager.handleFireTransition('t1');
    });

    expect(outRef.current.manager.simulationError).toMatch('Simulator not initialized');

    simCore.getSimulatorType.mockReturnValue('z3');
    simCore.fireTransition = jest.fn(async () => ({}));

    await act(async () => {
      await outRef.current.manager.handleFireTransition('t1');
    });

    expect(outRef.current.manager.simulationError).toBe('Incomplete Petri net structure returned from simulator');
  });

  test('stopAllSimulations cancels worker and clears simulation flags', async () => {
    const worker = new MockWorker();
    createSimulationWorker.mockReturnValue(worker);
    window.__PETRI_NET_NON_VISUAL_RUN__ = true;
    window.__PETRI_NET_SETTINGS__ = { useWorkerRun: true };

    let callIndex = 0;
    const simCore = makeSimCore({
      getEnabledTransitions: jest.fn(async () => (callIndex++ === 0 ? ['t1'] : [])),
    });
    const outRef = { current: null };
    const Harness = createHarness({ simCore, outRef });

    await act(async () => {
      render(<Harness />);
    });
    await act(async () => {
      await outRef.current.manager.startRunSimulation();
    });

    await act(async () => {
      outRef.current.manager.stopAllSimulations();
    });

    expect(worker.messages.some((m) => m?.op === 'cancel')).toBe(true);
    expect(outRef.current.manager.isContinuousSimulating).toBe(false);
    expect(outRef.current.manager.isRunning).toBe(false);
  });

  test('startRunSimulation iterates run loop in visual mode', async () => {
    jest.useFakeTimers();
    window.__PETRI_NET_NON_VISUAL_RUN__ = false;
    window.__PETRI_NET_SETTINGS__ = { useWorkerRun: false };

    const simCore = makeSimCore({
      enabledSequence: [['t1'], ['t1'], []],
      fireTransition: jest.fn(async () => makeBaseNet()),
    });

    const outRef = { current: null };
    const Harness = createHarness({ simCore, outRef });

    await act(async () => {
      render(<Harness />);
    });

    try {
      await act(async () => {
        await outRef.current.manager.startRunSimulation();
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(50);
        await Promise.resolve();
        await Promise.resolve();
      });

      await act(async () => {
        jest.advanceTimersByTime(50);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(simCore.getEnabledTransitions).toHaveBeenCalledTimes(4);
      expect(outRef.current.manager.isRunning).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  test('startContinuousSimulation reports errors from simulator core', async () => {
    const simCore = makeSimCore({
      activateSimulation: jest.fn(async () => { throw new Error('boom'); }),
    });
    const outRef = { current: null };
    const Harness = createHarness({ simCore, outRef });

    await act(async () => {
      render(<Harness />);
    });

    await act(async () => {
      await outRef.current.manager.startContinuousSimulation();
    });

    expect(outRef.current.manager.simulationError).toBe('Failed to start continuous simulation');
  });

  test('stepSimulation surfaces errors from simulator core', async () => {
    const simCore = makeSimCore({
      getEnabledTransitions: jest.fn(async () => { throw new Error('step fail'); }),
    });
    const outRef = { current: null };
    const Harness = createHarness({ simCore, outRef });

    await act(async () => {
      render(<Harness />);
    });

    await act(async () => {
      await outRef.current.manager.stepSimulation();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error in step simulation'), expect.any(Error));
  });
});


