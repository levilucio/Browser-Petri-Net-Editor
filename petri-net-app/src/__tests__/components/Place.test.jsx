import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Place from '../../components/Place';

// Mock Konva components since they rely on Canvas which isn't available in Jest
jest.mock('react-konva', () => {
  return {
    Group: ({ children, onClick, onDragMove, ...props }) => (
      <div 
        data-testid="group" 
        {...props} 
        onClick={onClick ? (e) => onClick(e) : undefined}
        onMouseMove={onDragMove ? (e) => onDragMove(e) : undefined}
      >
        {children}
      </div>
    ),
    Circle: (props) => <div data-testid="circle" {...props} />,
    Text: ({ text, ...props }) => <div data-testid="text" {...props}>{text}</div>,
  };
});



describe('Place Component', () => {
  const mockPlace = {
    id: 'place-1',
    x: 100,
    y: 100,
    label: 'P1',
    tokens: 3
  };
  
  const mockProps = {
    place: mockPlace,
    isSelected: false,
    onClick: jest.fn(),
    onDragMove: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with correct position', () => {
    render(<Place {...mockProps} />);
    const group = screen.queryAllByTestId('group');
    expect(group.length).toBeGreaterThan(0);
    expect(group[0]).toHaveAttribute('x', '100');
    expect(group[0]).toHaveAttribute('y', '100');
  });

  test('applies selected styling when isSelected is true', () => {
    render(<Place {...mockProps} isSelected={true} />);
    const circles = screen.queryAllByTestId('circle');
    expect(circles.length).toBeGreaterThan(0);
    // Find the main circle (the one with radius 20)
    const mainCircle = circles.find(circle => circle.getAttribute('radius') === '20');
    expect(mainCircle).toBeDefined();
    expect(mainCircle).toHaveAttribute('stroke', 'blue');
  });

  test('displays correct place name', () => {
    render(<Place {...mockProps} />);
    const texts = screen.queryAllByTestId('text');
    const nameText = texts.find(text => text.textContent === 'P1');
    expect(nameText).toBeTruthy();
  });

  test('displays correct token count', () => {
    render(<Place {...mockProps} />);
    const texts = screen.queryAllByTestId('text');
    const tokenText = texts.find(text => text.textContent === '3');
    expect(tokenText).toBeTruthy();
  });

  test('calls onClick handler when clicked', () => {
    render(<Place {...mockProps} />);
    const group = screen.queryAllByTestId('group');
    expect(group.length).toBeGreaterThan(0);
    fireEvent.click(group[0]);
    expect(mockProps.onClick).toHaveBeenCalledTimes(1);
  });

  test('is draggable', () => {
    render(<Place {...mockProps} />);
    const group = screen.getByTestId('group');
    expect(group).toHaveAttribute('draggable', 'true');
  });
});
