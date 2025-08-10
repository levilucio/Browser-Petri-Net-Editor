/**
 * Integration tests for the enabled transitions highlighting feature
 * Tests that transitions are properly highlighted when they become enabled
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Transition from '../../components/Transition';
import { simulatorCore } from '../../features/simulation';

// Mock the simulator module
jest.mock('../../features/simulation', () => ({
  simulatorCore: {
    initialize: jest.fn(),
    getEnabledTransitions: jest.fn(),
    fireTransition: jest.fn()
  }
}));

// Mock Konva components
jest.mock('react-konva', () => ({
  Group: ({ children, onClick, onDragStart, onDragMove, onDragEnd, ...props }) => (
    <div data-testid="group" {...props} onClick={onClick}>
      {children}
    </div>
  ),
  Rect: ({ fill, stroke, strokeWidth, ...props }) => (
    <div 
      data-testid="rect" 
      data-fill={fill} 
      data-stroke={stroke} 
      data-stroke-width={strokeWidth} 
      {...props} 
    />
  ),
  Text: ({ text, ...props }) => <div data-testid="text" {...props}>{text}</div>,
  Line: (props) => <div data-testid="line" {...props} />
}));

describe('Enabled Transition Highlighting Integration', () => {
  // Sample transition data
  const mockTransition = {
    id: 'transition-1',
    x: 150,
    y: 150,
    name: 'T1'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('transition is highlighted when enabled', () => {
    const { getByTestId } = render(
      <Transition
        transition={mockTransition}
        isSelected={false}
        isDragging={false}
        isEnabled={true}
        onClick={jest.fn()}
        onDragStart={jest.fn()}
        onDragMove={jest.fn()}
        onDragEnd={jest.fn()}
      />
    );

    // Get the rectangle element
    const rect = getByTestId('rect');
    
    // Verify it has the yellow fill for enabled transitions
    expect(rect).toHaveAttribute('data-fill', 'rgba(255, 255, 0, 0.8)');
    expect(rect).toHaveAttribute('data-stroke', 'rgba(255, 180, 0, 1)');
  });

  test('transition is not highlighted when not enabled', () => {
    const { getByTestId } = render(
      <Transition
        transition={mockTransition}
        isSelected={false}
        isDragging={false}
        isEnabled={false}
        onClick={jest.fn()}
        onDragStart={jest.fn()}
        onDragMove={jest.fn()}
        onDragEnd={jest.fn()}
      />
    );

    // Get the rectangle element
    const rect = getByTestId('rect');
    
    // Verify it has the default gray fill
    expect(rect).toHaveAttribute('data-fill', 'gray');
    expect(rect).toHaveAttribute('data-stroke', 'black');
  });

  test('selected state takes precedence over enabled state for stroke color', () => {
    const { getByTestId } = render(
      <Transition
        transition={mockTransition}
        isSelected={true}
        isDragging={false}
        isEnabled={true}
        onClick={jest.fn()}
        onDragStart={jest.fn()}
        onDragMove={jest.fn()}
        onDragEnd={jest.fn()}
      />
    );

    // Get the rectangle element
    const rect = getByTestId('rect');
    
    // Verify it has yellow fill but blue stroke for selection
    expect(rect).toHaveAttribute('data-fill', 'rgba(255, 255, 0, 0.8)');
    expect(rect).toHaveAttribute('data-stroke', 'blue');
  });
});
