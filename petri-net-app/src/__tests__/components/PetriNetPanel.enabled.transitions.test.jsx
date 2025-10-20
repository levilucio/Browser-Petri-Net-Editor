import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PetriNetPanel from '../../components/PetriNetPanel';

const mockHandleFireTransition = jest.fn();

jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    handleFireTransition: mockHandleFireTransition,
    netMode: 'pt',
  }),
}));

describe('PetriNetPanel enabled transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('clicking enabled transition button fires it via context handler', () => {
    const elements = {
      places: [ { id: 'p1', label: 'P1', tokens: 1 } ],
      transitions: [ { id: 't1', label: 'T1' } ],
      arcs: [],
    };

    render(<PetriNetPanel elements={elements} enabledTransitionIds={[ 't1' ]} />);

    // Open the enabled transitions panel
    fireEvent.click(screen.getByTestId('show-enabled-transitions'));
    expect(screen.getByTestId('enabled-transitions')).toBeInTheDocument();

    // Click the T1 button
    const btn = screen.getByTestId('enabled-T1');
    fireEvent.click(btn);
    expect(mockHandleFireTransition).toHaveBeenCalledWith('t1');
  });
});


