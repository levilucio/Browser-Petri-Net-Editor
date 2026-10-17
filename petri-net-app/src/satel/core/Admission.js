import { validateOracleCandidates } from './ValidatedSubuniformity.js';
import { copy, freeze } from '../../domain/snapshots.js';

/** Admission has one meaning for all selection policies: every fixed candidate
 * must pass concrete reference replay. Selection uncertainty is never hidden. */
export async function admitIntention(report, net, options = {}) {
  report = copy(report);
  net = copy(net);
  if (report.encodingError) throw new Error(report.encodingError);
  if (report.symbolicGoal) {
    if (!report.execution) throw new Error('Generate executable sequences before admitting a suite.');
    if (report.execution.unresolved.length) throw new Error('Executable selection is unresolved. Inspect the sequence search diagnostics.');
    if (report.execution.blocked.length) throw new Error('Reference validation failed: some algebraic classes have no executable complete sequence. No partial suite admitted.');
    if (!report.interface) throw new Error('This intention has no APN stimulation/observation protocol');
    if (report.decomposition.unresolved.length) throw new Error('Unresolved symbolic branches remain. Resolve them before admitting a suite.');
    if (report.decomposition.overlaps.length) throw new Error('Classes overlap, or disjointness could not be established. No suite admitted.');
  }
  if (!report.candidates.length) throw new Error('No executable tests were selected.');
  const selectedTests = await validateOracleCandidates({
    referenceNet: net,
    io: report.interface,
    candidates: report.candidates,
    ...options
  });
  return freeze({
    schemaVersion: 7,
    executionSemantics: report.intention.formula ? 'bounded-hml-from-initial-marking' : 'continuous-sequence-from-initial-marking',
    scope: report.symbolicGoal ? 'typed-equation-classes-with-whole-sequence-selection' : 'fixed-finite-values',
    symbolicGoal: report.symbolicGoal,
    selection: report.execution,
    intention: report.intention,
    decomposition: report.decomposition,
    interface: report.interface,
    referenceNet: net,
    selectedTests,
    oracleValidated: true,
    validation: {
      generated: report.candidates.length,
      referencePassed: selectedTests.length
    }
  });
}
