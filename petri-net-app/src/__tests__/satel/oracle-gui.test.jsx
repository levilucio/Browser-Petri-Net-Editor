import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SatelTestDisplay from '../../components/SatelTestDisplay';
import SatelPanel from '../../components/SatelPanel';
import { usePetriNet } from '../../contexts/PetriNetContext';
import { createOracleAccountExample } from '../../satel/examples/oracle-account/editor';
import { generateTestSuite, executeTestSuite } from '../../satel';
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';

jest.mock('../../contexts/PetriNetContext', () => ({ usePetriNet: jest.fn() }));
const reference = () => createOracleAccountExample('oracle-account-reference');
let elements;
const setup = () => {
  elements = reference();
  usePetriNet.mockImplementation(() => ({ elements, setElements: jest.fn(), simulationSettings: { netMode: 'algebraic' } }));
  return render(<SatelPanel isOpen onClose={() => {}} />);
};
const generate = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Generate and validate on loaded reference' }));
  await screen.findByText(/tests passed the reference oracle/, {}, { timeout: 15000 });
};
beforeEach(() => localStorage.clear());

test('GUI preserves reference expectations across close/load and detects exact-balance mutant', async () => {
  const view = setup();
  await generate();
  expect(screen.getByText('4/4 tests passed the reference oracle')).toBeInTheDocument();
  expect(screen.getAllByText('Initial marking M₀')).toHaveLength(4);
  expect(screen.getByLabelText('SATEL Testing')).not.toHaveTextContent('HML(');
  expect(screen.getByLabelText('SATEL Testing')).not.toHaveTextContent('T ),');
  view.rerender(<SatelPanel isOpen={false} onClose={() => {}} />);
  elements = createOracleAccountExample('oracle-account-reject-exact-balance');
  view.rerender(<SatelPanel isOpen onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Replay frozen suite on loaded APN' }));
  const result = await screen.findByTestId('oracle-target-results');
  await waitFor(() => expect(result).toHaveTextContent('3 passed · 1 failed · 0 errors'));
  expect(result).toHaveTextContent('withdraw.amount.accept/affordable.equal: fail at step 2');
  expect(result).toHaveTextContent('Expected');
  expect(result).toHaveTextContent('Actual');
  expect(screen.getByText('4/4 tests passed the reference oracle')).toBeInTheDocument();
  elements = reference();
  view.rerender(<SatelPanel isOpen onClose={() => {}} />);
  expect(screen.queryByTestId('oracle-target-results')).not.toBeInTheDocument();
  expect(screen.getByText('Target changed. Replay to obtain current results.')).toBeInTheDocument();
});

test('coarse equations expose the surviving exact-balance mutant', async () => {
  const view = setup();
  fireEvent.change(screen.getByLabelText('Symbolic intention'), { target: { value: 'account-coarse' } });
  await generate();
  expect(screen.getByText('3/3 tests passed the reference oracle')).toBeInTheDocument();
  elements = createOracleAccountExample('oracle-account-reject-exact-balance');
  view.rerender(<SatelPanel isOpen onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Replay frozen suite on loaded APN' }));
  await waitFor(() => expect(screen.getByTestId('oracle-target-results')).toHaveTextContent('3 passed · 0 failed · 0 errors'));
  expect(screen.getByText('No difference detected by this suite.')).toBeInTheDocument();
});

test('a mutant cannot silently become a valid reference for equation-derived expectations', async () => {
  const view = setup();
  elements = createOracleAccountExample('oracle-account-no-debit');
  view.rerender(<SatelPanel isOpen onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Generate and validate on loaded reference' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Reference validation failed');
  expect(screen.queryByRole('button', { name: 'Replay frozen suite on loaded APN' })).not.toBeInTheDocument();
});

test('unsupported target is an error, never a mutation kill', async () => {
  const view = setup(); await generate();
  elements = reference(); elements.transitions[0].guard = 'unsupported(n)';
  view.rerender(<SatelPanel isOpen onClose={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Replay frozen suite on loaded APN' }));
  await waitFor(() => expect(screen.getByTestId('oracle-target-results')).toHaveTextContent('0 passed · 0 failed · 4 errors'));
  expect(screen.getByText('Execution error — not counted as a detected mutation.')).toBeInTheDocument();
});

test('editor offers only intentions and explicitly discards old cached payloads', () => {
  localStorage.setItem('satel-test-intentions', JSON.stringify([{ pathPattern: {} }]));
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Intentions' }));
  expect(screen.getByRole('button', { name: '+ Create Intention' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /V[12]/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Create Intention' }));
  expect(screen.queryByLabelText('Initial marking overrides (JSON)')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Add Pair' }));
  expect(screen.getByLabelText('Pair 1 method')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('old cached intention list was discarded');
  expect(localStorage.getItem('satel-test-intentions')).toBeNull();
});

const intention = {
  id: 'deposit', name: 'Deposit', testType: 'positive', variables: [],
  pairs: [{ stimulation: { method: 'deposit', arguments: { n: 10 } }, observation: { outputs: { ack: [1] } } }],
};

test('public API generates V2 without exploring the state space and executes with the same V2 checker', async () => {
  const forbiddenExplorer = { initialize: jest.fn(() => { throw new Error('No exploration allowed'); }) };
  const suite = await generateTestSuite([intention], reference(), forbiddenExplorer);
  expect(forbiddenExplorer.initialize).not.toHaveBeenCalled();
  expect(suite.statistics.statesExplored).toBe(0);
  expect(suite.statistics.pairStimulations).toBe(1);
  const results = await executeTestSuite(suite, reference(), new AlgebraicSimulator());
  expect(results.statistics).toMatchObject({ total: 1, passed: 1, failed: 0, errors: 0 });
});

test('V1 input is rejected by generation and execution, including mixed lists', async () => {
  await expect(generateTestSuite([intention, { id: 'old', pathPattern: { events: [] } }], reference(), {})).rejects.toThrow('Only intentions');
  const results = await executeTestSuite({ testCases: [{ id: 'old', expectedTrace: [] }] }, reference(), {});
  expect(results.statistics).toMatchObject({ passed: 0, errors: 1 });
});

test('notEnabled on an unknown transition is an error even in a negative test', async () => {
  const tc = { id: 'invalid-negative', testType: 'negative', oracle: { type: 'v2' }, pairs: [
    { stimulation: { transition: 'missing', inputs: {} }, observation: { type: 'notEnabled', outputs: {} } },
  ] };
  const result = await executeTestSuite({ testCases: [tc] }, reference(), new AlgebraicSimulator());
  expect(result.statistics).toMatchObject({ passed: 0, errors: 1 });
});


test('instantiated pairs show nested ADTs, repeated output tokens and empty checks without JSON encoding', () => {
  const order = { __adt__: true, constructor: 'Order', args: [10, { __adt__: true, constructor: 'High', args: [] }] };
  const tc = { testType: 'positive', instantiation: { order }, pairs: [{
    stimulation: { transition: 'receive', inputs: { incoming: [order] } },
    observation: { outputs: { ack: [1, 1], rejected: [] } },
  }] };
  const before = JSON.stringify(tc);
  const { container } = render(<SatelTestDisplay test={tc} />);
  expect(screen.getByLabelText('Instantiated variables')).toHaveTextContent('order ↦ Order(10, High())');
  expect(screen.getByTestId('satel-pair-formula')).toHaveTextContent('receive [incoming ↦ ⟦Order(10, High())⟧] with ack(1) // ack(1)');
  expect(screen.getByLabelText('Pair 1')).toHaveTextContent('No tokens produced at: rejected');
  expect(container).not.toHaveTextContent('__adt__');
  expect(container.querySelector('pre')).toBeNull();
  expect(JSON.stringify(tc)).toBe(before);
});

test('empty observations and unconstrained observations remain visually distinct', () => {
  render(<SatelTestDisplay test={{ pairs: [
    { stimulation: { transition: 'a', inputs: {} }, observation: { outputs: { out: [] } } },
    { stimulation: { transition: 'b', inputs: {} }, observation: { outputs: {} } },
  ] }} />);
  expect(screen.getAllByTestId('satel-pair-formula')[0]).toHaveTextContent('a with null');
  expect(screen.getByLabelText('Pair 1')).toHaveTextContent('No tokens produced at: out');
  expect(screen.getAllByTestId('satel-pair-formula')[1]).toHaveTextContent('b with unconstrained');
});
