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
      interface: intention.pairs.some(p => p.stimulation.method) ? publicInterface(net) : null,
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
  return {
    report,
    suite: await admitIntention(report, net, options)
  };
}
