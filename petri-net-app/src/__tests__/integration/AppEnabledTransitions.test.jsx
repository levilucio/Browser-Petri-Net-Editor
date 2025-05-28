/**
 * Integration test for the App component's enabled transitions functionality
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../../App';

// Mock the simulator module
jest.mock('../../utils/simulator', () => {
  // Create a mock for enabled transitions that we can control
  let mockEnabledTransitions = [];
  
  return {
    initializePyodide: jest.fn().mockResolvedValue(null),
    initializeSimulator: jest.fn().mockImplementation(() => {
      return Promise.resolve();
    }),
    getEnabledTransitions: jest.fn().mockImplementation(() => {
      return Promise.resolve(mockEnabledTransitions);
    }),
    fireTransition: jest.fn().mockImplementation((transitionId) => {
      // Update the mock enabled transitions after firing
      if (transitionId === 'transition-1') {
        mockEnabledTransitions = [{ id: 'transition-2', name: 'T2' }];
      } else {
        mockEnabledTransitions = [{ id: 'transition-1', name: 'T1' }];
      }
      
      return Promise.resolve({
        places: [
          { id: 'place-1', name: 'P1', tokens: 1, x: 100, y: 100 },
          { id: 'place-2', name: 'P2', tokens: 0, x: 300, y: 100 }
        ],
        transitions: [
          { id: 'transition-1', name: 'T1', x: 200, y: 100 },
          { id: 'transition-2', name: 'T2', x: 400, y: 100 }
        ],
        arcs: [
          { id: 'arc-1', sourceId: 'place-1', targetId: 'transition-1', sourceType: 'place', targetType: 'transition' },
          { id: 'arc-2', sourceId: 'transition-1', targetId: 'place-2', sourceType: 'transition', targetType: 'place' },
          { id: 'arc-3', sourceId: 'place-2', targetId: 'transition-2', sourceType: 'place', targetType: 'transition' }
        ]
      });
    }),
    isTransitionEnabled: jest.fn().mockImplementation((transitionId) => {
      return Promise.resolve(mockEnabledTransitions.some(t => t.id === transitionId));
    }),
    updateSimulator: jest.fn().mockResolvedValue(null),
    
    // Helper function to set enabled transitions for testing
    __setEnabledTransitions: (transitions) => {
      mockEnabledTransitions = transitions;
    }
  };
});

// Import the mocked functions after mocking
const { 
  initializeSimulator, 
  getEnabledTransitions, 
  fireTransition,
  __setEnabledTransitions 
} = require('../../utils/simulator');

// Mock Konva components
jest.mock('react-konva', () => ({
  Stage: ({ children, ...props }) => (
    <div data-testid="stage" {...props}>{children}</div>
  ),
  Layer: ({ children, ...props }) => (
    <div data-testid="layer" {...props}>{children}</div>
  ),
  Group: ({ children, onClick, onDragStart, onDragMove, onDragEnd, ...props }) => (
    <div 
      data-testid="group" 
      {...props} 
      onClick={onClick}
    >
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
  Circle: ({ fill, stroke, ...props }) => (
    <div 
      data-testid="circle" 
      data-fill={fill} 
      data-stroke={stroke} 
      {...props} 
    />
  ),
  Text: ({ text, ...props }) => <div data-testid="text" {...props}>{text}</div>,
  Line: (props) => <div data-testid="line" {...props} />
}));

describe('App Enabled Transitions Integration', () => {
  // This test focuses on the enabled transitions functionality
  // by testing the Transition component directly with different props
  
  test('Transition component correctly displays enabled state', () => {
    // Import the Transition component directly
    const Transition = require('../../components/Transition').default;
    
    const mockTransition = {
      id: 'transition-1',
      x: 150,
      y: 150,
      name: 'T1'
    };
    
    // Test with enabled=false
    const { getByTestId, rerender } = render(
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
    let rect = getByTestId('rect');
    
    // Verify it has the default gray fill
    expect(rect).toHaveAttribute('data-fill', 'gray');
    expect(rect).toHaveAttribute('data-stroke', 'black');
    
    // Re-render with enabled=true
    rerender(
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
    
    // Get the rectangle element again
    rect = getByTestId('rect');
    
    // Verify it now has the yellow fill for enabled transitions
    expect(rect).toHaveAttribute('data-fill', 'rgba(255, 255, 0, 0.8)');
    expect(rect).toHaveAttribute('data-stroke', 'rgba(255, 180, 0, 1)');
  });
});
