import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Transition from '../../components/Transition';
import { EditorUIProvider } from '../../contexts/EditorUIContext';

// Capture calls for assertions (must be defined before jest.mock factory)
const mockSetIsDragging = jest.fn();
const mockSetSnapIndicator = jest.fn();
const mockSetSelection = jest.fn();

// Mock PetriNet context used by Transition
jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    setIsDragging: mockSetIsDragging,
    gridSnappingEnabled: true,
    snapToGrid: (x, y) => ({ x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 }),
    setSnapIndicator: mockSetSnapIndicator,
    netMode: 'pt',
    elements: { places: [], transitions: [{ id: 't1', x: 100, y: 100 }], arcs: [] },
    selectedElements: [],
    setElements: jest.fn(),
    multiDragRef: { current: null },
    isIdSelected: () => false,
    setSelection: mockSetSelection,
  }),
}));

jest.mock('../../contexts/EditorUIContext', () => ({
  EditorUIProvider: ({ children }) => <div>{children}</div>,
  useEditorUI: () => ({
    gridSnappingEnabled: true,
    toggleGridSnapping: jest.fn(),
    snapIndicator: { visible: false, position: null, elementType: null },
    setSnapIndicator: mockSetSnapIndicator,
    snapToGrid: (x, y) => ({ x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10 }),
    stageDimensions: { width: 0, height: 0 },
    setStageDimensions: jest.fn(),
    virtualCanvasDimensions: { width: 0, height: 0 },
    setVirtualCanvasDimensions: jest.fn(),
    canvasScroll: { x: 0, y: 0 },
    setCanvasScroll: jest.fn(),
    zoomLevel: 1,
    setZoomLevel: jest.fn(),
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 3,
    appRef: { current: null },
    containerRef: null,
    setContainerRef: jest.fn(),
    stageRef: { current: null },
    gridSize: 10,
  }),
}));

// Mock Konva components with simple DOM equivalents
jest.mock('react-konva', () => {
  return {
    Group: ({ children, onDragStart, onDragMove, onDragEnd, onClick, ...props }) => (
      <div
        data-testid="group"
        draggable
        {...props}
        onMouseDown={(e) => onDragStart && onDragStart({ target: { x: () => props.x, y: () => props.y, position: () => {} } })}
        onMouseMove={(e) => onDragMove && onDragMove({ target: { x: () => props.x + 13, y: () => props.y + 7, position: () => {} } })}
        onMouseUp={(e) => onDragEnd && onDragEnd({ target: { x: () => props.x + 13, y: () => props.y + 7 } })}
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
    render(
      <EditorUIProvider>
        <Transition
          id="t1"
          x={100}
          y={100}
          label="T1"
          isSelected={false}
          isEnabled={false}
          onSelect={jest.fn()}
          onChange={onChange}
        />
      </EditorUIProvider>
    );
    const group = screen.getByTestId('group');

    // Start drag
    fireEvent.mouseDown(group);
    expect(mockSetIsDragging).toHaveBeenCalledWith(true);

    // Move drag -> snap indicator visible and position snapped
    fireEvent.mouseMove(group);
    expect(mockSetSnapIndicator).toHaveBeenCalled();

    // End drag -> onChange called and flags reset
    fireEvent.mouseUp(group);
    expect(onChange).toHaveBeenCalled();
    expect(mockSetIsDragging).toHaveBeenCalledWith(false);
    const lastIndicatorCall = mockSetSnapIndicator.mock.calls.pop()?.[0];
    expect(lastIndicatorCall?.visible).toBe(false);
  });
});

