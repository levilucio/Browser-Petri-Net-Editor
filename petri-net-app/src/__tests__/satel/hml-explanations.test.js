import { evaluateFormula, replayProperty } from '../../satel/core/HmlEvaluator.js';
import { explainProperty, explainEvidence } from '../../satel/core/HmlExplanation.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { createNondeterminismExample, modal } from '../../satel/examples/nondeterminism/editor.js';

const net = name => createNondeterminismExample(`nondeterminism-${name}`);
const check = (formula, model, options) => evaluateFormula(formula, model, publicInterface(model), options);
const nodes = node => [node, ...(node.children || []).flatMap(nodes), ...(node.branches || []).flatMap(b => nodes(b.child))];

test('an unavailable call is distinguished from enabled calls with wrong outputs', async () => {
  const blocked = net('bag-reference'); blocked.transitions[0].guard = 'false';
  const formula = modal('diamond', 'take', { picked: [99] });
  const refusal = await check(formula, blocked);
  expect(explainEvidence(refusal.evidence, formula)).toMatchObject({ code: 'call-unavailable' });
  expect(refusal.evidence).toMatchObject({ complete: true, successorCount: 0, beforeMarking: { stock: [1, 1, 2] } });
  const mismatch = await check(formula, net('bag-reference'));
  expect(mismatch.evidence.branches).toHaveLength(0);
  expect(mismatch.evidence.rejectedBranches).toHaveLength(2);
  expect(mismatch.evidence.rejectedBranches[0]).toMatchObject({ outcome: 1, transitionId: 'take', binding: { x: 1 }, marking: { stock: [1, 2] }, produced: { picked: [1] }, observationCheck: { reason: 'output_mismatch', place: 'picked', expected: [99], actual: [1] } });
  const explanation = explainProperty(formula, mismatch);
  expect(explanation.findings.map(f => f.code)).toEqual(['no-matching-outcome', 'output-mismatch', 'output-mismatch']);
  expect(explanation.findings[1].path).toBe('1.outcome-1');
});

test('post-marking failures retain their predicate, actual bag and full state', async () => {
  const formula = { ...modal('diamond', 'take', {}), observation: { outputs: {}, markings: { stock: { equals: [99] } } } };
  const result = await check(formula, net('bag-reference'));
  const branch = result.evidence.rejectedBranches[0];
  expect(branch.observationCheck).toEqual({ success: false, reason: 'marking_constraint_failed', place: 'stock', constraint: { equals: [99] }, actual: [1, 2] });
  expect(explainProperty(formula, result).findings[1]).toMatchObject({ code: 'marking-mismatch', text: expect.stringContaining('stock has marking ⟦1, 2⟧') });
  const stateFormula = { op: 'marking', markings: { stock: { length: 2 } } };
  const stateResult = await check(stateFormula, net('bag-reference'));
  expect(explainEvidence(stateResult.evidence, stateFormula).text).toContain('exactly 2 token(s)');
  expect(stateResult.evidence.marking.stock).toEqual([1, 1, 2]);
});

test('a reference-valid marking property detects the existing missing-duplicate mutant', async () => {
  const formula = net('bag-reference').testIntentions.find(i => i.id === 'bag-remaining-stock').formula;
  expect((await check(formula, net('bag-reference'))).value).toBe(true);
  const mutant = net('bag-multiplicity');
  const replay = await replayProperty({ id: 'remaining-stock', formula }, mutant, publicInterface(mutant));
  expect(replay.verdict).toBe('fail');
  expect(replay.propertyExplanation.findings).toContainEqual(expect.objectContaining({ code: 'marking-mismatch', text: 'Place stock has marking ⟦2⟧; the assertion requires it to equal ⟦1, 2⟧.' }));
});

test('same-trace mutant explains both failed continuations in different reached markings', async () => {
  const reference = net('branch-reference'), mutant = net('branch-early-choice');
  const formula = reference.testIntentions[0].formula;
  const replay = await replayProperty({ id: 'branch-both', formula }, mutant, publicInterface(reference));
  expect(replay.verdict).toBe('fail');
  expect(replay.propertyExplanation.findings[0].code).toBe('continuation-failure');
  const unavailable = nodes(replay.propertyResult.evidence).filter(n => n.successorCount === 0);
  expect(unavailable.map(n => [n.stimulation.method, n.beforeMarking.state])).toEqual([['left', [4]], ['right', [2]]]);
  expect(replay.propertyExplanation.findings.filter(f => f.code === 'call-unavailable')).toHaveLength(2);
});

test('missing-choice and missing-multiplicity mutants explain the later refusal after the valid prefix', async () => {
  const formula = net('bag-reference').testIntentions[0].formula;
  for (const mutation of ['missing-choice', 'multiplicity']) {
    const result = await check(formula, net(`bag-${mutation}`));
    expect(result.value).toBe(false);
    expect(explainProperty(formula, result).findings.some(f => f.code === 'call-unavailable' || f.code === 'no-matching-outcome')).toBe(true);
    expect(nodes(result.evidence).some(n => n.beforeMarking && n.path !== '1')).toBe(true);
  }
});

test('a negated possibility fails on the extra-output mutant with an enabling witness', async () => {
  const reference = net('bag-reference'), formula = reference.testIntentions[1].formula;
  const result = await check(formula, net('bag-extra-output'));
  expect(result.value).toBe(false);
  const modalEvidence = result.evidence.children[0];
  expect(modalEvidence.branches[0]).toMatchObject({ transitionId: 'takeBad', produced: { picked: [99] } });
  expect(explainProperty(formula, result).findings.map(f => f.code)).toEqual(['negation', 'enabled-witness']);
  expect(explainProperty(formula, result).findings[1].text).toContain('Rule takeBad can fire take(), producing picked ↦ ⟦99⟧');
  expect(explainEvidence(result.evidence, formula).text).toContain('inner requirement is true');
});

test('expected-false failure establishes truth, rather than inventing a bad firing or refusal', async () => {
  const reference = net('branch-reference'), test = reference.testIntentions[1];
  const replay = await replayProperty(test, net('branch-missing-restriction'), publicInterface(reference));
  expect(replay).toMatchObject({ verdict: 'fail', actualTruth: true, expectedTruth: false });
  expect(replay.propertyExplanation.summary).toContain('expected to be false, but it is true');
  expect(replay.propertyExplanation.findings[0].code).toBe('all-continuations-satisfied');
  expect(replay.propertyExplanation.findings.some(f => ['call-unavailable', 'output-mismatch'].includes(f.code))).toBe(false);
});

test('vacuous truth distinguishes disabled calls from enabled calls outside a box filter', async () => {
  const formula = modal('box', 'take', { picked: [99] }, { op: 'false' });
  const source = net('bag-reference');
  const enabled = await check(formula, source);
  expect(explainEvidence(enabled.evidence, formula)).toMatchObject({ code: 'vacuous-truth', text: expect.stringContaining('has enabled firings') });
  expect(explainProperty(formula, enabled, false).findings.map(f => f.code)).toEqual(['vacuous-truth']);
  source.transitions[0].guard = 'false';
  const disabled = await check(formula, source);
  expect(explainEvidence(disabled.evidence, formula).text).toContain('No firing of take() is enabled');
  expect(explainProperty(formula, disabled).status).toBe('pass');
});

test('complemented observations include mismatching outcomes and exclude matching ones', async () => {
  const formula = { ...modal('box', 'take', { picked: [1] }, { op: 'false' }), excludeObservation: true };
  const result = await check(formula, net('bag-reference'));
  expect(result.value).toBe(false);
  expect(result.evidence.rejectedBranches[0].observationCheck.success).toBe(true);
  expect(result.evidence.branches[0].observationCheck).toMatchObject({ success: false, expected: [1], actual: [2] });
  expect(explainEvidence(result.evidence, formula).code).toBe('forbidden-outcome');
  expect(explainProperty(formula, result).findings).toHaveLength(1);
});

test('partial searches do not turn observed mismatches into proofs of missing behaviour', async () => {
  const source = net('bag-reference'), formula = modal('diamond', 'take', { picked: [99] });
  const result = await check(formula, source, { maxBindings: 2 });
  expect(result.value).toBe(null);
  expect(result.evidence.rejectedBranches).toHaveLength(1);
  const explanation = explainProperty(formula, result, false);
  expect(explanation.status).toBe('inconclusive');
  expect(explanation.findings.map(f => f.code)).toEqual(['incomplete-search']);
});

test('decisive short circuit does not claim that unseen outcomes were checked', async () => {
  const source = net('bag-reference'), formula = modal('diamond', 'take', { picked: [1] });
  const result = await check(formula, source);
  expect(result.evidence).toMatchObject({ successorCount: 2, complete: true, rejectedBranches: [] });
  expect(result.evidence.branches).toHaveLength(1);
  expect(explainEvidence(result.evidence, formula).text).toContain('other outcomes need not satisfy');
});

test('shared proof links resolve to existing evidence, including through JSON round trips', async () => {
  const source = net('bag-reference');
  const formula = modal('box', 'take', null, modal('box', 'take', null, modal('box', 'take', null)));
  const result = JSON.parse(JSON.stringify(await check(formula, source)));
  const evidence = nodes(result.evidence), paths = new Set(evidence.map(n => n.path));
  const reused = evidence.filter(n => n.reusedFrom);
  expect(reused.length).toBeGreaterThan(0);
  expect(reused.every(n => paths.has(n.reusedFrom))).toBe(true);
  expect(explainProperty(formula, result, false).findings.some(f => f.code === 'reused-evidence')).toBe(true);
});
