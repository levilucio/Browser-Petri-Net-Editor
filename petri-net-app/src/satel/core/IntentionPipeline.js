import { selectNegativeCompanions } from './NegativeSelection.js';
import { validateOracleCandidates } from './ValidatedSubuniformity.js';
import { freeze } from '../../domain/snapshots.js';
import { deriveSymbolicIntention } from './SymbolicIntention.js';
import { selectExplicitIntention } from './ExplicitSelection.js';
import { normalizeTest, publicInterface } from './TestCase.js';
import { admitIntention } from './Admission.js';
import { copy } from '../../domain/snapshots.js';
import { checkCancelled } from '../../domain/diagnostics.js';

/** Common generation boundary. The policy chooses values; it cannot change
 * observation semantics, admission requirements or target replay behavior. */
export async function deriveIntention(intention, net, options = {}) {
  checkCancelled(options.signal);
  intention = copy(intention);
  net = copy(net);
  let report;
  if (intention.kind === 'symbolic') report = await deriveSymbolicIntention(intention, net, options);else {
    const selected = await selectExplicitIntention(intention, net, options);
    report = {
      intention,
      selectionPolicy: 'enumerate-fixed-values',
      interface: intention.formula || intention.pairs.some(p => p.stimulation.method) ? publicInterface(net) : null,
      candidates: selected
    };
  }
  report.candidates = report.candidates.map(test => normalizeTest(test, report.interface));
  checkCancelled(options.signal);
  return report;
}
export async function generateIntention(intention, net, options = {}) {
  const report = await deriveIntention(intention, net, options);
  options.onSelection?.(report);
  if (options.classesOnly) return {
    report
  };
  options.onPhase?.('Validating every candidate from the reference initial marking…');
  report.referenceResults = [];
  let suite = await admitIntention(report, net, { ...options, onValidation: result => {
    report.referenceResults.push(result);
    options.onSelection?.(report);
    options.onValidation?.(result);
  } });
  if (options.includeNegative) {
    options.onPhase?.('Selecting bounded refusal companions from validated prefixes…');
    report.negativeSelection = await selectNegativeCompanions(suite, options);
    report.candidates.push(...report.negativeSelection.candidates);
    options.onSelection?.(report);
    const negatives = report.negativeSelection.candidates.length ? await validateOracleCandidates({
      referenceNet: suite.referenceNet, io: suite.interface, candidates: report.negativeSelection.candidates, ...options
    }) : [];
    const selectedTests = [...suite.selectedTests, ...negatives];
    suite = freeze({ ...suite, selectedTests, negativeSelection: copy(report.negativeSelection),
      validation: { generated: selectedTests.length, referencePassed: selectedTests.length } });
  }
  return { report, suite };
}
