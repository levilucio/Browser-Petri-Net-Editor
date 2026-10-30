import { formulaNotation, formatHmlTerm } from './HmlFormula.js';

const bag = tokens => tokens?.length ? `⟦${tokens.map(formatHmlTerm).join(', ')}⟧` : '∅';
export const callNotation = stimulation => `${stimulation.method}(${Object.entries(stimulation.arguments || {}).map(([name, value]) => `${name}=${formatHmlTerm(value)}`).join(', ')})`;

export function markingRequirement(constraint) {
  if (constraint.equals !== undefined) return `equal ${bag(constraint.equals)}`;
  if (constraint.contains !== undefined) return `contain ${bag(constraint.contains)}, respecting multiplicity`;
  if (constraint.length !== undefined) return `contain exactly ${constraint.length} token(s)`;
  return constraint.empty ? 'be empty' : 'be non-empty';
}

/** Render the checker's first failed assertion, without guessing a model defect. */
export function observationMismatch(check) {
  if (!check || check.success) return null;
  if (check.reason === 'output_mismatch') return {
    code: 'output-mismatch',
    text: `At output channel ${check.place}, this firing reported ${bag(check.actual)}; the observation requires ${bag(check.expected)}. These are occurrences from this interaction, separate from the resulting marking.`,
  };
  if (check.reason === 'marking_constraint_failed') return {
    code: 'marking-mismatch',
    text: `Place ${check.place} has marking ${bag(check.actual)}; the assertion requires it to ${markingRequirement(check.constraint)}.`,
  };
  return { code: check.reason, text: 'The observation assertion does not hold.' };
}

/** Explain local truth, not whether this local truth is desirable. Negation and
 * expected-false tests can make a false subformula necessary for test success.
 * This is deterministic rendering of evidence, never an additional oracle.
 */
export function explainEvidence(node, formula) {
  const formal = formula ? `M[${node.path}] ${node.value === null ? '⊨ ?' : node.value ? '⊨' : '⊭'} ${formulaNotation(formula)}` : '';
  const explanation = (code, text) => ({ code, text, formal });
  if (node.reusedFrom) return explanation('reused-evidence', `This exact obligation and full marking were already decided at evidence ${node.reusedFrom}. Follow that evidence for the explanation.`);
  if (node.value === null) return explanation('incomplete-search', `Exploration did not establish whether this obligation holds. ${node.reason || 'At least one required search or continuation is unresolved.'} This is not proof of refusal or a wrong marking.`);
  if (node.op === 'marking') {
    const mismatch = observationMismatch(node.observationCheck);
    return explanation(mismatch?.code || (node.value ? 'marking-satisfied' : 'marking-mismatch'), mismatch?.text || (node.value ? 'All listed marking assertions hold in this state.' : 'A marking assertion fails in this state.'));
  }
  if (node.op === 'true' || node.op === 'false') return explanation('constant', node.value ? 'The constant ⊤ holds in every state.' : 'The constant ⊥ holds in no state.');
  if (node.op === 'not') return explanation('negation', `The inner requirement is ${!node.value}; negation therefore makes this requirement ${node.value}.${!node.value && formula?.child.op === 'diamond' ? ' This requirement forbids the possibility established by the witness below.' : ''}`);
  if (node.op === 'and') return explanation('conjunction', node.value ? 'Every requirement in this group holds at the same state.' : 'This group requires every requirement to hold at the same state. A requirement below is false, so the group is false.');
  if (node.op === 'or') return explanation('disjunction', node.value ? 'At least one requirement in this group holds at this state.' : 'None of the alternatives in this group holds at this state.');
  const call = callNotation(node.stimulation || formula.stimulation);
  if (node.op === 'diamond') {
    if (node.value) {
      const witness = node.branches?.find(b => b.child.value === true);
      const outputs = Object.entries(witness?.produced || {}).map(([place, tokens]) => `${place} ↦ ${bag(tokens)}`).join('; ');
      return explanation('enabled-witness', `${witness ? `Rule ${witness.transitionId} can fire ${call}${outputs ? `, producing ${outputs}` : ''}` : `A firing of ${call} exists`}. It satisfies the observation filter and its continuation. This one witness establishes possibility; other outcomes need not satisfy the requirement.`);
    }
    if (node.successorCount === 0 && node.complete) return explanation('call-unavailable', `No implementing transition with a valid token binding can fire ${call} in this marking. The required possibility is absent; the successor search is complete.`);
    if (!node.branches?.length) return explanation('no-matching-outcome', `${call} can fire, but none of its ${node.successorCount} distinct outcome${node.successorCount === 1 ? '' : 's'} satisfies ${formula?.excludeObservation ? 'the complemented observation filter' : 'the observation filter'}. The failure is in the requested observation, not call availability.`);
    return explanation('continuation-failure', `${call} can fire with a matching observation, but every matching outcome fails the continuation. Outcomes outside the filter cannot witness this possibility either. Follow the separate branches: they need not fail for the same reason.`);
  }
  if (!node.value) return explanation(formula?.child.op === 'false' ? 'forbidden-outcome' : 'universal-counterexample', formula?.child.op === 'false'
    ? `${call} has an outcome allowed by the observation filter. This box requires every such outcome to satisfy ⊥, so any such firing disproves it.`
    : `A firing of ${call} satisfies the observation filter but fails the continuation. This one counterexample disproves the requirement on every matching outcome.`);
  if (!node.branches?.length) return explanation('vacuous-truth', node.successorCount === 0
    ? `No firing of ${call} is enabled. The box is true because there are no matching outcomes to check. It does not require the call to be available.`
    : `${call} has enabled firings, but none satisfies the observation filter. The box is true because there are no matching outcomes to check; this does not establish a successful response.`);
  return explanation('all-continuations-satisfied', `Every outcome of ${call} that satisfies the observation filter also satisfies the continuation. The successor search is complete. Outcomes outside that filter are not constrained by this box.`);
}

/** Small, linked overview of the proof supporting the actual truth value.
 * Full evidence stays in the evaluator's DAG; reused obligations are not copied.
 * A failed existential can require several branches, not one linear trace.
 */
export function explainProperty(formula, result, expectedTruth = true) {
  const status = result.value === null ? 'inconclusive' : result.value === expectedTruth ? 'pass' : 'fail';
  const summary = status === 'inconclusive'
    ? `The test is inconclusive: expected ${expectedTruth}, but exploration could not establish the property's truth value. No failure or successful refusal has been proved.`
    : status === 'pass' ? `The property is ${result.value}, as expected.`
      : `The test fails: the property was expected to be ${expectedTruth}, but it is ${result.value}. ${expectedTruth ? 'The required behaviour is not satisfied.' : 'The requirement expected not to hold does hold. The evidence below establishes its truth.'}`;
  const findings = [];
  let omitted = 0;
  const add = (path, explanation) => {
    if (findings.length < 12) findings.push({ path, code: explanation.code, text: explanation.text });
    else omitted++;
  };
  const walk = (node, property) => {
    if (!node) return;
    const local = explainEvidence(node, property);
    if (node.reusedFrom || node.value === null || node.op === 'marking') { add(node.path, local); return; }
    if (node.children) {
      if (node.op === 'not') add(node.path, local);
      const decisive = node.op === 'and' && node.value === false || node.op === 'or' && node.value === true;
      node.children.forEach((child, i) => {
        if (!decisive || child.value === node.value) walk(child, property?.children?.[i] || property?.child);
      });
    } else if (node.branches) {
      add(node.path, local);
      // Rejected edges matter to absence of an existential witness; they are
      // outside a box's domain and are never labelled box counterexamples.
      if (node.op === 'diamond' && node.value === false) for (const branch of node.rejectedBranches || []) {
        const mismatch = observationMismatch(branch.observationCheck);
        if (mismatch && !property?.excludeObservation) add(`${node.path}.outcome-${branch.outcome}`, mismatch);
      }
      const decisive = node.op === 'diamond' && node.value === true || node.op === 'box' && node.value === false;
      for (const branch of node.branches) if (!decisive || branch.child.value === node.value) walk(branch.child, property?.child);
    }
  };
  walk(result.evidence, formula);
  return { status, summary, findings, omitted };
}
