import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import EnabledTransitionsPanel from '../../components/EnabledTransitionsPanel';

describe('EnabledTransitionsPanel', () => {
  test('does not render when closed', () => {
    const { container } = render(
      <EnabledTransitionsPanel enabledTransitions={[]} isLoading={false} isOpen={false} onClose={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders enabled transitions and fires on click', () => {
    const onFire = jest.fn();
    render(
      <EnabledTransitionsPanel
        enabledTransitions={[{ id: 't1', label: 'T1' }, { id: 't2', label: 'T2' }]}
        isLoading={false}
        isOpen={true}
        onClose={() => {}}
        onFire={onFire}
      />
    );
    const panel = screen.getByTestId('enabled-transitions');
    const t1 = within(panel).getByTestId('enabled-T1');
    const t2 = within(panel).getByTestId('enabled-T2');
    fireEvent.click(t1);
    fireEvent.click(t2);
    expect(onFire).toHaveBeenNthCalledWith(1, 't1');
    expect(onFire).toHaveBeenNthCalledWith(2, 't2');
  });

  test('close control is not counted among transition buttons', () => {
    render(
      <EnabledTransitionsPanel
        enabledTransitions={[{ id: 't1', label: 'T1' }]}
        isLoading={false}
        isOpen={true}
        onClose={() => {}}
      />
    );
    const panel = screen.getByTestId('enabled-transitions');
    const transitionButtons = within(panel).getAllByTestId(/enabled-/);
    expect(transitionButtons).toHaveLength(1);
  });

  test('close control calls onClose', () => {
    const onClose = jest.fn();
    render(
      <EnabledTransitionsPanel
        enabledTransitions={[]}
        isLoading={false}
        isOpen={true}
        onClose={onClose}
      />
    );
    const close = screen.getByLabelText('Close enabled transitions panel');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});


