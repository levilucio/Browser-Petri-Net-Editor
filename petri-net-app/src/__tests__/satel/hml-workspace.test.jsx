import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import IntentionEditor from '../../components/IntentionEditor';
import SatelTestDisplay from '../../components/SatelTestDisplay';
import { AdtProvider } from '../../contexts/AdtContext';
import { createNondeterminismExample } from '../../satel/examples/nondeterminism/editor';
import { exportToPNML, importFromPNML } from '../../utils/python/index';
import HmlPropertyDisplay from '../../components/satel/HmlPropertyDisplay';
import { evaluateFormula } from '../../satel/core/HmlEvaluator';
import { publicInterface } from '../../satel/core/TestCase';
import { modal } from '../../satel/examples/nondeterminism/editor';
import { createHmlSelectionExample } from '../../satel/examples/hml-selection/editor';
import SymbolicIntentionEditor from '../../components/satel/SymbolicIntentionEditor';
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
  expect(screen.getByText(/This is also true when there are no matching outcomes/)).toBeInTheDocument();
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

test('plain-language output mismatch links open the exact rejected outcome and show its values', async () => {
  const source = createNondeterminismExample('nondeterminism-bag-reference');
  const formula = modal('diamond', 'take', { picked: [99] });
  const result = await evaluateFormula(formula, source, publicInterface(source));
  render(<HmlPropertyDisplay formula={formula} result={result} />);
  expect(screen.getByLabelText('Property explanation')).toHaveTextContent('can fire, but none');
  const link = screen.getByRole('link', { name: 'Evidence 1.outcome-1' });
  const outcome = document.getElementById(link.getAttribute('href').slice(1));
  expect(outcome.closest('details').open).toBe(false);
  fireEvent.click(link);
  expect(outcome.closest('details').open).toBe(true);
  expect(outcome).toHaveFocus();
  expect(outcome).toHaveTextContent('reported ⟦1⟧; the observation requires ⟦99⟧');
  expect(outcome).toHaveTextContent('x ↦ 1');
  expect(screen.getByText(/M\[1\] ⊭/)).toBeInTheDocument();
});

test('expected-false explanations and evidence ids remain separate across displayed tests', async () => {
  const source = createNondeterminismExample('nondeterminism-branch-missing-restriction');
  const formula = net().testIntentions[1].formula;
  const result = await evaluateFormula(formula, source, publicInterface(source));
  render(<><HmlPropertyDisplay formula={formula} expectedTruth={false} result={result} /><HmlPropertyDisplay formula={formula} expectedTruth={false} result={result} /></>);
  const links = screen.getAllByRole('link', { name: 'Evidence 1', exact: true });
  expect(links).toHaveLength(2);
  expect(links[0].getAttribute('href')).not.toBe(links[1].getAttribute('href'));
  expect(screen.getAllByLabelText('Property explanation')[0]).toHaveTextContent('expected to be false, but it is true');
  fireEvent.click(links[1]);
  expect(document.getElementById(links[1].getAttribute('href').slice(1))).toHaveFocus();
});

test('symbolic editor saves expected-false joint requirements and preserves them through PNML', async () => {
  const model = createHmlSelectionExample();
  let saved;
  function Harness() {
    const [value, setValue] = useState(model.testIntentions[0]);
    return <SymbolicIntentionEditor intention={value} elements={model} onChange={setValue} onSave={() => { saved = value; }} onCancel={() => {}} />;
  }
  render(<AdtProvider><Harness /></AdtProvider>);
  expect(screen.getByText(/jointly select one shared assignment/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Expected additional property truth'), { target: { value: 'false' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  expect(saved.branchingExpectedTruth).toBe(false);
  const restored = await importFromPNML(await exportToPNML({ ...model, testIntentions: [saved] }));
  expect(restored.testIntentions[0]).toEqual(saved);
});
