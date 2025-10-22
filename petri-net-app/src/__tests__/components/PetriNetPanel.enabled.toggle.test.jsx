import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PetriNetPanel from '../../components/PetriNetPanel';

jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    handleFireTransition: jest.fn(),
    netMode: 'pt',
  }),
}));

describe('PetriNetPanel enabled transitions toggle', () => {
  test('panel shows and hides via toggle button', () => {
    const elements = { places: [], transitions: [ { id: 't1', label: 'T1' } ], arcs: [] };
    render(<PetriNetPanel elements={elements} enabledTransitionIds={['t1']} />);
    const btn = screen.getByTestId('show-enabled-transitions');
    fireEvent.click(btn);
    expect(screen.getByTestId('enabled-transitions')).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByTestId('enabled-transitions')).toBeNull();
  });
});


