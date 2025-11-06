import React, { useEffect } from 'react';
import { render, screen, act } from '@testing-library/react';
import { PetriNetProvider, usePetriNet } from '../../contexts/PetriNetContext.jsx';
import { EditorUIProvider } from '../../contexts/EditorUIContext.jsx';

// Mock the simulation module to avoid initializing the real simulator in tests
jest.mock('../../features/simulation', () => ({
  simulatorCore: {},
  useSimulationManager: () => ({
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
  }),
}));

function Harness({ onReady }) {
  const ctx = usePetriNet();
  useEffect(() => { onReady && onReady(ctx); }, [onReady, ctx]);
  return <div data-testid="harness" />;
}

describe('PetriNetContext selection state', () => {
  test('setSelection focuses last entry; clearSelection resets', async () => {
    let ctxRef = null;
    render(
      <EditorUIProvider>
        <PetriNetProvider>
          <Harness onReady={(c) => { ctxRef = c; }} />
        </PetriNetProvider>
      </EditorUIProvider>
    );

    // Seed elements so focusing works
    await act(async () => {
      ctxRef.setElements({
        places: [{ id: 'p1', x: 10, y: 10 }],
        transitions: [{ id: 't1', x: 20, y: 20 }],
        arcs: [{ id: 'a1', source: 'p1', target: 't1' }],
      });
    });

    // Apply selection (order matters; last becomes focused)
    await act(async () => {
      ctxRef.setSelection([
        { id: 'p1', type: 'place' },
        { id: 't1', type: 'transition' },
      ]);
    });

    expect(ctxRef.selectedElements).toEqual([
      { id: 'p1', type: 'place' },
      { id: 't1', type: 'transition' },
    ]);
    expect(ctxRef.selectedElement?.id).toBe('t1');
    expect(ctxRef.selectedElement?.type).toBe('transition');
    expect(ctxRef.isIdSelected('p1', 'place')).toBe(true);
    expect(ctxRef.isIdSelected('t1', 'transition')).toBe(true);

    // Clear selection
    await act(async () => { ctxRef.clearSelection(); });
    expect(ctxRef.selectedElements).toEqual([]);
    expect(ctxRef.selectedElement).toBe(null);
    expect(ctxRef.isIdSelected('p1', 'place')).toBe(false);
  });

  test('setSelection([]) unsets focused element; isIdSelected behaves accordingly', async () => {
    let ctxRef = null;
    render(
      <EditorUIProvider>
        <PetriNetProvider>
          <Harness onReady={(c) => { ctxRef = c; }} />
        </PetriNetProvider>
      </EditorUIProvider>
    );

    await act(async () => {
      ctxRef.setElements({ places: [{ id: 'p2', x: 0, y: 0 }], transitions: [], arcs: [] });
    });

    await act(async () => { ctxRef.setSelection([{ id: 'p2', type: 'place' }]); });
    expect(ctxRef.isIdSelected('p2', 'place')).toBe(true);
    expect(ctxRef.selectedElement?.id).toBe('p2');

    await act(async () => { ctxRef.setSelection([]); });
    expect(ctxRef.selectedElements).toEqual([]);
    expect(ctxRef.selectedElement).toBe(null);
    expect(ctxRef.isIdSelected('p2', 'place')).toBe(false);
  });
});


