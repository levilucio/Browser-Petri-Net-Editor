import { compileSymbolicIntention, encodeProtocolWitness } from './SymbolicSource.js';
import { selectExecutableRepresentatives } from './ExecutableSequence.js';
import { deriveGenericSubdomains } from './GenericSubuniformity.js';
import { validateOracleCandidates } from './ValidatedSubuniformity.js';
import { getPublicMethods } from '../../features/simulation/PublicMethods.js';

const copy = x => JSON.parse(JSON.stringify(x));
function freeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; }
export async function deriveSymbolicIntention(intention, net, options = {}) {
  intention = copy(intention); net = copy(net);
  const { goal, protocol } = compileSymbolicIntention(intention);
  const decomposition = await deriveGenericSubdomains(goal, options);
  const report = { intention, symbolicGoal: goal, decomposition, candidates: [], interface: null, encodingError: null };
  if (!protocol) return report;
  try {
    report.interface = { methods: getPublicMethods(net).map(({ name, parameters }) => ({ name, parameters })), outputs: net.places.filter(p => p.io_type === 'output').map(p => p.id), outputSorts: Object.fromEntries(net.places.filter(p => p.io_type === 'output').map(p => [p.id, p.sort])) };
    if (options.classesOnly) {
      report.candidates = decomposition.domains.map(d => ({ ...encodeProtocolWitness(protocol, d.witnessArgs, d.witnessResult, report.interface), id: d.id, symbolicDomain: d }));
      return report;
    }
    report.execution = await selectExecutableRepresentatives(goal, protocol, decomposition, net, report.interface, options);
    decomposition.domains = decomposition.domains.map(d => report.execution.selected.find(s => s.id === d.id) || d);
    report.candidates = report.execution.selected.map(d => ({ ...encodeProtocolWitness(protocol, d.witnessArgs, d.witnessResult, report.interface), id: d.id, symbolicDomain: d }));
  } catch (e) { report.encodingError = e.message; }
  return report;
}
export async function admitSymbolicIntention(report, net) {
  // All data are snapshotted before asynchronous reference execution.
  report = copy(report); net = copy(net);
  if (report.encodingError) throw new Error(report.encodingError);
  if (!report.execution) throw new Error('Generate executable sequences before admitting a suite.');
  if (report.execution?.unresolved.length) throw new Error('Executable selection is unresolved. Inspect the sequence search diagnostics.');
  if (report.execution?.blocked.length) throw new Error('Reference validation failed: some algebraic classes have no executable complete sequence. No partial suite admitted.');
  if (!report.interface) throw new Error('This intention has no APN stimulation/observation protocol');
  if (report.decomposition.unresolved.length) throw new Error('Unresolved symbolic branches remain. Resolve them before admitting a suite.');
  if (report.decomposition.overlaps.length) throw new Error('Classes overlap, or disjointness could not be established. No suite admitted.');
  if (!report.candidates.length) throw new Error('No executable tests were selected.');
  const selectedTests = await validateOracleCandidates({ referenceNet: net, io: report.interface, candidates: report.candidates });
  return freeze({ schemaVersion: 6, executionSemantics: 'public-methods-with-model-initial-marking',
    scope: 'typed-equation-classes-with-whole-sequence-selection', symbolicGoal: report.symbolicGoal,
    selection: report.execution, intention: report.intention, decomposition: report.decomposition, interface: report.interface, referenceNet: net,
    selectedTests, validation: { generated: report.candidates.length, referencePassed: selectedTests.length } });
}
