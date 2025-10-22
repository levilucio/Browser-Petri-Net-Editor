import React from 'react';
import { render, screen } from '@testing-library/react';
import EnabledTransitionsPanel from '../../components/EnabledTransitionsPanel';

describe('EnabledTransitionsPanel empty state', () => {
  test('renders empty text when no enabled transitions', () => {
    render(<EnabledTransitionsPanel enabledTransitions={[]} isLoading={false} isOpen={true} onClose={() => {}} />);
    expect(screen.getByTestId('enabled-transitions')).toBeInTheDocument();
    expect(screen.getByText('No enabled transitions')).toBeInTheDocument();
  });
});


