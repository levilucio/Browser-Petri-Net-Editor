import React from 'react';
import { render, screen } from '@testing-library/react';
import Arc from '../../components/Arc';
import { PetriNetContext } from '../../contexts/PetriNetContext';

jest.mock('react-konva', () => ({
  Line: (props) => <div data-testid="line" {...props} />,
  Text: ({ text, ...props }) => <div data-testid="text" {...props}>{text}</div>,
  Group: ({ children, ...props }) => <div data-testid="group" {...props}>{children}</div>,
  Circle: (props) => <div data-testid="circle" {...props} />,
}));

const renderWithMode = (ui, netMode) =>
  render(<PetriNetContext.Provider value={{ simulationSettings: { netMode } }}>{ui}</PetriNetContext.Provider>);

const places = [{ id: 'p1', x: 0, y: 0 }];
const transitions = [{ id: 't1', x: 100, y: 0 }];

describe('Arc (algebraic bindings)', () => {
  test('shows bindings when netMode is algebraic-int', () => {
    const arc = { id: 'a1', source: 'p1', target: 't1', type: 'place-to-transition', bindings: ['x', 'y+1'] };
    renderWithMode(<Arc arc={arc} places={places} transitions={transitions} />, 'algebraic-int');
    expect(screen.getAllByTestId('text').some(n => n.textContent === 'x, y+1')).toBe(true);
  });

  test('hides bindings when netMode is pt', () => {
    const arc = { id: 'a1', source: 'p1', target: 't1', type: 'place-to-transition', bindings: ['x'] };
    renderWithMode(<Arc arc={arc} places={places} transitions={transitions} />, 'pt');
    const all = screen.queryAllByTestId('text');
    expect(all.length === 0 || all.every(n => n.textContent !== 'x')).toBe(true);
  });
});


