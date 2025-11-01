import React, { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import useSimulationManager from '../../features/simulation/useSimulationManager';

function makeElements() {
  return {
    places: [ { id: 'p1' }, { id: 'p2' } ],
    transitions: [ { id: 't1' }, { id: 't2' } ],
    arcs: [ { id: 'a1', source: 'p1', target: 't1' }, { id: 'a2', source: 't1', target: 'p2' } ],
  };
}

const defaultSettings = {
  maxIterations: 100,
  limitIterations: false,
  batchMode: false,
  useNonVisualRun: false,
};

function wrapperWithElements(initial) {
  return function Wrapper({ children }) {
    const [elements, setElements] = useState(initial);
    const updateHistory = jest.fn();
    const netMode = 'pt';
    // expose context to hook via props
    return (
      <HookBridge elements={elements} setElements={setElements} updateHistory={updateHistory} netMode={netMode}>
        {children}
      </HookBridge>
    );
  };
}

function HookBridge({ elements, setElements, updateHistory, netMode, children }) {
  // This component exists solely to provide stable props to the hook during renderHook
  return <div data-el={JSON.stringify({ elements, netMode })}>{children}</div>;
}

// Minimal event bus shim (the hook imports the real bus, but our core will call it)
jest.mock('../../features/simulation/SimulationEventBus.js', () => {
  const listeners = new Map();
  const on = (evt, cb) => { const arr = listeners.get(evt) || []; listeners.set(evt, [...arr, cb]); };
  const off = (evt, cb) => { const arr = listeners.get(evt) || []; listeners.set(evt, arr.filter(f => f !== cb)); };
  const emit = (evt, payload) => { (listeners.get(evt) || []).forEach(f => f(payload)); };
  return {
    simulationEventBus: { on, off, emit },
    SimulationEvents: { transitionsChanged: 'transitionsChanged', transitionFired: 'transitionFired' },
  };
});

describe('useSimulationManager with DI core', () => {
  function makeMockCore({ enabled = ['t1'], type = 'mock', mode = 'single' } = {}) {
    const state = {
      ready: false,
      enabled: Array.isArray(enabled) ? enabled.slice() : enabled,
    };
    const core = {
      lastFired: null,
      activated: false,
      getSimulatorType: () => type,
      isReady: async () => state.ready,
      initialize: async () => { state.ready = true; },
      update: async () => {},
      getEnabledTransitions: async () => state.enabled,
      fireTransition: async (id) => { core.lastFired = id; state.enabled = []; return makeElements(); },
      activateSimulation: async () => { core.activated = true; },
      deactivateSimulation: () => { core.activated = false; },
      setEventBus: () => {},
      getSimulationMode: () => mode,
    };
    return core;
  }

  test('initializes, refreshes enabled, and fires a specific transition', async () => {
    const core = makeMockCore({ enabled: ['t1'] });

    const initial = makeElements();
    const { result, rerender } = renderHook(({ els }) => {
      const [elements, setElements] = useState(els);
      const updateHistory = jest.fn();
      return useSimulationManager(elements, setElements, updateHistory, 'pt', defaultSettings, core);
    }, { initialProps: { els: initial } });

    // Allow effects to run
    await act(async () => {});
    expect(result.current.isSimulatorReady).toBe(true);
    expect(result.current.enabledTransitionIds).toEqual(['t1']);

    await act(async () => {
      await result.current.handleFireTransition('t1');
    });
    expect(core.lastFired).toBe('t1');
  });

  test('stepSimulation picks an enabled transition and fires', async () => {
    const core = makeMockCore({ enabled: ['t1', 't2'] });
    const initial = makeElements();
    const { result } = renderHook(() => {
      const [elements, setElements] = useState(initial);
      const updateHistory = jest.fn();
      return useSimulationManager(elements, setElements, updateHistory, 'pt', defaultSettings, core);
    });

    await act(async () => {});
    expect(result.current.enabledTransitionIds.length).toBeGreaterThan(0);
    await act(async () => {
      await result.current.stepSimulation();
    });
    expect(core.lastFired === 't1' || core.lastFired === 't2').toBe(true);
  });

  test('startContinuousSimulation activates and runs at least one step', async () => {
    const core = makeMockCore({ enabled: ['t1'] });
    const initial = makeElements();
    const { result } = renderHook(() => {
      const [elements, setElements] = useState(initial);
      const updateHistory = jest.fn();
      return useSimulationManager(elements, setElements, updateHistory, 'pt', defaultSettings, core);
    });

    await act(async () => {});
    await act(async () => {
      await result.current.startContinuousSimulation();
    });
    // should deactivate by the end
    expect(core.activated).toBe(false);
  });

  test('startRunSimulation activates and schedules steps', async () => {
    const core = makeMockCore({ enabled: ['t1'] });
    const initial = makeElements();
    const { result } = renderHook(() => {
      const [elements, setElements] = useState(initial);
      const updateHistory = jest.fn();
      return useSimulationManager(elements, setElements, updateHistory, 'pt', defaultSettings, core);
    });

    await act(async () => {});
    await act(async () => {
      await result.current.startRunSimulation();
    });
    // allow scheduled runStep to proceed
    await act(async () => { await new Promise(r => setTimeout(r, 80)); });
    // run should have deactivated only after completion; at this point the next tick may still be active or finished, assert lastFired set
    expect(core.lastFired).toBe('t1');
  });
});


