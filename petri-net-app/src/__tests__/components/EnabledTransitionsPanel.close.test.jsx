import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import EnabledTransitionsPanel from '../../components/EnabledTransitionsPanel';

describe('EnabledTransitionsPanel close control', () => {
  test('onClose is called when clicking close icon', () => {
    const onClose = jest.fn();
    render(
      <EnabledTransitionsPanel
        enabledTransitions={[{ id: 't1', label: 'T1' }]}
        isLoading={false}
        isOpen={true}
        onClose={onClose}
        onFire={() => {}}
      />
    );
    const close = screen.getByLabelText('Close enabled transitions panel');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});


