import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import IntentionEditor from '../../components/IntentionEditor';
import SatelTestDisplay from '../../components/SatelTestDisplay';
import { AdtProvider } from '../../contexts/AdtContext';
import { createNondeterminismExample } from '../../satel/examples/nondeterminism/editor';
import { exportToPNML, importFromPNML } from '../../utils/python/index';
const net = () => createNondeterminismExample('nondeterminism-branch-reference');
test('branching editor saves nested obligations and expected false without JSON editing', async () => {
  let saved;
  function Harness() {
    const [value, setValue] = useState(net().testIntentions[0]);
    return <IntentionEditor intention={value} elements={net()} onChange={setValue} onSave={() => { saved = value; }} onCancel={() => {}} />;
  }
  render(<AdtProvider><Harness /></AdtProvider>);
  expect(screen.getByLabelText('Property 1.1 requirement')).toHaveValue('and');
  fireEvent.change(screen.getByLabelText('Property 1 requirement'), { target: { value: 'box' } });
  expect(screen.getByText(/This allows no matching outcome/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Expected property truth'), { target: { value: 'false' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  expect(saved.formula.op).toBe('box');
  expect(saved.expectedTruth).toBe(false);
  expect(saved.formula.child.children).toHaveLength(2);
  const restored = await importFromPNML(await exportToPNML({ ...net(), testIntentions: [saved] }));
  expect(restored.testIntentions).toEqual([saved]);
});
test('property observation token editing prevents save on syntax errors and recovers when filter removed', () => {
  function Harness() {
    const [value, setValue] = useState(net().testIntentions[0]);
    return <IntentionEditor intention={value} elements={net()} onChange={setValue} onSave={() => {}} onCancel={() => {}} />;
  }
  render(<AdtProvider><Harness /></AdtProvider>);
  fireEvent.change(screen.getByLabelText('Pair property 1 expected outputs at reply'), { target: { value: '[' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Property 1 observation filter'), { target: { value: 'any' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeEnabled();
});
test('display distinguishes target unknown from reference success and shows branching evidence', () => {
  const test = { ...net().testIntentions[0], referenceInitialMarking: { state: [0] }, referencePropertyResult: { value: true } };
  render(<SatelTestDisplay test={test} propertyResult={{ value: null, evidence: { op: 'diamond', path: '1', value: null, complete: false, successorCount: 1, branches: [], reason: 'Binding budget exhausted' }, stats: { successorSearches: 1, cacheHits: 0, evaluatedNodes: 1, durationMs: 5 } }} />);
  expect(screen.getByText('Target property: inconclusive')).toBeInTheDocument();
  expect(screen.getByText('Binding budget exhausted')).toBeInTheDocument();
  expect(screen.getByTestId('satel-hml-formula')).toHaveTextContent('∧');
  expect(screen.getByText(/1 distinct successors found; enumeration incomplete/)).toBeInTheDocument();
});
