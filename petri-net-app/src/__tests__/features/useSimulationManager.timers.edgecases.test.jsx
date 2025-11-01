import React, { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import useSimulationManager from '../../features/simulation/useSimulationManager';

jest.useFakeTimers();

const defaultSettings = {
  maxIterations: 100,
  limitIterations: false,
  batchMode: false,
  useNonVisualRun: false,
};

function makeElements() {
  return {
    places: [ { id: 'p1' } ],
    transitions: [ { id: 't1' } ],
    arcs: [ { id: 'a1', source: 'p1', target: 't1' } ],
  };
}

function makeMockCore(enabled = []) {
  const state = { ready: false, enabled: enabled.slice() };
  return {
    getSimulatorType: () => 'mock',
    isReady: async () => state.ready,
    initialize: async () => { state.ready = true; },
    update: async () => {},
    getEnabledTransitions: async () => state.enabled,
    fireTransition: async () => { state.enabled = []; return makeElements(); },
    activateSimulation: async () => {},
    deactivateSimulation: () => {},
    setEventBus: () => {},
    getSimulationMode: () => 'single',
  };
}

describe('useSimulationManager timers edge cases', () => {
  test('startRunSimulation with no enabled transitions exits quickly', async () => {
    const core = makeMockCore([]);
    const initial = makeElements();
    const { result } = renderHook(() => {
      const [elements, setElements] = useState(initial);
      const updateHistory = jest.fn();
      return useSimulationManager(elements, setElements, updateHistory, 'pt', defaultSettings, core);
    });

    await act(async () => {});
    await act(async () => { await result.current.startRunSimulation(); });
    // advance timers to flush scheduled tasks
    await act(async () => { jest.advanceTimersByTime(200); });
    expect(result.current.enabledTransitionIds).toEqual([]);
  });

  test('startContinuousSimulation respects stop and clears interval', async () => {
    const core = makeMockCore(['t1']);
    const initial = makeElements();
    const { result } = renderHook(() => {
      const [elements, setElements] = useState(initial);
      const updateHistory = jest.fn();
      return useSimulationManager(elements, setElements, updateHistory, 'pt', defaultSettings, core);
    });

    await act(async () => {});
    await act(async () => { await result.current.startContinuousSimulation(); });
    await act(async () => { result.current.stopAllSimulations(); });
    await act(async () => { jest.advanceTimersByTime(200); });
    // After stop, there should be no further automatic fires; assert not simulating and no error
    expect(result.current.isContinuousSimulating).toBe(false);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.simulationError).toBeNull();
  });
});


