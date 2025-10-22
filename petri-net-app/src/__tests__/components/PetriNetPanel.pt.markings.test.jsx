import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PetriNetPanel from '../../components/PetriNetPanel';

jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    handleFireTransition: jest.fn(),
    netMode: 'pt',
  }),
}));

describe('PetriNetPanel PT markings', () => {
  test('shows numeric token badges for PT mode', () => {
    const elements = {
      places: [
        { id: 'p1', label: 'P1', tokens: 3 },
        { id: 'p2', label: 'P2', tokens: 0 },
      ],
      transitions: [],
      arcs: [],
    };

    render(<PetriNetPanel elements={elements} enabledTransitionIds={[]} />);
    fireEvent.click(screen.getByTestId('toggle-markings'));
    const panel = screen.getByTestId('current-marking');
    expect(panel).toBeInTheDocument();
    const text = panel.textContent || '';
    expect(text).toContain('P1');
    expect(text).toContain('3');
    expect(text).toContain('P2');
    expect(text).toContain('0');
  });
});


