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

describe('PetriNetPanel multiple enabled transitions', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renders two enabled transitions and fires both on click', () => {
    const elements = {
      places: [],
      transitions: [ { id: 't1', label: 'T1' }, { id: 't2', label: 'T2' } ],
      arcs: [],
    };
    render(<PetriNetPanel elements={elements} enabledTransitionIds={['t1','t2']} />);
    fireEvent.click(screen.getByTestId('show-enabled-transitions'));
    const b1 = screen.getByTestId('enabled-T1');
    const b2 = screen.getByTestId('enabled-T2');
    expect(b1).toBeInTheDocument();
    expect(b2).toBeInTheDocument();
    fireEvent.click(b1);
    fireEvent.click(b2);
    expect(mockHandleFireTransition).toHaveBeenCalledWith('t1');
    expect(mockHandleFireTransition).toHaveBeenCalledWith('t2');
  });
});


