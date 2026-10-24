import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { compileSymbolicIntention, importSymbolicADTXml } from '../../satel/core/SymbolicSource';
import { createSymbolicListIntention, createSymbolicListExample } from '../../satel/examples/symbolic-list/editor';
import { createOracleAccountExample } from '../../satel/examples/oracle-account/editor';
import { exportToPNML, importFromPNML } from '../../utils/python/index';
import { AdtProvider } from '../../contexts/AdtContext';
import SymbolicIntentionEditor from '../../components/satel/SymbolicIntentionEditor';

const xml = `<algebraicDataTypes><type name="NatList">
<constructor name="Nil" arity="0"/>
<constructor name="Cons" arity="2"><param index="0" type="Nat"/><param index="1" type="NatList"/></constructor>
<operation name="member" arity="2" result="Bool"><param index="0" type="Nat"/><param index="1" type="NatList"/></operation>
<axioms><axiom name="member.nil">member(x, Nil()) = false</axiom>
<axiom name="member.head">member(x, Cons(y, ys)) = true if x == y</axiom>
<axiom name="member.tail">member(x, Cons(y, ys)) = member(x, ys) if x != y</axiom></axioms>
</type></algebraicDataTypes>`;

test('imports typed custom editor ADT XML without losing constructor parameters or conditional equations', () => {
  const intention = createSymbolicListIntention();
  intention.symbolic.source = importSymbolicADTXml(xml);
  const { goal } = compileSymbolicIntention(intention);
  expect(goal.algebra.constructors.Cons.parameters).toEqual(['Nat', 'NatList']);
  expect(goal.algebra.operations.member.parameters).toEqual(['Nat', 'NatList']);
  expect(goal.algebra.operations.member.rules[2]).toMatchObject({ variables: { x: 'Nat', y: 'Nat', ys: 'NatList' }, result: { call: 'member' } });
  expect(() => importSymbolicADTXml(xml.replace('member(x, Nil()) = false', 'Nil() = Cons(0, Nil())'))).toThrow('not an oriented');
  expect(() => importSymbolicADTXml(xml.replace('<param index="1" type="NatList"/>', ''))).toThrow('Missing typed parameters');
});

test('invalid source remains editable, disables Save, and XML import replaces it explicitly', () => {
  function Harness() {
    const [intention, setIntention] = useState(createSymbolicListIntention());
    return <AdtProvider><SymbolicIntentionEditor intention={intention} onChange={setIntention} elements={{ adtDefinitions: xml }} onSave={() => {}} onCancel={() => {}} /></AdtProvider>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByText('Advanced selection settings', { exact: true }));
  fireEvent.change(screen.getByLabelText('ADT constructors and operation equations'), { target: { value: 'constructor ' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
  expect(screen.getByLabelText('ADT constructors and operation equations')).toHaveValue('constructor ');
  fireEvent.click(screen.getByRole('button', { name: 'Import custom editor ADT XML' }));
  expect(screen.getByRole('button', { name: 'Save Intention' })).not.toBeDisabled();
  fireEvent.change(screen.getByLabelText('Unfolding budget'), { target: { value: '0' } });
  expect(screen.getByRole('button', { name: 'Save Intention' })).toBeDisabled();
});

test('account and list symbolic definitions, edited budgets and pair protocols survive real PNML save/reload', async () => {
  for (const net of [createOracleAccountExample('oracle-account-reference'), createSymbolicListExample()]) {
    net.testIntentions[0].symbolic.maxDepth = 3;
    const saved = await exportToPNML(net), loaded = await importFromPNML(saved);
    expect(loaded.testIntentions).toEqual(net.testIntentions);
    expect(compileSymbolicIntention(loaded.testIntentions[0]).goal.maxDepth).toBe(3);
  }
});

test('guard editor imports a transition snapshot with shared variable declarations and saves it through PNML', async () => {
  const { createCompoundGuardExample, createGuardIntention } = await import('../../satel/examples/compound-guard/editor');
  const net = createCompoundGuardExample();
  let saved;
  function Harness() {
    const [intention, setIntention] = useState(createGuardIntention());
    return <AdtProvider><SymbolicIntentionEditor intention={intention} onChange={setIntention} elements={net} onSave={() => { saved = intention; }} onCancel={() => {}} /></AdtProvider>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByText('Advanced selection settings', { exact: true }));
  expect(screen.getByLabelText('Symbolic guard')).toHaveValue('x > 0 and (x < 5 or x == 10)');
  fireEvent.change(screen.getByLabelText('Import transition guard'), { target: { value: 'refuse' } });
  expect(screen.getByLabelText('Symbolic guard')).toHaveValue('not (x > 0 and (x < 5 or x == 10))');
  expect(screen.getByLabelText('Symbolic goal variables')).toHaveValue('x: Int');
  expect(screen.getByLabelText('Symbolic pair protocol')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Save Intention' }));
  const loaded = await importFromPNML(await exportToPNML({ ...net, testIntentions: [saved] }));
  expect(loaded.testIntentions[0]).toEqual(saved);
  expect(compileSymbolicIntention(loaded.testIntentions[0]).goal.algebra.operations._guardGoal.result).toBe('Bool');
});
