import React, { useState } from 'react';
import { AdtProvider } from '../../contexts/AdtContext';
import { fireEvent, render, screen } from '@testing-library/react';
import IntentionEditor from '../../components/IntentionEditor';
import SymbolicIntentionEditor from '../../components/satel/SymbolicIntentionEditor';
import { createOracleAccountExample } from '../../satel/examples/oracle-account/editor';
import { compileSymbolicIntention } from '../../satel/core/SymbolicSource';
import { protocolCases, replaceProtocolSequence, intentionNotation } from '../../satel/core/IntentionNotation';
import { generateTestSuite, executeTestSuite } from '../../satel';
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';
import { exportToPNML, importFromPNML } from '../../utils/python/index';

const net = () => createOracleAccountExample('oracle-account-reference');
const intention = () => ({ id: 'finite-deposit', name: 'Deposit and observe', testType: 'positive',
  variables: [{ name: 'amount', sort: 'Nat', hypothesis: { type: 'finite', values: [0, 5, 10] } }],
  conditionsText: 'amount > 0 and amount <= 5',
  pairs: [
    { stimulation: { method: 'deposit', arguments: { n: '$amount' } }, observation: { outputs: { ack: [1] } } },
    { stimulation: { method: 'query', arguments: {} }, observation: { outputs: { balanceResult: ['$amount'] } } },
  ],
});

test('finite values and explicit conditions select candidates before reference execution, and persist through PNML', async () => {
  const source = intention();
  const restored = await importFromPNML(await exportToPNML({ ...net(), testIntentions: [source] }));
  expect(restored.testIntentions).toEqual([source]);
  const suite = await generateTestSuite(restored.testIntentions, restored, {});
  expect(suite.oracleValidated).toBe(false);
  expect(suite.statistics.statesExplored).toBe(0);
  expect(suite.testCases.map(t => t.instantiation)).toEqual([{ amount: 5 }]);
  const result = await executeTestSuite(suite, restored, new AlgebraicSimulator());
  expect(result.statistics).toMatchObject({ passed: 1, failed: 0, errors: 0 });
  const mutant = createOracleAccountExample('oracle-account-wrong-initial-balance');
  expect((await executeTestSuite(suite, mutant, new AlgebraicSimulator())).statistics).toMatchObject({ passed: 0, failed: 1 });
  expect(intentionNotation(source)).toContain('deposit(n=$amount) with ack(1)');
});

test('an explicit representative rejected by a condition is not silently replaced or declared exhaustive', async () => {
  const source = intention(); source.variables[0].hypothesis = { type: 'uniformity', representative: 0 };
  await expect(generateTestSuite([source], net(), {})).rejects.toThrow('No candidates');
  expect(intentionNotation(source)).toContain('representative=0');
  source.conditionsText = 'unknown > 0';
  await expect(generateTestSuite([source], net(), {})).rejects.toThrow();
});

test('finite domains enforce sorts and a bounded Cartesian product', async () => {
  const source = intention(); source.variables[0].hypothesis.values = [-1];
  await expect(generateTestSuite([source], net(), {})).rejects.toThrow('well-sorted');
  source.conditionsText = '';
  source.variables = ['a', 'b'].map(name => ({ name, sort: 'Nat', hypothesis: { type: 'finite', values: Array.from({ length: 101 }, (_, i) => i) } }));
  await expect(generateTestSuite([source], net(), {})).rejects.toThrow('10,000');
});

test('symbolic sequence notation preserves case bindings and compiles after editing, including nested terms and delimiter strings', () => {
  const source = net().testIntentions[0];
  const cases = protocolCases(source.symbolic.protocolSource);
  expect(cases[1].pairs[1]).toBe('{ withdraw(n=n) with ack(1) // paidAmount(paid) }');
  const updated = replaceProtocolSequence(source.symbolic.protocolSource, 1, cases[1].pairs.join(' .\n').replace('query()', 'query()'));
  expect(protocolCases(updated)).toEqual(cases);
  expect(updated).toContain('# Unmentioned public output places produce no tokens in each pair.');
  const markingIntention = intention(); markingIntention.pairs[0].observation.markings = { balance: { equals: ['$amount'] } };
  expect(intentionNotation(markingIntention)).toContain('[marking: balance = ⟦$amount⟧]');
  expect(compileSymbolicIntention({ ...source, symbolic: { ...source.symbolic, protocolSource: updated } }).protocol).toEqual(compileSymbolicIntention(source).protocol);
  const nested = 'case typed(x: String):\ninputs x\nresult x\npair store(label="a // b with c", items=[1, ("x,y", false)]) => echoed([1, ("x,y", false)]), labelOut("a // b with c")';
  const parsed = protocolCases(nested);
  expect(protocolCases(replaceProtocolSequence(nested, 0, parsed[0].pairs.join('\n')))).toEqual(parsed);
});

test('main symbolic editor shows sequences first, retains invalid drafts, and saves edited sequences with bindings intact', () => {
  let saved;
  const original = net().testIntentions[0];
  function Harness() {
    const [value, setValue] = useState(original);
    return <SymbolicIntentionEditor intention={value} onChange={setValue} elements={net()} onSave={() => { saved = value; }} onCancel={() => {}} />;
  }
  render(<AdtProvider><Harness /></AdtProvider>);
  expect(screen.getByText('Advanced selection settings').parentElement).not.toHaveAttribute('open');
  const sequence = screen.getByLabelText('Sequence: paid');
  const text = sequence.value;
  fireEvent.change(sequence, { target: { value: text.replace('withdraw(n=n)', 'withdraw(n=') } });
  expect(sequence.value).toContain('withdraw(n=');
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  fireEvent.change(sequence, { target: { value: text.replace('ack(1) // paidAmount(paid)', 'ack(0) // paidAmount(paid)') } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  expect(saved.symbolic.protocolSource).toContain('withdraw(n=n) => ack(0), paidAmount(paid)');
  expect(protocolCases(saved.symbolic.protocolSource).map(c => c.header)).toEqual(protocolCases(original.symbolic.protocolSource).map(c => c.header));
});

test('finite value editor retains invalid drafts and literal strings beginning with $, and conditions disable Save on errors', () => {
  let saved;
  function Harness() {
    const source = intention(); source.variables = [{ name: 'label', sort: 'String', hypothesis: { type: 'finite', values: ['$cash'] } }]; source.conditionsText = '';
    const [value, setValue] = useState(source);
    return <IntentionEditor intention={value} onChange={setValue} elements={net()} onSave={() => { saved = value; }} onCancel={() => {}} />;
  }
  render(<AdtProvider><Harness /></AdtProvider>);
  expect(screen.getByLabelText('label values')).toHaveValue('"$cash"');
  fireEvent.change(screen.getByLabelText('label values'), { target: { value: '$cash' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('label values'), { target: { value: '"$cash", "ok"' } });
  fireEvent.change(screen.getByLabelText('Intention conditions'), { target: { value: 'label ==' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Intention conditions'), { target: { value: 'label == "$cash"' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  expect(saved.variables[0].hypothesis.values).toEqual(['$cash', 'ok']);
});
