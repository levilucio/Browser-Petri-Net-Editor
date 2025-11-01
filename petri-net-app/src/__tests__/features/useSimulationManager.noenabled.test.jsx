import React, { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import useSimulationManager from '../../features/simulation/useSimulationManager';

const defaultSettings = {
  maxIterations: 100,
  limitIterations: false,
  batchMode: false,
  useNonVisualRun: false,
};

describe('useSimulationManager continuous no-enabled exits early', () => {
  function makeElements() {
    return { places: [{ id: 'p1' }], transitions: [{ id: 't1' }], arcs: [{ id: 'a1', source: 'p1', target: 't1' }] };
  }
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

  test('startContinuousSimulation returns without toggling when no enabled', async () => {
    const initial = makeElements();
    const { result } = renderHook(() => {
      const [elements, setElements] = useState(initial);
      const updateHistory = jest.fn();
      return useSimulationManager(elements, setElements, updateHistory, 'pt', defaultSettings, core);
    });
    await act(async () => {});
    expect(result.current.isContinuousSimulating).toBe(false);
    await act(async () => {
      await result.current.startContinuousSimulation();
    });
    expect(result.current.isContinuousSimulating).toBe(false);
  });
});


