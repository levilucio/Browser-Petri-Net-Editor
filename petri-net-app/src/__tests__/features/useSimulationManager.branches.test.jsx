import { renderHook, act } from '@testing-library/react';
import React, { useState } from 'react';
import useSimulationManager from '../../features/simulation/useSimulationManager';

function makeElements() {
  return { places: [{ id: 'p1' }], transitions: [{ id: 't1' }], arcs: [{ id: 'a1', source: 'p1', target: 't1' }] };
}

describe('useSimulationManager branches', () => {
  const core = {
    getSimulatorType: () => 'mock',
    isReady: async () => true,
    initialize: async () => {},
    update: async () => {},
    getEnabledTransitions: async () => [],
    fireTransition: async () => makeElements(),
    activateSimulation: async () => {},
    deactivateSimulation: () => {},
    setEventBus: () => {},
    getSimulationMode: () => 'single',
  };

  test('clearError resets simulationError and stopAllSimulations clears flags', async () => {
    const initial = makeElements();
    const { result } = renderHook(() => {
      const [elements, setElements] = useState(initial);
      const updateHistory = jest.fn();
      return useSimulationManager(elements, setElements, updateHistory, 'pt', core);
    });

    // set an error by forcing a failing fire
    const badCore = {
      ...core,
      fireTransition: async () => { throw new Error('boom'); },
    };

    // temporarily call handleFireTransition through a hook using bad core
    const { result: bad } = renderHook(() => {
      const [elements, setElements] = useState(initial);
      const updateHistory = jest.fn();
      return useSimulationManager(elements, setElements, updateHistory, 'pt', badCore);
    });

    await act(async () => {
      await bad.current.handleFireTransition('t1');
    });
    expect(bad.current.simulationError).toBeTruthy();

    act(() => {
      bad.current.clearError();
    });
    expect(bad.current.simulationError).toBeNull();

    act(() => {
      bad.current.stopAllSimulations();
    });
    expect(bad.current.isContinuousSimulating).toBe(false);
    expect(bad.current.isRunning).toBe(false);
  });
});


