import React, { useEffect, useRef, useState } from 'react';
import { render, act } from '@testing-library/react';
import useSimulationManager from '../../features/simulation/useSimulationManager';
import { simulationEventBus, SimulationEvents } from '../../features/simulation/SimulationEventBus';

// Mock ConflictResolver to make maximal/run set selection deterministic
jest.mock('../../features/simulation/conflict-resolver.js', () => ({
  ConflictResolver: class {
    findNonConflictingTransitions(enabled) {
      // Return a single set containing all enabled, as simple deterministic behavior
      const arr = Array.isArray(enabled) ? enabled : [];
      return [arr];
    }
  },
}));

function baseElements() {
  return {
    places: [
      { id: 'p1', x: 0, y: 0, tokens: 1 },
      { id: 'p2', x: 100, y: 0, tokens: 0 },
    ],
    transitions: [ { id: 't1', x: 50, y: 0 } ],
    arcs: [
      { id: 'a1', source: 'p1', target: 't1' },
      { id: 'a2', source: 't1', target: 'p2' },
    ],
  };
}

function makeCore({ mode = 'single', enabledSeq, fireResult } = {}) {
  let callIdx = 0;
  let fired = false;
  const nextEnabled = () => {
    if (enabledSeq) {
      return enabledSeq[Math.min(callIdx++, enabledSeq.length - 1)];
    }
    if (fired) return [];
    return mode === 'maximal' ? [{ id: 't1' }] : ['t1'];
  };
  const core = {
    setEventBus: jest.fn(),
    isReady: jest.fn(async () => true),
    initialize: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getEnabledTransitions: jest.fn(async () => nextEnabled()),
    getSimulatorType: jest.fn(() => 'z3'),
    getSimulationMode: jest.fn(() => mode),
    activateSimulation: jest.fn(async () => {}),
    deactivateSimulation: jest.fn(async () => {}),
    fireTransition: jest.fn(async () => { fired = true; return fireResult || baseElements(); }),
  };
  return core;
}

function Harness({ injectedSimCore, netMode = 'pt', outRef }) {
  const [elements, setElements] = useState(baseElements());
  const history = useRef([]);
  const updateHistory = (st) => { history.current.push(st); };
  const mgr = useSimulationManager(elements, setElements, updateHistory, netMode, injectedSimCore);
  useEffect(() => { if (outRef) outRef.current = { elements, setElements, history, mgr }; }, [elements, mgr]);
  return <div data-testid="h" />;
}

describe('useSimulationManager flows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test('stepSimulation (single) picks an enabled transition and fires it', async () => {
    const after = baseElements();
    after.places = after.places.map(p => (p.id === 'p1' ? { ...p, tokens: 0 } : p.id === 'p2' ? { ...p, tokens: 1 } : p));
    const core = makeCore({ mode: 'single', enabledSeq: [['t1']], fireResult: after });
    const outRef = { current: null };

    await act(async () => { render(<Harness injectedSimCore={core} outRef={outRef} />); });
    await act(async () => { await outRef.current.mgr.stepSimulation(); });
    expect(core.getEnabledTransitions).toHaveBeenCalled();
    expect(core.fireTransition).toHaveBeenCalledWith('t1');
    expect(outRef.current.elements.places.find(p => p.id === 'p2')?.tokens).toBe(1);
    expect(outRef.current.history.current.length).toBeGreaterThan(0);
  });

  test('startContinuousSimulation runs then stops when no more enabled transitions', async () => {
    const after = baseElements();
    after.places = after.places.map(p => (p.id === 'p1' ? { ...p, tokens: 0 } : p.id === 'p2' ? { ...p, tokens: 1 } : p));
    // Use fired-gated mock: returns enabled until one fire occurs
    const core = makeCore({ mode: 'single', fireResult: after });
    const outRef = { current: null };

    await act(async () => { render(<Harness injectedSimCore={core} outRef={outRef} />); });

    await act(async () => { outRef.current.mgr.startContinuousSimulation(); });
    // allow state updates to flush
    await act(async () => { await Promise.resolve(); });

    // Observable effects instead of spying on core.fireTransition
    const p2 = outRef.current.elements.places.find(p => p.id === 'p2');
    expect(p2?.tokens).toBe(1);
    expect(outRef.current.history.current.length).toBeGreaterThan(0);
    expect(outRef.current.mgr.isContinuousSimulating).toBe(false);
  });

  test('startRunSimulation fires until no more enabled transitions', async () => {
    jest.useRealTimers();
    // Three ticks: two runs with t1 then stop
    const after = baseElements();
    after.places = after.places.map(p => (p.id === 'p1' ? { ...p, tokens: 0 } : p.id === 'p2' ? { ...p, tokens: 1 } : p));
    const core = makeCore({ mode: 'maximal', fireResult: after });
    const outRef = { current: null };

    await act(async () => { render(<Harness injectedSimCore={core} outRef={outRef} />); });
    await act(async () => { await outRef.current.mgr.startRunSimulation(); });
    // allow a couple of runStep cycles
    await act(async () => { await new Promise(res => setTimeout(res, 180)); });

    const p2 = outRef.current.elements.places.find(p => p.id === 'p2');
    expect(p2?.tokens).toBe(1);
    expect(outRef.current.history.current.length).toBeGreaterThan(0);
    expect(outRef.current.mgr.isRunning).toBe(false);
  });

  test('event bus updates enabled transitions and applies transitionFired new net', async () => {
    const outRef = { current: null };
    const core = makeCore({});
    await act(async () => { render(<Harness injectedSimCore={core} outRef={outRef} />); });
    await act(async () => { await Promise.resolve(); });

    // transitionsChanged
    await act(async () => {
      simulationEventBus.emit(SimulationEvents.transitionsChanged, { enabled: ['t1', 't2'], hasEnabled: true });
    });
    expect(outRef.current.mgr.enabledTransitionIds).toEqual(['t1', 't2']);
    expect(outRef.current.mgr.isSimulatorReady).toBe(true);

    // transitionFired updates elements and history
    const after = baseElements();
    after.places = after.places.map(p => (p.id === 'p1' ? { ...p, tokens: 0 } : p.id === 'p2' ? { ...p, tokens: 1 } : p));
    await act(async () => {
      simulationEventBus.emit(SimulationEvents.transitionFired, { transitionId: 't1', newPetriNet: after });
    });
    expect(outRef.current.elements.places.find(p => p.id === 'p2')?.tokens).toBe(1);
    expect(outRef.current.history.current.length).toBeGreaterThan(0);
  });
});


