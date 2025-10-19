import React, { useRef, useState, useEffect } from 'react';
import { render, act } from '@testing-library/react';
import useSimulationManager from '../../features/simulation/useSimulationManager';

function createElements() {
  return {
    places: [
      { id: 'p1', x: 100, y: 100, tokens: 1 },
      { id: 'p2', x: 300, y: 100, tokens: 0 },
    ],
    transitions: [
      { id: 't1', x: 200, y: 100 },
    ],
    arcs: [
      { id: 'a1', source: 'p1', target: 't1' },
      { id: 'a2', source: 't1', target: 'p2' },
    ],
  };
}

function createMockSimCore(newElementsAfterFire) {
  const enabled = ['t1'];
  return {
    setEventBus: jest.fn(),
    isReady: jest.fn(async () => true),
    initialize: jest.fn(async () => {}),
    update: jest.fn(async () => {}),
    getEnabledTransitions: jest.fn(async () => enabled),
    getSimulatorType: jest.fn(() => 'z3'),
    activateSimulation: jest.fn(async () => {}),
    deactivateSimulation: jest.fn(async () => {}),
    fireTransition: jest.fn(async () => newElementsAfterFire || createElements()),
  };
}

function Harness({ injectedSimCore, netMode = 'pt', outRef }) {
  const [elements, setElements] = useState(createElements());
  const history = useRef([]);
  const updateHistory = (st) => { history.current.push(st); };
  const mgr = useSimulationManager(elements, setElements, updateHistory, netMode, injectedSimCore);
  useEffect(() => { if (outRef) outRef.current = { elements, setElements, history, mgr }; }, [elements, mgr]);
  return <div data-testid="harness" />;
}

describe('useSimulationManager (DI)', () => {
  test('initially computes enabled transitions and fires a transition', async () => {
    const outRef = { current: null };
    const nextElements = createElements();
    // simulate a change after fire: move token to p2
    nextElements.places = nextElements.places.map(p => p.id === 'p2' ? { ...p, tokens: 1 } : { ...p, tokens: 0 });
    const mockCore = createMockSimCore(nextElements);

    await act(async () => { render(<Harness injectedSimCore={mockCore} outRef={outRef} />); });

    // Wait a tick for effect to set enabled transitions
    await act(async () => { await Promise.resolve(); });
    expect(mockCore.update).toHaveBeenCalled();
    // Enabled transitions should be derived from simulator core
    // Can't directly read internal state; instead, call refresh by toggling run state
    await act(async () => { await outRef.current.mgr.refreshEnabledTransitions?.(); });
    expect(mockCore.getEnabledTransitions).toHaveBeenCalled();

    // Fire transition and verify setElements/updateHistory invoked
    await act(async () => { await outRef.current.mgr.handleFireTransition('t1'); });
    const after = outRef.current.elements;
    expect(after.places.find(p => p.id === 'p2')?.tokens).toBe(1);
    expect(outRef.current.history.current.length).toBeGreaterThan(0);
  });
});


