import React from 'react';
import { render, screen } from '@testing-library/react';
import Place from '../../components/Place';
import { EditorUIProvider } from '../../contexts/EditorUIContext';

jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    setIsDragging: jest.fn(),
    gridSnappingEnabled: false,
    snapToGrid: (x, y) => ({ x, y }),
    setSnapIndicator: jest.fn(),
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

  test('renders small integer tokens as scattered numbers', () => {
    render(
      <EditorUIProvider>
        <Place {...baseProps} valueTokens={[2, 4, 6]} />
      </EditorUIProvider>
    );
    const texts = screen.getAllByTestId('text').map(n => n.textContent);
    expect(texts).toContain('2');
    expect(texts).toContain('4');
    expect(texts).toContain('6');
  });

  test('renders large integer token list as count indicator', () => {
    const many = Array.from({ length: 10 }, (_, i) => i + 1);
    render(
      <EditorUIProvider>
        <Place {...baseProps} valueTokens={many} />
      </EditorUIProvider>
    );
    expect(screen.getAllByTestId('text').some(n => n.textContent === '(10)')).toBe(true);
  });
});


