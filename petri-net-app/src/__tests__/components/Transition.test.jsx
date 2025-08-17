import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Transition from '../../components/Transition';

// Mock PetriNet context used by Transition
jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    setIsDragging: jest.fn(),
    gridSnappingEnabled: false,
    snapToGrid: (x, y) => ({ x, y }),
    setSnapIndicator: jest.fn(),
  }),
}));

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
    label: 'T1'
  };
  
  const mockProps = {
    ...mockTransition,
    isSelected: false,
    isEnabled: false,
    onSelect: jest.fn(),
    onChange: jest.fn(),
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
    const texts = screen.queryAllByTestId('text');
    const nameText = texts.find(text => text.textContent === 'T1');
    expect(nameText).toBeTruthy();
  });

  test('calls onSelect handler when clicked', () => {
    render(<Transition {...mockProps} />);
    const groups = screen.queryAllByTestId('group');
    expect(groups.length).toBeGreaterThan(0);
    fireEvent.click(groups[0]);
    expect(mockProps.onSelect).toHaveBeenCalledTimes(1);
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
    expect(rects[0]).toHaveAttribute('width', '40');
    expect(rects[0]).toHaveAttribute('height', '50');
  });
});
