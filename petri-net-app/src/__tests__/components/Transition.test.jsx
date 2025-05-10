import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Transition from '../../components/Transition';

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
    Rect: (props) => <div data-testid="rect" {...props} />,
    Text: ({ text, ...props }) => <div data-testid="text" {...props}>{text}</div>,
  };
});



describe('Transition Component', () => {
  const mockTransition = {
    id: 'transition-1',
    x: 150,
    y: 150,
    name: 'T1'
  };
  
  const mockProps = {
    transition: mockTransition,
    isSelected: false,
    onClick: jest.fn(),
    onDragMove: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders with correct position', () => {
    render(<Transition {...mockProps} />);
    const groups = screen.queryAllByTestId('group');
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]).toHaveAttribute('x', '150');
    expect(groups[0]).toHaveAttribute('y', '150');
  });

  test('applies selected styling when isSelected is true', () => {
    render(<Transition {...mockProps} isSelected={true} />);
    const rects = screen.queryAllByTestId('rect');
    expect(rects.length).toBeGreaterThan(0);
    const hasBlueStroke = rects.some(rect => rect.getAttribute('stroke') === 'blue');
    expect(hasBlueStroke).toBe(true);
  });

  test('displays correct transition name', () => {
    render(<Transition {...mockProps} />);
    const nameText = screen.getByText('T1');
    expect(nameText).toBeInTheDocument();
  });

  test('calls onClick handler when clicked', () => {
    render(<Transition {...mockProps} />);
    const groups = screen.queryAllByTestId('group');
    expect(groups.length).toBeGreaterThan(0);
    fireEvent.click(groups[0]);
    expect(mockProps.onClick).toHaveBeenCalledTimes(1);
  });

  test('is draggable', () => {
    render(<Transition {...mockProps} />);
    const groups = screen.queryAllByTestId('group');
    expect(groups.length).toBeGreaterThan(0);
    expect(groups[0]).toHaveAttribute('draggable', 'true');
  });

  test('renders correctly with transition data', () => {
    render(<Transition {...mockProps} />);
    const rects = screen.queryAllByTestId('rect');
    expect(rects.length).toBeGreaterThan(0);
    expect(rects[0]).toBeInTheDocument();
  });

  test('has correct dimensions', () => {
    render(<Transition {...mockProps} />);
    const rects = screen.queryAllByTestId('rect');
    expect(rects.length).toBeGreaterThan(0);
    expect(rects[0]).toHaveAttribute('width', '30');
    expect(rects[0]).toHaveAttribute('height', '40');
  });
});
