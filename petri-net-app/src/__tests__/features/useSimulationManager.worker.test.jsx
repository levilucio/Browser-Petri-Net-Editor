import React, { useEffect, useRef, useState } from 'react';
import { render, act } from '@testing-library/react';
import useSimulationManager from '../../features/simulation/useSimulationManager';

jest.mock('../../workers/worker-factory', () => ({
  createSimulationWorker: jest.fn(),
}));

jest.mock('../../utils/z3-remote', () => ({
  setZ3WorkerConfig: jest.fn(),
}));

jest.mock('../../features/simulation/simulation-utils.js', () => {
  const actual = jest.requireActual('../../features/simulation/simulation-utils.js');
  return {
    ...actual,
    getSimulationStats: jest.fn(() => ({
      enabledTransitions: [],
    })),
  };
});

jest.mock('../../features/simulation/conflict-resolver.js', () => ({
  ConflictResolver: class {
    findNonConflictingTransitions(enabled) {
      const arr = Array.isArray(enabled) ? enabled : [];
      return [arr];
    }
  },
}));

const { createSimulationWorker } = require('../../workers/worker-factory');
const { setZ3WorkerConfig } = require('../../utils/z3-remote');
const { getSimulationStats } = require('../../features/simulation/simulation-utils.js');

const defaultSettings = {
  maxIterations: 100,
  limitIterations: false,
  batchMode: false,
  useNonVisualRun: false,
};

function baseElements() {
  return {
    places: [
      { id: 'p1', tokens: 1 },
      { id: 'p2', tokens: 0 },
    ],
    transitions: [
      { id: 't1' },
    ],
    arcs: [
      { id: 'a1', source: 'p1', sourceId: 'p1', target: 't1', targetId: 't1', weight: 1 },
      { id: 'a2', source: 't1', sourceId: 't1', target: 'p2', targetId: 'p2', weight: 1 },
    ],
  };
}

function makeCore(overrides = {}) {
  const enabledSequence = Array.isArray(overrides.enabledSequence) ? overrides.enabledSequence.map((entry) => entry.slice ? entry.slice() : entry) : null;
  const core = {
    setEventBus: jest.fn(),
    isReady: jest.fn(async () => (overrides.isReadyValue !== undefined ? overrides.isReadyValue : true)),
    initialize: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getEnabledTransitions: jest.fn(async () => {
      if (enabledSequence && enabledSequence.length > 0) {
        const next = enabledSequence.shift();
        return Array.isArray(next) ? next : [];
      }
      const base = overrides.enabled ?? ['t1'];
      return Array.isArray(base) ? base.slice() : base;
    }),
    getSimulatorType: jest.fn(() => overrides.type || 'mock'),
    getSimulationMode: jest.fn(() => overrides.mode || 'single'),
    activateSimulation: jest.fn(async () => {}),
    deactivateSimulation: jest.fn(async () => {}),
    fireTransition: jest.fn(async () => overrides.fireResult || baseElements()),
    runToCompletion: overrides.runToCompletion,
  };
  return Object.assign(core, overrides);
}

function Harness({ core, netMode = 'algebraic', outRef, settings }) {
  const [elements, setElements] = useState(baseElements());
  const history = useRef([]);
  const mergedSettings = { ...defaultSettings, ...(settings || {}) };
  const manager = useSimulationManager(
    elements,
    setElements,
    (net) => { history.current.push(net); },
    netMode,
    mergedSettings,
    core
  );

  useEffect(() => {
    outRef.current = { elements, setElements, history, manager };
  }, [elements, manager]);

  return <div data-testid="simulation-manager-harness" />;
}

function attachWorkerHandlers(worker) {
  const handlers = new Set();
  worker.addEventListener.mockImplementation((event, handler) => {
    if (event === 'message') handlers.add(handler);
  });
  worker.removeEventListener.mockImplementation((event, handler) => {
    if (event === 'message') handlers.delete(handler);
  });
  return handlers;
}

describe('useSimulationManager worker and non-visual runs', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    createSimulationWorker.mockReset();
    setZ3WorkerConfig.mockReset();
    getSimulationStats.mockReturnValue({ enabledTransitions: [] });
    delete window.__PETRI_NET_NON_VISUAL_RUN__;
    delete window.__PETRI_NET_SETTINGS__;
    delete window.__PETRI_NET_RUN_PROGRESS__;
    delete window.__PETRI_NET_CANCEL_RUN__;
    delete window.__Z3_SETTINGS__;
  });

  test('startRunSimulation uses worker path and processes completion', async () => {
    jest.useFakeTimers();
    const worker = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn(),
    };
    const handlers = attachWorkerHandlers(worker);
    createSimulationWorker.mockReturnValue(worker);

    const doneNet = baseElements();
    doneNet.places = doneNet.places.map((place) => (place.id === 'p2' ? { ...place, tokens: 1 } : { ...place, tokens: 0 }));

    worker.postMessage.mockImplementation((message) => {
      if (message?.op === 'start') {
        setTimeout(() => {
          handlers.forEach((fn) => fn({ data: { op: 'progress', payload: { steps: 5 } } }));
          handlers.forEach((fn) => fn({ data: { op: 'done', payload: { elements: doneNet } } }));
        }, 0);
      }
    });

    window.__PETRI_NET_NON_VISUAL_RUN__ = false;
    window.__PETRI_NET_SETTINGS__ = { batchMode: true, limitIterations: false, maxIterations: 100 };

    const core = makeCore({ enabledSequence: [['t1'], []] });
    const outRef = { current: null };

    await act(async () => {
      render(<Harness core={core} outRef={outRef} settings={{ batchMode: true }} />);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await outRef.current.manager.startRunSimulation();
    });

    await act(async () => {
      jest.runAllTimers();
    });
    await act(async () => { await Promise.resolve(); });

    expect(createSimulationWorker).toHaveBeenCalledTimes(1);
    expect(worker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ op: 'start' }));
    const startCall = worker.postMessage.mock.calls.find(([message]) => message?.op === 'start');
    expect(startCall?.[0]?.payload?.run?.maxSteps).toBe(200000);
    expect(outRef.current.elements.places.find((p) => p.id === 'p2')?.tokens).toBe(1);
    expect(outRef.current.manager.isRunning).toBe(false);
    expect(outRef.current.manager.simulationError).toBe(null);
    expect(core.deactivateSimulation).toHaveBeenCalled();
    expect(setZ3WorkerConfig).toHaveBeenCalled();
    const firstCall = setZ3WorkerConfig.mock.calls[0]?.[0] || {};
    expect(firstCall.poolSize).toBe(8);

    await act(async () => {
      outRef.current.manager.stopAllSimulations();
    });
    expect(worker.postMessage).toHaveBeenCalledWith({ op: 'cancel' });
  });

  test('startRunSimulation surfaces worker errors and stops running state', async () => {
    jest.useFakeTimers();
    const worker = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      postMessage: jest.fn(),
    };
    const handlers = attachWorkerHandlers(worker);
    createSimulationWorker.mockReturnValue(worker);

    worker.postMessage.mockImplementation((message) => {
      if (message?.op === 'start') {
        setTimeout(() => {
          handlers.forEach((fn) => fn({ data: { op: 'error', payload: { message: 'worker failed' } } }));
        }, 0);
      }
    });

    window.__PETRI_NET_NON_VISUAL_RUN__ = false;
    window.__PETRI_NET_SETTINGS__ = { batchMode: true, limitIterations: false, maxIterations: 100 };

    const core = makeCore({ enabledSequence: [['t1'], []] });
    const outRef = { current: null };

    await act(async () => {
      render(<Harness core={core} outRef={outRef} settings={{ batchMode: true }} />);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await outRef.current.manager.startRunSimulation();
    });

    await act(async () => {
      jest.runAllTimers();
    });
    await act(async () => { await Promise.resolve(); });

    expect(outRef.current.manager.simulationError).toBe('worker failed');
    expect(outRef.current.manager.isRunning).toBe(false);
    expect(core.deactivateSimulation).toHaveBeenCalled();
    expect(setZ3WorkerConfig).toHaveBeenCalled();
  });

  test('startRunSimulation falls back to runToCompletion when worker runs are disabled', async () => {
    jest.useFakeTimers();
    const doneNet = baseElements();
    doneNet.places = doneNet.places.map((place) => (place.id === 'p2' ? { ...place, tokens: 2 } : { ...place }));

    const runToCompletion = jest.fn(async ({ onProgress }) => {
      onProgress?.({ percent: 42 });
      return { petriNet: doneNet, steps: 1 };
    });

    window.__PETRI_NET_NON_VISUAL_RUN__ = true;
    window.__PETRI_NET_SETTINGS__ = { batchMode: false, limitIterations: false, maxIterations: 100 };
    window.__Z3_SETTINGS__ = { poolSize: 2 };

    const core = makeCore({ runToCompletion, enabledSequence: [['t1'], []] });
    const outRef = { current: null };

    await act(async () => {
      render(<Harness core={core} outRef={outRef} settings={{ useNonVisualRun: true }} />);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await outRef.current.manager.startRunSimulation();
    });

    await act(async () => {
      jest.runAllTimers();
    });
    await act(async () => { await Promise.resolve(); });

    expect(createSimulationWorker).not.toHaveBeenCalled();
    expect(runToCompletion).toHaveBeenCalled();
    expect(setZ3WorkerConfig).not.toHaveBeenCalled();
    expect(outRef.current.elements.places.find((p) => p.id === 'p2')?.tokens).toBe(2);
    expect(outRef.current.manager.isRunning).toBe(false);
    expect(outRef.current.manager.simulationError).toBe(null);
    // Progress communication removed for performance
    expect(window.__PETRI_NET_RUN_PROGRESS__).toBeUndefined();
    expect(core.deactivateSimulation).toHaveBeenCalled();
  });

  test('handleFireTransition surfaces structural errors from simulator', async () => {
    const invalidNet = { places: [], transitions: [] };
    const core = makeCore({
      fireTransition: jest.fn(async () => invalidNet),
      activateSimulation: jest.fn(async () => {}),
    });
    const outRef = { current: null };

    await act(async () => {
      render(<Harness core={core} outRef={outRef} />);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await outRef.current.manager.handleFireTransition('t1');
    });

    expect(core.activateSimulation).toHaveBeenCalledWith(false);
    expect(core.fireTransition).toHaveBeenCalledWith('t1');
    expect(outRef.current.manager.simulationError).toBe('Incomplete Petri net structure returned from simulator');
  });

  test('falls back to getSimulationStats when simulator core is not ready', async () => {
    const statsMock = getSimulationStats;
    statsMock.mockReturnValue({ enabledTransitions: ['fallback-transition'] });
    const core = makeCore({
      isReadyValue: false,
      getEnabledTransitions: jest.fn(async () => ['should-not-be-used']),
    });
    const outRef = { current: null };

    await act(async () => {
      render(<Harness core={core} outRef={outRef} />);
    });
    await act(async () => { await Promise.resolve(); });

    expect(core.getEnabledTransitions).not.toHaveBeenCalled();
    expect(outRef.current.manager.enabledTransitionIds).toEqual(['fallback-transition']);
    expect(outRef.current.manager.isSimulatorReady).toBe(true);
  });

  test('handles simulator update errors by clearing state and surfacing error', async () => {
    const core = makeCore({
      enabled: [],
      update: jest.fn(async () => { throw new Error('update boom'); }),
    });
    const outRef = { current: null };

    await act(async () => {
      render(<Harness core={core} outRef={outRef} />);
    });
    await act(async () => { await Promise.resolve(); });

    expect(core.update).toHaveBeenCalled();
    expect(outRef.current.manager.simulationError).toBe('Failed to update simulator');
    expect(outRef.current.manager.enabledTransitionIds).toEqual([]);
    expect(outRef.current.manager.isSimulatorReady).toBe(false);
  });

  test('handleFireTransition reports when simulator type is none', async () => {
    const core = makeCore({
      getSimulatorType: jest.fn(() => 'none'),
      activateSimulation: jest.fn(async () => {}),
    });
    const outRef = { current: null };

    await act(async () => {
      render(<Harness core={core} outRef={outRef} />);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await outRef.current.manager.handleFireTransition('t1');
    });

    expect(outRef.current.manager.simulationError).toMatch(/Simulator not initialized/);
  });

  test('stepSimulation handles maximal mode with object transitions', async () => {
    const enabledSequence = [
      [{ id: 't1' }, { id: 't2' }],
      [],
    ];
    const firedIds = [];
    const core = makeCore({
      mode: 'maximal',
      enabledSequence,
      fireTransition: jest.fn(async (id) => {
        firedIds.push(id);
        return baseElements();
      }),
    });
    const outRef = { current: null };

    await act(async () => {
      render(<Harness core={core} outRef={outRef} />);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await outRef.current.manager.stepSimulation();
    });

    expect(core.getSimulationMode).toHaveBeenCalled();
    expect(firedIds.length).toBeGreaterThan(0);
  });

  test('handleFireTransition applies updates when simulator returns valid net', async () => {
    const core = makeCore({
      fireTransition: jest.fn(async () => baseElements()),
    });
    const history = [];

    function HarnessWithHistory({ core: injectedCore, outRef }) {
      const [elements, setElements] = useState(baseElements());
      const updateHistory = (net) => { history.push(net); };
      const manager = useSimulationManager(
        elements,
        setElements,
        updateHistory,
        'algebraic',
        defaultSettings,
        injectedCore
      );
      useEffect(() => { outRef.current = { elements, manager }; }, [elements, manager]);
      return <div />;
    }

    const outRef = { current: null };
    await act(async () => {
      render(<HarnessWithHistory core={core} outRef={outRef} />);
    });
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await outRef.current.manager.handleFireTransition('t1');
    });

    expect(core.fireTransition).toHaveBeenCalledWith('t1');
    expect(history.length).toBeGreaterThan(0);
  });
});


