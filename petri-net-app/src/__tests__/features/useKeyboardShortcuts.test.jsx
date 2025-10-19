import React, { useRef, useEffect } from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../features/keymap/useKeyboardShortcuts';

// Deterministic UUIDs for paste
jest.mock('uuid', () => {
  let mockUidCounter = 1;
  return { v4: () => `nid-${mockUidCounter++}` };
});

function Harness({ ctxRef }) {
  const clipboardRef = useRef(null);
  const isShiftPressedRef = useRef(false);

  // Local mutable element state for setElements(prev => next)
  const stateRef = useRef({
    places: [
      { id: 'p1', x: 10, y: 10 },
      { id: 'p2', x: 100, y: 100 },
    ],
    transitions: [
      { id: 't1', x: 200, y: 200 },
    ],
    arcs: [
      { id: 'a1', source: 'p1', target: 't1' },
      { id: 'a2', source: 'p2', target: 't1' },
    ],
  });

  const lastSelectionRef = useRef([]);

  const ctx = {
    elements: stateRef.current,
    setElements: (updater) => {
      const next = typeof updater === 'function' ? updater(stateRef.current) : updater;
      stateRef.current = next;
    },
    selectedElement: null,
    selectedElements: [{ id: 'p1', type: 'place' }, { id: 't1', type: 'transition' }],
    clearSelection: () => { lastSelectionRef.current = []; },
    setSelection: (sel) => { lastSelectionRef.current = sel; },
    clipboardRef,
    isShiftPressedRef,
  };

  useKeyboardShortcuts(ctx);

  useEffect(() => {
    if (ctxRef) ctxRef.current = { ctx, stateRef, lastSelectionRef, isShiftPressedRef };
  }, []);

  return <div data-testid="harness" />;
}

describe('useKeyboardShortcuts', () => {
  test('Delete removes selected nodes and incident arcs', () => {
    const ctxRef = { current: null };
    render(<Harness ctxRef={ctxRef} />);
    expect(ctxRef.current.stateRef.current.arcs.length).toBe(2);
    fireEvent.keyDown(document, { key: 'Delete' });
    const next = ctxRef.current.stateRef.current;
    // Selected nodes p1 and t1 removed; incident arcs removed too
    expect(next.places.find(p => p.id === 'p1')).toBeUndefined();
    expect(next.transitions.find(t => t.id === 't1')).toBeUndefined();
    expect(next.arcs.length).toBe(0);
  });

  test('Ctrl+C then Ctrl+V pastes with offset and new ids', async () => {
    const ctxRef = { current: null };
    render(<Harness ctxRef={ctxRef} />);
    // Copy
    fireEvent.keyDown(document, { key: 'c', ctrlKey: true });
    expect(ctxRef.current.ctx.clipboardRef.current).toBeTruthy();
    const beforeCounts = ctxRef.current.stateRef.current;
    // Paste
    fireEvent.keyDown(document, { key: 'v', ctrlKey: true });
    const after = ctxRef.current.stateRef.current;
    expect(after.places.length).toBe(beforeCounts.places.length + 1);
    expect(after.transitions.length).toBe(beforeCounts.transitions.length + 1);
    expect(after.arcs.length).toBe(beforeCounts.arcs.length + 1);
    // New ids are nid-*
    const addedPlace = after.places.find(p => p.id.startsWith('nid-'));
    const addedTransition = after.transitions.find(t => t.id.startsWith('nid-'));
    expect(addedPlace).toBeTruthy();
    expect(addedTransition).toBeTruthy();
    // Selection set asynchronously; give event loop a tick
    await new Promise(res => setTimeout(res, 0));
    expect(ctxRef.current.lastSelectionRef.current.length).toBeGreaterThan(0);
  });

  test('Keys ignored when target is editable', () => {
    const ctxRef = { current: null };
    render(<Harness ctxRef={ctxRef} />);
    const input = document.createElement('input');
    document.body.appendChild(input);
    // Press Delete with input as target
    fireEvent.keyDown(input, { key: 'Delete' });
    const after = ctxRef.current.stateRef.current;
    // No deletion happened (still 2 arcs)
    expect(after.arcs.length).toBe(2);
  });

  test('Shift key toggles isShiftPressedRef', () => {
    const ctxRef = { current: null };
    render(<Harness ctxRef={ctxRef} />);
    fireEvent.keyDown(document, { key: 'Shift' });
    expect(ctxRef.current.isShiftPressedRef.current).toBe(true);
    fireEvent.keyUp(document, { key: 'Shift' });
    expect(ctxRef.current.isShiftPressedRef.current).toBe(false);
  });
});


