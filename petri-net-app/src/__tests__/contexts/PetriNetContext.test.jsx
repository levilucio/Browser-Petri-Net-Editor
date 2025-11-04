import React from 'react';
import { renderHook, act } from '@testing-library/react';

const mockSimulationManager = {
  isContinuousSimulating: false,
  isRunning: false,
  enabledTransitionIds: [],
  simulationError: null,
  isSimulatorReady: false,
  handleFireTransition: jest.fn(),
  stepSimulation: jest.fn(),
  startContinuousSimulation: jest.fn(),
  startRunSimulation: jest.fn(),
  stopAllSimulations: jest.fn(),
  forceSimulatorReset: jest.fn(),
};

jest.mock('../../features/simulation', () => ({
  simulatorCore: { getType: () => 'mock', setEventBus: jest.fn() },
  useSimulationManager: jest.fn(() => mockSimulationManager),
}));

const mockAddState = jest.fn(() => ({ canUndo: true, canRedo: false }));
const mockUndo = jest.fn(() => ({ state: { places: [], transitions: [], arcs: [] }, canUndo: false, canRedo: true }));
const mockRedo = jest.fn(() => ({ state: { places: [], transitions: [], arcs: [] }, canUndo: false, canRedo: false }));

jest.mock('../../features/history/historyManager', () => ({
  HistoryManager: jest.fn(() => ({
    addState: mockAddState,
    undo: mockUndo,
    redo: mockRedo,
  })),
}));

jest.mock('../../features/keymap/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: jest.fn(),
}));

import { PetriNetProvider, usePetriNet } from '../../contexts/PetriNetContext';

describe('PetriNetContext', () => {
  const wrapper = ({ children }) => <PetriNetProvider>{children}</PetriNetProvider>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSimulationManager.isContinuousSimulating = false;
    mockSimulationManager.isRunning = false;
    mockSimulationManager.enabledTransitionIds = [];
    mockSimulationManager.simulationError = null;
    mockSimulationManager.isSimulatorReady = false;
  });

  test('usePetriNet throws outside of provider', () => {
    expect(() => renderHook(() => usePetriNet())).toThrow('usePetriNet must be used within a PetriNetProvider');
  });

  test('exposes default state and toggles grid snapping', () => {
    const { result } = renderHook(() => usePetriNet(), { wrapper });
    expect(result.current.mode).toBe('select');
    expect(result.current.gridSnappingEnabled).toBe(true);

    act(() => {
      result.current.toggleGridSnapping();
    });

    expect(result.current.gridSnappingEnabled).toBe(false);
  });

  test('snapToGrid respects gridSnappingEnabled flag', async () => {
    const { result } = renderHook(() => usePetriNet(), { wrapper });
    let snapped;
    act(() => {
      snapped = result.current.snapToGrid(23, 37);
    });
    expect(snapped).toEqual({ x: 20, y: 40 });

    await act(async () => {
      result.current.toggleGridSnapping();
    });
    act(() => {
      snapped = result.current.snapToGrid(23, 37);
    });
    expect(snapped).toEqual({ x: 23, y: 37 });
  });

  test('resetEditor clears elements and history', () => {
    const { result } = renderHook(() => usePetriNet(), { wrapper });

    act(() => {
      result.current.setElements({
        places: [{ id: 'p1', tokens: 1 }],
        transitions: [{ id: 't1' }],
        arcs: [{ id: 'a1', source: 'p1', target: 't1' }],
      });
      result.current.setMode('transition');
      result.current.resetEditor();
    });

    expect(result.current.elements).toEqual({ places: [], transitions: [], arcs: [] });
    expect(result.current.mode).toBe('select');
    expect(mockAddState).not.toHaveBeenCalled();
  });

  test('handleUndo and handleRedo use history manager', () => {
    mockUndo.mockReturnValueOnce({ state: { places: [{ id: 'p1' }], transitions: [], arcs: [] }, canUndo: false, canRedo: true });
    mockRedo.mockReturnValueOnce({ state: { places: [], transitions: [{ id: 't1' }], arcs: [] }, canUndo: true, canRedo: false });
    const { result } = renderHook(() => usePetriNet(), { wrapper });

    act(() => {
      result.current.setCanUndo(true);
    });
    act(() => {
      result.current.handleUndo();
    });
    expect(result.current.elements.places).toHaveLength(1);

    act(() => {
      result.current.setCanRedo(true);
    });
    act(() => {
      result.current.handleRedo();
    });
    expect(result.current.elements.transitions).toHaveLength(1);
  });

  test('setSelection updates selected elements and focused element', async () => {
    const { result } = renderHook(() => usePetriNet(), { wrapper });

    await act(async () => {
      result.current.setElements({
        places: [{ id: 'p1', x: 0, y: 0 }],
        transitions: [{ id: 't1', x: 10, y: 10 }],
        arcs: [],
      });
    });

    await act(async () => {
      result.current.setSelection([{ id: 'p1', type: 'place' }, { id: 't1', type: 'transition' }]);
    });

    expect(result.current.selectedElements).toEqual([{ id: 'p1', type: 'place' }, { id: 't1', type: 'transition' }]);
    expect(result.current.selectedElement).toMatchObject({ id: 't1', type: 'transition' });

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedElements).toEqual([]);
    expect(result.current.selectedElement).toBeNull();
  });
});


