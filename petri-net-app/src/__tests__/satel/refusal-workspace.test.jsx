import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdtProvider } from '../../contexts/AdtContext';
import IntentionEditor from '../../components/IntentionEditor';
import SymbolicIntentionEditor from '../../components/satel/SymbolicIntentionEditor';
import SatelTestDisplay from '../../components/SatelTestDisplay';
import { NegativeCoverage, TestGenerationExplanation } from '../../components/satel/GenerationExplanation';
import { createRefusalExample } from '../../satel/examples/refusal/editor';
import { compileSymbolicIntention } from '../../satel/core/SymbolicSource';
import { exportToPNML, importFromPNML } from '../../utils/python/index';

const net = () => createRefusalExample('refusal-quota-reference');
test('finite editor saves an explicit final refusal and displays its meaning', () => {
  let saved;
  function Harness() {
    const [value, setValue] = useState({ id: 'finite', name: 'Refuse zero', testType: 'positive', variables: [], pairs: [{ stimulation: { method: 'release', arguments: { n: 0 } }, observation: { outputs: {} } }] });
    return <IntentionEditor intention={value} onChange={setValue} onSave={() => { saved = value; }} onCancel={() => {}} elements={net()} />;
  }
  render(<AdtProvider><Harness /></AdtProvider>);
  fireEvent.change(screen.getByLabelText('Pair 1 expected response'), { target: { value: 'blocked' } });
  expect(screen.getByText(/final call must have no enabled rule/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  expect(saved.pairs[0].assertion).toBe('blocked');
});
test('symbolic refusal notation round-trips through the editor and PNML; nonterminal refusal prevents save', async () => {
  let saved;
  function Harness() {
    const [value, setValue] = useState(net().testIntentions[0]);
    return <SymbolicIntentionEditor intention={value} onChange={setValue} onSave={() => { saved = value; }} onCancel={() => {}} elements={net()} />;
  }
  render(<AdtProvider><Harness /></AdtProvider>);
  const editor = screen.getByLabelText('Sequence: zero');
  expect(editor.value).toContain('with refused');
  const original = editor.value;
  fireEvent.change(editor, { target: { value: original + ' .\n{ audit() with none }' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  fireEvent.change(editor, { target: { value: original } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  expect(compileSymbolicIntention(saved).protocol[0].pairs.at(-1).assertion).toBe('blocked');
  const restored = await importFromPNML(await exportToPNML({ ...net(), testIntentions: [saved] }));
  expect(restored.testIntentions).toEqual([saved]);
});
test('display explains refusal, unchanged marking and incomplete coverage without raw JSON', () => {
  const test = { id: 'negative', pairs: [{ assertion: 'blocked', stimulation: { method: 'release', arguments: { n: 0 } }, observation: { outputs: {} } }], referenceMarkings: [{ held: [0] }, { held: [0] }], negativeSelection: { seedId: 'seed', pair: 1, rules: [{ transitionId: 'release', bindings: 1 }], expectedMarking: { held: [0] } } };
  render(<><SatelTestDisplay test={test} /><TestGenerationExplanation test={test} /><NegativeCoverage report={{ attempts: [{ seedId: 'seed', pair: 1, method: 'release', status: 'unresolved', reason: 'Search budget exhausted' }], unresolved: [{}], truncated: true, limits: { maxTests: 10, maxAttempts: 40, maxTimeMs: 20000, maxBindings: 10000 }, visited: 10001 }} /></>);
  expect(screen.getByTestId('satel-pair-formula')).toHaveTextContent('refused; marking unchanged');
  expect(screen.getByText(/They may lie outside the original intention/)).toBeInTheDocument();
  expect(screen.getByText(/Unresolved searches produce no tests/)).toBeInTheDocument();
});
