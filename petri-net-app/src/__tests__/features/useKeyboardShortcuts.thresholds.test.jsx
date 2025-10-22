import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from '../../features/keymap/useKeyboardShortcuts';

function Harness({ ctx }) {
  useKeyboardShortcuts(ctx);
  return <div data-testid="root"></div>;
}

describe('useKeyboardShortcuts edge branches', () => {
  test('ignores keys in editable targets', () => {
    const setElements = jest.fn();
    const clearSelection = jest.fn();
    const setSelection = jest.fn();
    const clipboardRef = { current: null };
    const ctx = {
      elements: { places: [], transitions: [], arcs: [] },
      setElements,
      selectedElement: null,
      selectedElements: [],
      clearSelection,
      setSelection,
      clipboardRef,
    };
    const { getByTestId } = render(<Harness ctx={ctx} />);
    const input = document.createElement('input');
    getByTestId('root').appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(setElements).not.toHaveBeenCalled();
  });
});


