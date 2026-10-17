import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import IntentionEditor from '../../components/IntentionEditor';
import { parseObservationTokens, formatObservationTokens } from '../../components/satel/observationTerms';
import { accountNet } from '../../satel/examples/oracle-account/net';
import { instantiatePair } from '../../satel/core/VariableInstantiator';
import { executeV2TestCase } from '../../satel/core/ObservationChecker';
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';

const pair = { stimulation: { method: 'deposit', arguments: { n: 10 } }, observation: { outputs: {}, markings: {} } };
function Editor({ save, pairs = [pair] }) {
  const [intention, setIntention] = useState({ id: 'edit', name: 'Edit', variables: [], testType: 'positive', pairs });
  return <IntentionEditor intention={intention} elements={accountNet} onChange={setIntention} onSave={() => save(intention)} onCancel={() => {}} />;
}

test('place controls distinguish unchecked, empty outputs, and exact post-call markings', () => {
  const save = jest.fn(); render(<Editor save={save} />);
  expect(screen.queryByText(/Expected tokens produced \(JSON\)/)).toBeNull();
  fireEvent.click(screen.getByLabelText('Pair 1 check outputs at ack'));
  fireEvent.change(screen.getByLabelText('Pair 1 expected outputs at ack'), { target: { value: '1, 1' } });
  fireEvent.click(screen.getByLabelText('Pair 1 check outputs at paidAmount'));
  fireEvent.change(screen.getByLabelText('Pair 1 marking check at balance'), { target: { value: 'equals' } });
  fireEvent.change(screen.getByLabelText('Pair 1 expected marking at balance'), { target: { value: '$amount' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  expect(save.mock.calls[0][0].pairs[0].observation).toEqual({ outputs: { ack: [1, 1], paidAmount: [] }, markings: { balance: { equals: ['$amount'] } } });
});

test('incomplete token input remains visible and prevents saving a stale assertion', () => {
  const save = jest.fn(); render(<Editor save={save} />);
  fireEvent.click(screen.getByLabelText('Pair 1 check outputs at ack'));
  const input = screen.getByLabelText('Pair 1 expected outputs at ack');
  fireEvent.change(input, { target: { value: 'Order(1,' } });
  expect(input).toHaveValue('Order(1,');
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  fireEvent.change(input, { target: { value: 'Order(1, High())' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeEnabled();
  fireEvent.click(screen.getByLabelText('Pair 1 check outputs at ack'));
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  expect(save.mock.calls[0][0].pairs[0].observation.outputs).toEqual({});
});

test('blocked calls have a separate control and preserve inactive place assertions', () => {
  const save = jest.fn(); render(<Editor save={save} />);
  fireEvent.click(screen.getByLabelText('Pair 1 check outputs at ack'));
  fireEvent.change(screen.getByLabelText('Pair 1 expected outcome'), { target: { value: 'blocked' } });
  expect(screen.queryByLabelText('Pair 1 expected outputs at ack')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  expect(save.mock.calls[0][0].pairs[0].observation).toMatchObject({ type: 'notEnabled', outputs: { ack: [] } });
});

test('notation round-trips duplicate tokens, nested constructors, variables, lists and pairs', () => {
  const text = '1, 1, $n, Order(10, High()), "a,b", [true, false], (2, "x")';
  expect(formatObservationTokens(parseObservationTokens(text))).toBe(text);
  for (const invalid of ['1,', 'Order(1', 'Order(1)junk', 'bareName', '[1,]', '9007199254740993']) expect(() => parseObservationTokens(invalid)).toThrow();
});

test('parameterized exact marking checks include earlier tokens, respect multiplicity and reject missing places', async () => {
  const template = { stimulation: { method: 'deposit', arguments: { n: '$n' } }, observation: { outputs: { ack: [1] }, markings: { balance: { equals: ['$n'] }, ack: { equals: [1, 1] } } } };
  const instantiated = instantiatePair(template, { n: 10 });
  const net = JSON.parse(JSON.stringify(accountNet));
  net.places.find(p => p.id === 'ack').valueTokens = [1]; net.places.find(p => p.id === 'ack').tokens = 1;
  const run = p => executeV2TestCase({ id: 'marking', testType: 'positive', pairs: [p] }, net, new AlgebraicSimulator());
  expect((await run(instantiated)).verdict).toBe('pass');
  expect(template.observation.markings.balance.equals).toEqual(['$n']);
  const wrong = JSON.parse(JSON.stringify(instantiated)); wrong.observation.markings.ack.equals = [1];
  expect((await run(wrong)).verdict).toBe('fail');
  const missing = JSON.parse(JSON.stringify(instantiated)); missing.observation.outputs.missing = [];
  expect((await run(missing)).verdict).toBe('error');
});

test('removing a pair keeps the remaining pair draft and validation attached to it', () => {
  render(<Editor save={() => {}} pairs={[pair, pair]} />);
  fireEvent.click(screen.getByLabelText('Pair 2 check outputs at ack'));
  fireEvent.change(screen.getByLabelText('Pair 2 expected outputs at ack'), { target: { value: 'Order(' } });
  fireEvent.click(screen.getByLabelText('Remove pair 1'));
  expect(screen.getByLabelText('Pair 1 expected outputs at ack')).toHaveValue('Order(');
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Remove pair 1'));
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled(); // Empty sequences cannot be saved.
  fireEvent.click(screen.getByRole('button', { name: '+ Add Pair' }));
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeEnabled();
});
