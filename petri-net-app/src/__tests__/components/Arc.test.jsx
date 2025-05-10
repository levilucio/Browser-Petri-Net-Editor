import React from 'react';
import { render, screen } from '@testing-library/react';
import Arc from '../../components/Arc';

// Mock Konva components since they rely on Canvas which isn't available in Jest
jest.mock('react-konva', () => {
  return {
    Line: ({ children, ...props }) => <div data-testid="line" {...props}>{children}</div>,
    Text: ({ children, ...props }) => <div data-testid="text" {...props}>{children}</div>,
    Arrow: (props) => <div data-testid="arrow" {...props} />,
    Group: ({ children, onClick, ...props }) => (
      <div 
        data-testid="group" 
        {...props} 
        onClick={onClick ? (e) => onClick(e) : undefined}
      >
        {children}
      </div>
    ),
  };
});

describe('Arc Component', () => {
  const mockPlaces = [
    { id: 'place-1', x: 100, y: 100, name: 'P1', tokens: 1 }
  ];
  
  const mockTransitions = [
    { id: 'transition-1', x: 200, y: 200, name: 'T1' }
  ];
  
  const mockArc = {
    id: 'arc-1',
    sourceId: 'place-1',
    sourceType: 'place',
    targetId: 'transition-1',
    targetType: 'transition',
    weight: 1
  };
  
  const mockProps = {
    arc: mockArc,
    places: mockPlaces,
    transitions: mockTransitions,
    isSelected: false,
    onClick: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders correctly with valid source and target', () => {
    render(<Arc {...mockProps} />);
    const lines = screen.queryAllByTestId('line');
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toBeInTheDocument();
  });

  test('applies selected styling when isSelected is true', () => {
    render(<Arc {...mockProps} isSelected={true} />);
    const lines = screen.queryAllByTestId('line');
    expect(lines.length).toBeGreaterThan(0);
    // Check if at least one line has the blue stroke
    const hasBlueStroke = lines.some(line => line.getAttribute('stroke') === 'blue');
    expect(hasBlueStroke).toBe(true);
  });

  test('calls onClick handler when clicked', () => {
    render(<Arc {...mockProps} />);
    const group = screen.getByTestId('group');
    group.click();
    expect(mockProps.onClick).toHaveBeenCalledTimes(1);
  });

  test('returns null if source is not found', () => {
    const invalidProps = {
      ...mockProps,
      arc: {
        ...mockArc,
        sourceId: 'non-existent-id'
      }
    };
    
    const { container } = render(<Arc {...invalidProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('returns null if target is not found', () => {
    const invalidProps = {
      ...mockProps,
      arc: {
        ...mockArc,
        targetId: 'non-existent-id'
      }
    };
    
    const { container } = render(<Arc {...invalidProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  test('renders arrow points for the arc', () => {
    render(<Arc {...mockProps} />);
    const lines = screen.queryAllByTestId('line');
    expect(lines.length).toBeGreaterThan(0);
    // Check if at least one line has points attribute
    const hasPoints = lines.some(line => line.hasAttribute('points'));
    expect(hasPoints).toBe(true);
  });
});
