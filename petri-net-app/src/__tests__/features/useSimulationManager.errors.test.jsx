import React, { useRef, useState, useEffect } from 'react';
import { render, act } from '@testing-library/react';
import useSimulationManager from '../../features/simulation/useSimulationManager.js';

function createElements() {
  return {
    places: [{ id: 'p1', x: 0, y: 0 }],
    transitions: [{ id: 't1', x: 100, y: 0 }],
    arcs: [{ id: 'a1', source: 'p1', target: 't1' }],
  };
}

const defaultSettings = {
  maxIterations: 100,
  limitIterations: false,
  batchMode: false,
  useNonVisualRun: false,
};

function ErroringSimCore({ when = 'initialize' } = {}) {
  const err = new Error('boom');
  return {
    setEventBus: jest.fn(),
    isReady: jest.fn(async () => true),
    initialize: jest.fn(async () => { if (when === 'initialize') throw err; }),
    update: jest.fn(async () => { if (when === 'update') throw err; }),
    getEnabledTransitions: jest.fn(async () => (when === 'getEnabled' ? (() => { throw err; })() : [])),
    getSimulatorType: jest.fn(() => 'z3'),
    activateSimulation: jest.fn(async () => {}),
    deactivateSimulation: jest.fn(async () => {}),
    fireTransition: jest.fn(async () => { if (when === 'fire') throw err; return createElements(); }),
  };
}

function Harness({ injectedSimCore, netMode = 'pt', outRef }) {
  const [elements, setElements] = useState(createElements());
  const history = useRef([]);
  const updateHistory = (st) => { history.current.push(st); };
  const mgr = useSimulationManager(
    elements,
    setElements,
    updateHistory,
    netMode,
    defaultSettings,
    injectedSimCore
  );
  useEffect(() => { if (outRef) outRef.current = { elements, setElements, history, mgr }; }, [elements, mgr]);
  return <div data-testid="harness" />;
}

describe('useSimulationManager error paths', () => {
  test('initialize error leaves simulator not ready (error logged but not stored)', async () => {
    const outRef = { current: null };
    await act(async () => { render(<Harness injectedSimCore={ErroringSimCore({ when: 'initialize' })} outRef={outRef} />); });
    await act(async () => { await Promise.resolve(); });
    // initialize() error is only logged by manager; error state is set on update/fire failures
    expect(outRef.current.mgr.simulationError).toBeFalsy();
    expect(outRef.current.mgr.isSimulatorReady).toBe(false);
  });

  test('update error clears enabled transitions and sets error', async () => {
    const outRef = { current: null };
    await act(async () => { render(<Harness injectedSimCore={ErroringSimCore({ when: 'update' })} outRef={outRef} />); });
    await act(async () => { await Promise.resolve(); });
    expect(outRef.current.mgr.enabledTransitionIds).toEqual([]);
    expect(outRef.current.mgr.isSimulatorReady).toBe(false);
    expect(outRef.current.mgr.simulationError).toBeTruthy();
  });

  test('fireTransition error sets simulationError and does not mutate state', async () => {
    const outRef = { current: null };
    await act(async () => { render(<Harness injectedSimCore={ErroringSimCore({ when: 'fire' })} outRef={outRef} />); });
    const before = outRef.current.elements;
    await act(async () => { await outRef.current.mgr.handleFireTransition('t1'); });
    const after = outRef.current.elements;
    expect(outRef.current.mgr.simulationError).toBeTruthy();
    expect(after).toEqual(before);
  });
});


