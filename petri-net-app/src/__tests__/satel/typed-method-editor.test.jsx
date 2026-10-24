import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import IntentionEditor from '../../components/IntentionEditor';
import PublicMethodEditor from '../../components/panel/PublicMethodEditor';
import { createTypedStoreExample } from '../../satel/examples/typed-store/editor';
import { exportToPNML, importFromPNML } from '../../utils/python/index';
import { instantiatePair } from '../../satel/core/VariableInstantiator';
import { executeV2TestCase } from '../../satel/core/ObservationChecker';
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';

const pair = (fst, snd) => ({ __pair__: true, fst, snd });

test('all public parameter sorts are selectable in the method editor', () => {
  const net = createTypedStoreExample(), save = jest.fn();
  render(<PublicMethodEditor transition={net.transitions[0]} elements={net} setElements={save} />);
  const options = [...screen.getByLabelText('Parameter 1 sort').options].map(o => o.value);
  expect(options).toEqual(['Nat', 'Int', 'Bool', 'String', 'Pair', 'List']);
  fireEvent.click(screen.getByRole('button', { name: 'Save method' }));
  expect(save.mock.calls[0][0].transitions[0].method).toEqual(net.transitions[0].method);
});

test('rich intention arguments preserve drafts, literal dollar strings and nested variables through execution', async () => {
  const net = createTypedStoreExample(); let saved;
  function Harness() {
    const [intention, setIntention] = useState({ id: 'i', name: 'i', testType: 'positive', variables: [], pairs: [{ stimulation: { method: 'store', arguments: { items: [], label: '', enabled: true, meta: pair('', false) } }, observation: { outputs: { ack: [true] } } }] });
    return <IntentionEditor intention={intention} elements={net} onChange={setIntention} onSave={() => { saved = intention; }} onCancel={() => {}} />;
  }
  render(<Harness />);
  fireEvent.change(screen.getByLabelText('Pair 1 argument items'), { target: { value: '[1,' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Pair 1 argument items'), { target: { value: '[1, $flag, ("x", [2])]' } });
  fireEvent.change(screen.getByLabelText('Pair 1 argument label'), { target: { value: '"$cash"' } });
  fireEvent.change(screen.getByLabelText('Pair 1 argument meta'), { target: { value: '("$cash", false)' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  const instantiated = instantiatePair(saved.pairs[0], { flag: true });
  expect(instantiated.stimulation.arguments.label).toBe('$cash');
  expect(instantiated.stimulation.arguments.items).toEqual([1, true, pair('x', [2])]);
  const result = await executeV2TestCase({ id: 'typed', testType: 'positive', pairs: [instantiated] }, net, new AlgebraicSimulator());
  expect(result.verdict).toBe('pass');
});

test('PNML preserves nested List/Pair markings, escaped UTF-16 strings, signatures and symbolic intentions', async () => {
  const net = createTypedStoreExample();
  net.places[0].valueTokens = [[pair([1, 'a,b', '\\'], pair('quoted\'"', false)), '\ud800', '\u0000', '\uffff', '😀']];
  net.places.find(p => p.id === 'labelOut').valueTokens = ['$cash', '', '\n\r\t', '\ufffe']; net.places.find(p => p.id === 'labelOut').tokens = 4;
  const loaded = await importFromPNML(await exportToPNML(net));
  expect(loaded.places.map(p => p.valueTokens)).toEqual(net.places.map(p => p.valueTokens));
  expect(loaded.transitions.map(t => t.method)).toEqual(net.transitions.map(t => t.method));
  expect(loaded.testIntentions).toEqual(net.testIntentions);
  const sim = new AlgebraicSimulator(); await sim.initialize(loaded);
  expect((await sim.invokeMethod('read')).produced.saved).toEqual(net.places[0].valueTokens);
});

test('unprintable String witnesses use readable, lossless escapes in pairs and editor terms', async () => {
  const { formatSatelTerm } = await import('../../components/SatelTestDisplay');
  const { formatSymbolicTerm } = await import('../../satel/core/SymbolicTerms');
  const { formatObservationToken, parseObservationTokens } = await import('../../components/satel/observationTerms');
  const value = 'a\uffff\ue000\u200b😀';
  const quoted = '"a\\uffff\\ue000\\u200b😀"';
  expect(formatSatelTerm(value)).toBe(quoted);
  expect(formatSymbolicTerm(value)).toBe(quoted);
  expect(formatObservationToken(value)).toBe(quoted);
  expect(parseObservationTokens(quoted)).toEqual([value]);
});
