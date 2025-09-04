import React from 'react';
import { render, screen } from '@testing-library/react';
import Place from '../../components/Place';

jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    setIsDragging: jest.fn(),
    gridSnappingEnabled: false,
    snapToGrid: (x, y) => ({ x, y }),
    setSnapIndicator: jest.fn(),
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
    render(<Place {...baseProps} valueTokens={[2, 4, 6]} />);
    const texts = screen.getAllByTestId('text').map(n => n.textContent);
    expect(texts).toContain('2');
    expect(texts).toContain('4');
    expect(texts).toContain('6');
  });

  test('renders large integer token list as count indicator', () => {
    const many = Array.from({ length: 10 }, (_, i) => i + 1);
    render(<Place {...baseProps} valueTokens={many} />);
    expect(screen.getAllByTestId('text').some(n => n.textContent === '(10)')).toBe(true);
  });
});


