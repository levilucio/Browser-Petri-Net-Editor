import React from 'react';
import { render, screen } from '@testing-library/react';
import Place from '../../components/Place';
import { EditorUIProvider } from '../../contexts/EditorUIContext';

jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    setIsDragging: jest.fn(),
    snapToGrid: (x, y) => ({ x, y }),
    netMode: 'algebraic-int',
    elements: { places: [], transitions: [], arcs: [] },
    selectedElements: [],
    setElements: jest.fn(),
    multiDragRef: { current: null },
    isIdSelected: jest.fn(() => false),
  }),
}));

const mockSetSnapIndicator = jest.fn();

jest.mock('../../contexts/EditorUIContext', () => ({
  EditorUIProvider: ({ children }) => <div>{children}</div>,
  useEditorUI: () => ({
    gridSnappingEnabled: true,
    toggleGridSnapping: jest.fn(),
    snapIndicator: { visible: false, position: null, elementType: null },
    setSnapIndicator: mockSetSnapIndicator,
    snapToGrid: (x, y) => ({ x, y }),
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

jest.mock('react-konva', () => ({
  Group: ({ children, ...props }) => <div data-testid="group" {...props}>{children}</div>,
  Circle: (props) => <div data-testid="circle" {...props} />,
  Text: ({ text, ...props }) => <div data-testid="text" {...props}>{text}</div>,
}));

describe('Place (algebraic tokens)', () => {
  const baseProps = { id: 'p1', x: 0, y: 0, label: 'P1', tokens: 0, isSelected: false, onSelect: jest.fn(), onChange: jest.fn() };

  const getRenderedCircleRadius = () => {
    const circles = screen.getAllByTestId('circle');
    const mainCircle = circles.find((circle) => circle.getAttribute('radius'));
    return mainCircle ? Number(mainCircle.getAttribute('radius')) : null;
  };

  test('renders algebraic tokens inside the place without expanding unnecessarily', () => {
    render(
      <EditorUIProvider>
        <Place {...baseProps} valueTokens={[2, 4, 6]} />
      </EditorUIProvider>
    );
    const texts = screen.getAllByTestId('text').map(n => n.textContent);
    expect(texts).toContain('2');
    expect(texts).toContain('4');
    expect(texts).toContain('6');
    expect(getRenderedCircleRadius()).toBe(30);
  });

  test('expands radius when tokens require more space but caps at 4x', () => {
    const complexTokens = Array.from({ length: 7 }, (_, i) => i + 1);

    render(
      <EditorUIProvider>
        <Place {...baseProps} valueTokens={complexTokens} />
      </EditorUIProvider>
    );

    const radius = getRenderedCircleRadius();
    expect(radius).toBeGreaterThanOrEqual(30);
    expect(radius).toBeLessThanOrEqual(120);

    const texts = screen.getAllByTestId('text').map(n => n.textContent);
    complexTokens.forEach(token => {
      expect(texts).toContain(String(token));
    });
  });

  test('shows indicator when content cannot fit even at maximum radius', () => {
    const overflowingTokens = Array.from({ length: 20 }, (_, i) => `super_long_token_${i}_with_many_characters`);
    render(
      <EditorUIProvider>
        <Place {...baseProps} valueTokens={overflowingTokens} />
      </EditorUIProvider>
    );

    const indicator = screen.getAllByTestId('text').find(n => n.textContent === `(${overflowingTokens.length})`);
    expect(indicator).toBeDefined();
    expect(getRenderedCircleRadius()).toBe(30);
  });
});
