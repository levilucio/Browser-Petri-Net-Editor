import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Transition from '../../components/Transition';

// Mock Konva components since they rely on Canvas which isn't available in Jest
jest.mock('react-konva', () => {
  return {
    Group: ({ children, onClick, onDragMove, onDragStart, onDragEnd, ...props }) => (
      <div 
        data-testid="group" 
        {...props} 
        onClick={onClick}
      >
        {children}
      </div>
    ),
    Rect: ({ fill, stroke, strokeWidth, ...props }) => (
      <div data-testid="rect" data-fill={fill} data-stroke={stroke} data-stroke-width={strokeWidth} {...props} />
    ),
    Text: ({ text, ...props }) => <div data-testid="text" {...props}>{text}</div>,
    Line: (props) => <div data-testid="line" {...props} />
  };
});

describe('Enabled Transition Highlighting', () => {
  const mockTransition = {
    id: 'transition-1',
    x: 150,
    y: 150,
    name: 'T1'
  };
  
  const mockProps = {
    transition: mockTransition,
    isSelected: false,
    isDragging: false,
    isEnabled: false,
    onClick: jest.fn(),
    onDragStart: jest.fn(),
    onDragMove: jest.fn(),
    onDragEnd: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with default gray fill when not enabled', () => {
    render(<Transition {...mockProps} />);
    const rects = screen.queryAllByTestId('rect');
    expect(rects.length).toBeGreaterThan(0);
    expect(rects[0]).toHaveAttribute('data-fill', 'gray');
    expect(rects[0]).toHaveAttribute('data-stroke', 'black');
  });

  test('renders with yellow fill when enabled', () => {
    render(<Transition {...mockProps} isEnabled={true} />);
    const rects = screen.queryAllByTestId('rect');
    expect(rects.length).toBeGreaterThan(0);
    expect(rects[0]).toHaveAttribute('data-fill', 'rgba(255, 255, 0, 0.8)');
    expect(rects[0]).toHaveAttribute('data-stroke', 'rgba(255, 180, 0, 1)');
  });

  test('selected state takes precedence over enabled state for stroke color', () => {
    render(<Transition {...mockProps} isEnabled={true} isSelected={true} />);
    const rects = screen.queryAllByTestId('rect');
    expect(rects.length).toBeGreaterThan(0);
    expect(rects[0]).toHaveAttribute('data-fill', 'rgba(255, 255, 0, 0.8)'); // Still yellow fill
    expect(rects[0]).toHaveAttribute('data-stroke', 'blue'); // But blue stroke for selection
  });

  test('dragging state takes precedence over enabled state for stroke color', () => {
    render(<Transition {...mockProps} isEnabled={true} isDragging={true} />);
    const rects = screen.queryAllByTestId('rect');
    expect(rects.length).toBeGreaterThan(0);
    expect(rects[0]).toHaveAttribute('data-fill', 'rgba(255, 255, 0, 0.8)'); // Still yellow fill
    expect(rects[0]).toHaveAttribute('data-stroke', 'rgba(0, 150, 255, 0.7)'); // But drag color for stroke
  });
});
