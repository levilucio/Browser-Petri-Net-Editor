import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PetriNetPanel from '../../components/PetriNetPanel';

jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    handleFireTransition: jest.fn(),
    netMode: 'algebraic-int',
  }),
}));

describe('PetriNetPanel algebraic markings', () => {
  test('shows only non-empty algebraic places and formats token values', () => {
    const elements = {
      places: [
        { id: 'p1', label: 'P1', valueTokens: [] },
        { id: 'p2', label: 'P2', valueTokens: [true, 'abc', { __pair__: true, fst: 1, snd: 2 }, [3, 4]] },
      ],
      transitions: [],
      arcs: [],
    };
    render(<PetriNetPanel elements={elements} enabledTransitionIds={[]} />);
    fireEvent.click(screen.getByTestId('toggle-markings'));
    const panel = screen.getByTestId('current-marking');
    expect(panel).toBeInTheDocument();
    const text = panel.textContent || '';
    // P1 is empty -> hidden; P2 appears with formatted tokens
    expect(text).toContain('P2');
    expect(text).toContain('T');
    expect(text).toContain("'abc'");
    expect(text).toContain('(1, 2)');
    expect(text).toContain('3');
    expect(text).toContain('4');
  });
});


