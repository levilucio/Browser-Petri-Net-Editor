import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PetriNetPanel from '../../components/PetriNetPanel';
import { PetriNetContext } from '../../contexts/PetriNetContext';

describe('PetriNetPanel', () => {
  const renderWithCtx = (ui, ctx) => render(
    <PetriNetContext.Provider value={ctx}>{ui}</PetriNetContext.Provider>
  );

  test('renders PT markings as counts', () => {
    const elements = {
      places: [
        { id: 'p1', label: 'P1', tokens: 3 },
        { id: 'p2', label: 'P2', tokens: 0 },
      ],
      transitions: [],
    };

    renderWithCtx(
      <PetriNetPanel elements={elements} enabledTransitionIds={[]} />,
      { handleFireTransition: jest.fn(), netMode: 'pt' }
    );
    fireEvent.click(screen.getByTestId('toggle-markings'));
    expect(screen.getByTestId('current-marking')).toBeInTheDocument();
    expect(screen.getByText('P1')).toBeInTheDocument();
    // PT shows token count badge
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  test('renders algebraic markings as formatted tokens', () => {
    const elements = {
      places: [
        { id: 'p2', label: 'P2', tokens: 0, valueTokens: [1, 2, 3] },
      ],
      transitions: [],
    };

    renderWithCtx(
      <PetriNetPanel elements={elements} enabledTransitionIds={[]} />,
      { handleFireTransition: jest.fn(), netMode: 'algebraic-int' }
    );
    fireEvent.click(screen.getByTestId('toggle-markings'));
    const marking = screen.getByTestId('current-marking');
    expect(marking.textContent).toContain('P2');
    expect(marking.textContent).toContain('1, 2, 3');
  });

  test('enabled transitions panel renders and fires via onFire', () => {
    const elements = {
      places: [],
      transitions: [{ id: 't1', label: 'T1' }],
    };
    const handleFireTransition = jest.fn();
    renderWithCtx(
      <PetriNetPanel elements={elements} enabledTransitionIds={['t1']} />,
      { handleFireTransition, netMode: 'pt' }
    );
    fireEvent.click(screen.getByTestId('show-enabled-transitions'));
    const btn = screen.getByTestId('enabled-T1');
    fireEvent.click(btn);
    expect(handleFireTransition).toHaveBeenCalledWith('t1');
  });
});


