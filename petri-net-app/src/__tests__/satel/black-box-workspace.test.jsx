import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BlackBoxPanel from '../../components/satel/BlackBoxPanel.jsx';
import { createNondeterminismExample } from '../../satel/examples/nondeterminism/editor.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';

test('workspace uses saved reference, renders readable pairs, and reports multiplicity fault', async () => {
  const net = createNondeterminismExample('nondeterminism-bag-reference');
  const { suite } = await generateIntention(net.testIntentions[0], net);
  render(<BlackBoxPanel session={{ suite, referenceName: 'Frozen bag', intentionName: 'Take three tokens' }} />);
  fireEvent.change(screen.getByLabelText('Black-box repetitions'), { target: { value: '4' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run black-box campaign' }));
  await waitFor(() => expect(screen.getByTestId('black-box-summary')).toHaveTextContent('4 compatible executions · 0 observable mismatches'));
  expect(screen.getByLabelText('Observed black-box execution')).toHaveTextContent('take() with picked(');
  expect(screen.getByLabelText('Observed black-box execution')).toHaveTextContent('inconclusive');
  fireEvent.change(screen.getByLabelText('Black-box system'), { target: { value: 'bag-missing-duplicate' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run black-box campaign' }));
  await waitFor(() => expect(screen.getByTestId('black-box-summary')).toHaveTextContent('4 observable mismatches'));
  expect(screen.getByLabelText('Observed black-box execution')).toHaveTextContent('every compatible reference state accepts it');
  expect(screen.getByText(/Saved reference:/).closest('p')).toHaveTextContent('Frozen bag');
});

test('changing saved suites clears campaign evidence and no-suite guidance is visible', async () => {
  const { rerender } = render(<BlackBoxPanel session={null} />);
  expect(screen.getByText(/Generate tests first/)).toBeInTheDocument();
  const net = createNondeterminismExample('nondeterminism-bag-reference'), { suite } = await generateIntention(net.testIntentions[1], net);
  rerender(<BlackBoxPanel session={{ suite }} />);
  fireEvent.change(screen.getByLabelText('Black-box system'), { target: { value: 'bag-wrong-output' } });
  fireEvent.click(screen.getByRole('button', { name: 'Run black-box campaign' }));
  await waitFor(() => expect(screen.getByTestId('black-box-summary')).toHaveTextContent('16 counterexamples'));
  rerender(<BlackBoxPanel session={null} />);
  expect(screen.queryByTestId('black-box-summary')).not.toBeInTheDocument();
});
