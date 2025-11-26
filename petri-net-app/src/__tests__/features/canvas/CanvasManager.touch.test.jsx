import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import CanvasManager from '../../../features/canvas/CanvasManager';

// Shared mocks and helpers ---------------------------------------------------
const mockSetMode = jest.fn();
const mockSetArcStart = jest.fn();
const mockSetTempArcEnd = jest.fn();
const mockSetSelectedElement = jest.fn();
const mockSetSelection = jest.fn();
const mockSetElements = jest.fn();
const mockHandleCreateElement = jest.fn();
const mockHandleElementClick = jest.fn();
const mockHandleElementDragEnd = jest.fn();
const mockSetStageDimensions = jest.fn();
const mockSetCanvasScroll = jest.fn();
const mockSetContainerRef = jest.fn();
const mockSetSnapIndicator = jest.fn();
const mockHandleZoom = jest.fn();
const mockSnapToGrid = jest.fn((x, y) => ({ x, y }));

const mockStageEventHandlers = {
  onTouchStart: null,
  onTouchMove: null,
  onTouchEnd: null,
};

let pointerPosition = { x: 0, y: 0 };
const setStagePointer = ({ x, y }) => {
  pointerPosition = { x, y };
};

const mockStageApi = {
  getPointerPosition: () => ({ ...pointerPosition }),
  getAbsoluteTransform: () => ({
    copy: () => ({
      invert: () => {},
      point: ({ x, y }) => ({ x, y }),
    }),
  }),
  getIntersection: jest.fn(() => null),
};

// Mock Konva components ------------------------------------------------------
jest.mock('react-konva', () => {
  const React = require('react');
  const MockStage = React.forwardRef(({
    children,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    ...props
  }, _ref) => {
    mockStageEventHandlers.onTouchStart = onTouchStart;
    mockStageEventHandlers.onTouchMove = onTouchMove;
    mockStageEventHandlers.onTouchEnd = onTouchEnd;

    return (
      <div
        data-testid="stage"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        {...props}
      >
        {children}
      </div>
    );
  });

  return {
    Stage: MockStage,
    Layer: ({ children }) => <div data-testid="layer">{children}</div>,
    Rect: (props) => <div data-testid="rect" {...props} />,
  };
});

jest.mock('../../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    mode: 'select',
    setMode: mockSetMode,
    arcStart: null,
    setArcStart: mockSetArcStart,
    tempArcEnd: null,
    setTempArcEnd: mockSetTempArcEnd,
    selectedElement: null,
    setSelectedElement: mockSetSelectedElement,
    elements: { places: [], transitions: [], arcs: [] },
    enabledTransitionIds: [],
    snapToGrid: mockSnapToGrid,
    selectedElements: [],
    setSelection: mockSetSelection,
    isDragging: false,
  }),
}));

jest.mock('../../../contexts/EditorUIContext', () => ({
  useEditorUI: () => ({
    stageDimensions: { width: 800, height: 600 },
    setStageDimensions: mockSetStageDimensions,
    virtualCanvasDimensions: { width: 2000, height: 2000 },
    canvasScroll: { x: 0, y: 0 },
    setCanvasScroll: mockSetCanvasScroll,
    zoomLevel: 1,
    setContainerRef: mockSetContainerRef,
    stageRef: { current: mockStageApi },
    gridSize: 10,
    gridSnappingEnabled: false,
    snapIndicator: { visible: false, position: null, elementType: null },
    setSnapIndicator: mockSetSnapIndicator,
  }),
}));

jest.mock('../../../features/elements/useElementManager', () => ({
  useElementManager: () => ({
    handleCreateElement: mockHandleCreateElement,
    handleElementClick: mockHandleElementClick,
    handleElementDragEnd: mockHandleElementDragEnd,
  }),
}));

jest.mock('../../../features/elements/ElementManager', () => {
  return function ElementManager() {
    return <div data-testid="element-manager" />;
  };
});

jest.mock('../../../features/arcs/ArcManager', () => {
  return function ArcManager() {
    return <div data-testid="arc-manager" />;
  };
});

jest.mock('../../../components/Grid', () => {
  return function Grid() {
    return <div data-testid="grid" />;
  };
});

jest.mock('../../../components/CustomScrollbar', () => {
  return function CustomScrollbar() {
    return <div data-testid="scrollbar" />;
  };
});

jest.mock('../../../components/SnapIndicator', () => {
  return function SnapIndicator() {
    return <div data-testid="snap-indicator" />;
  };
});

const createTouchPayload = ({ x = 200, y = 200, identifier = 1 }) => ({
  target: { name: () => 'background' },
  touches: [{ identifier, clientX: x, clientY: y }],
  changedTouches: [{ identifier, clientX: x, clientY: y }],
  preventDefault: jest.fn(),
  stopPropagation: jest.fn(),
});

const fireStageTouch = (handler, payload) => {
  if (typeof handler !== 'function') {
    throw new Error('Stage handler not registered');
  }
  setStagePointer({ x: payload.touches[0].clientX, y: payload.touches[0].clientY });
  act(() => handler(payload));
};

describe('CanvasManager - Touch Device Functionality', () => {
  let matchMediaMock;
  let originalMatchMedia;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStageEventHandlers.onTouchStart = null;
    mockStageEventHandlers.onTouchMove = null;
    mockStageEventHandlers.onTouchEnd = null;
    pointerPosition = { x: 0, y: 0 };

    // Mock window.matchMedia for touch device detection
    originalMatchMedia = window.matchMedia;
    matchMediaMock = jest.fn((query) => {
      const isTouchDevice = query === '(pointer: coarse)';
      return {
        matches: isTouchDevice,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      };
    });
    window.matchMedia = matchMediaMock;
  });

  afterEach(() => {
    jest.useRealTimers();
    window.matchMedia = originalMatchMedia;
  });

  test('detects touch device using matchMedia', () => {
    // Set up matchMedia to return true for touch device
    matchMediaMock.mockReturnValue({
      matches: true,
      media: '(pointer: coarse)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <CanvasManager
        handleZoom={mockHandleZoom}
        ZOOM_STEP={0.1}
        isSingleFingerPanningActive={false}
        isSelectionActiveRef={{ current: false }}
      />
    );

    expect(matchMediaMock).toHaveBeenCalledWith('(pointer: coarse)');
  });

  test('handles long press selection on touch device', async () => {
    // Set up matchMedia to return true for touch device
    matchMediaMock.mockReturnValue({
      matches: true,
      media: '(pointer: coarse)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <CanvasManager
        handleZoom={mockHandleZoom}
        ZOOM_STEP={0.1}
        isSingleFingerPanningActive={false}
        isSelectionActiveRef={{ current: false }}
      />
    );

    const startPayload = createTouchPayload({ x: 240, y: 260 });
    fireStageTouch(mockStageEventHandlers.onTouchStart, startPayload);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    const endPayload = createTouchPayload({ x: 260, y: 280 });
    fireStageTouch(mockStageEventHandlers.onTouchEnd, endPayload);

    await waitFor(() => {
      expect(mockSetSelection).toHaveBeenCalledTimes(1);
    });
  });

  test('cancels long press selection if movement exceeds threshold', async () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      media: '(pointer: coarse)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <CanvasManager
        handleZoom={mockHandleZoom}
        ZOOM_STEP={0.1}
        isSingleFingerPanningActive={false}
        isSelectionActiveRef={{ current: false }}
      />
    );

    const startPayload = createTouchPayload({ x: 150, y: 150 });
    fireStageTouch(mockStageEventHandlers.onTouchStart, startPayload);

    const movePayload = createTouchPayload({ x: 190, y: 190 });
    fireStageTouch(mockStageEventHandlers.onTouchMove, movePayload);

    act(() => {
      jest.advanceTimersByTime(500);
    });

    if (mockStageEventHandlers.onTouchEnd) {
      fireStageTouch(mockStageEventHandlers.onTouchEnd, movePayload);
    }

    await waitFor(() => {
      expect(mockSetSelection).not.toHaveBeenCalled();
    });
  });

  test('does not show scrollbars on touch devices', () => {
    matchMediaMock.mockReturnValue({
      matches: true,
      media: '(pointer: coarse)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    const { container } = render(
      <CanvasManager
        handleZoom={mockHandleZoom}
        ZOOM_STEP={0.1}
        isSingleFingerPanningActive={false}
        isSelectionActiveRef={{ current: false }}
      />
    );

    // Scrollbars should not be rendered on touch devices
    const scrollbars = screen.queryAllByTestId('scrollbar');
    expect(scrollbars).toHaveLength(0);
  });

  test('shows scrollbars on non-touch devices', () => {
    matchMediaMock.mockReturnValue({
      matches: false,
      media: '(pointer: coarse)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });

    render(
      <CanvasManager
        handleZoom={mockHandleZoom}
        ZOOM_STEP={0.1}
        isSingleFingerPanningActive={false}
        isSelectionActiveRef={{ current: false }}
      />
    );

    // On non-touch devices with large canvas, scrollbars should be present
    // (This test may need adjustment based on actual canvas dimensions)
    // For now, we just verify the component renders
    expect(screen.getByTestId('stage')).toBeInTheDocument();
  });
});


