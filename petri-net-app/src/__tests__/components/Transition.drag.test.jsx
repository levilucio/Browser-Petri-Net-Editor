import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Transition from '../../components/Transition';

const mockSetIsDragging = jest.fn();
const mockSetSnapIndicator = jest.fn();

jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    setIsDragging: mockSetIsDragging,
    gridSnappingEnabled: true,
    snapToGrid: (x, y) => ({ x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 }),
    setSnapIndicator: mockSetSnapIndicator,
    simulationSettings: {},
    netMode: 'pt',
    elements: { places: [], transitions: [], arcs: [] },
    selectedElements: [],
    setElements: jest.fn(),
    multiDragRef: { current: null },
    isIdSelected: () => false,
  }),
}));

jest.mock('react-konva', () => {
  return {
    Group: ({ children, onDragStart, onDragMove, onDragEnd, onClick, ...props }) => (
      <div
        data-testid="group"
        draggable
        {...props}
        onMouseDown={(e) => onDragStart && onDragStart({ target: { x: () => props.x, y: () => props.y, position: () => {} } })}
        onMouseMove={(e) => onDragMove && onDragMove({ target: { x: () => props.x + 9, y: () => props.y + 11, position: () => {} } })}
        onMouseUp={(e) => onDragEnd && onDragEnd({ target: { x: () => props.x + 9, y: () => props.y + 11 } })}
        onClick={onClick}
      >
        {children}
      </div>
    ),
    Rect: (props) => <div data-testid="rect" {...props} />,
    Text: ({ text, ...props }) => (
      <div data-testid="text" {...props}>{text}</div>
    ),
  };
});

describe('Transition drag lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('drag start/move/end toggles flags, snaps, and calls onChange', () => {
    const onChange = jest.fn();
    render(<Transition id="t1" x={150} y={150} label="T1" isSelected={false} isEnabled={false} onSelect={jest.fn()} onChange={onChange} />);
    const group = screen.getByTestId('group');

    fireEvent.mouseDown(group);
    expect(mockSetIsDragging).toHaveBeenCalledWith(true);

    fireEvent.mouseMove(group);
    expect(mockSetSnapIndicator).toHaveBeenCalled();

    fireEvent.mouseUp(group);
    expect(onChange).toHaveBeenCalled();
    expect(mockSetIsDragging).toHaveBeenCalledWith(false);
    const lastIndicatorCall = mockSetSnapIndicator.mock.calls.pop()?.[0];
    expect(lastIndicatorCall?.visible).toBe(false);
  });
});


