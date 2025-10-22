import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PetriNetPanel from '../../components/PetriNetPanel';

jest.mock('../../contexts/PetriNetContext', () => ({
  usePetriNet: () => ({
    handleFireTransition: jest.fn(),
    netMode: 'pt',
  }),
}));

describe('PetriNetPanel toggles and empty state', () => {
  test('shows empty state when no places and toggles panel visibility', () => {
    const elements = { places: [], transitions: [], arcs: [] };
    render(<PetriNetPanel elements={elements} enabledTransitionIds={[]} />);
    const btn = screen.getByTestId('toggle-markings');
    fireEvent.click(btn);
    const panel = screen.getByTestId('current-marking');
    expect(panel).toBeInTheDocument();
    expect(panel.textContent || '').toContain('No places defined');
    // hide
    fireEvent.click(btn);
    expect(screen.queryByTestId('current-marking')).toBeNull();
  });
});


