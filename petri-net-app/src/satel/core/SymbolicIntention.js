import { instantiateFormula, sequenceFormula } from './HmlFormula.js';
import { symbolicToValue } from '../../utils/builtin-values.js';
import { compileSymbolicIntention, encodeProtocolWitness } from './SymbolicSource.js';
import { selectExecutableRepresentatives } from './ExecutableSequence.js';
import { deriveGenericSubdomains } from './GenericSubuniformity.js';
import { publicInterface } from './TestCase.js';
import { diagnostic } from '../../domain/diagnostics.js';
import { copy } from '../../domain/snapshots.js';
export async function deriveSymbolicIntention(intention, net, options = {}) {
  intention = copy(intention);
  net = copy(net);
  const {
    goal,
    protocol
  } = compileSymbolicIntention(intention);
  const decomposition = await deriveGenericSubdomains(goal, options);
  const report = {
    intention,
    symbolicGoal: goal,
    decomposition,
    candidates: [],
    interface: null,
    encodingError: null
  };
  if (!protocol) return report;
  try {
    report.interface = publicInterface(net);
    if (options.classesOnly) {
      report.candidates = decomposition.domains.map(d => ({
        ...encodeProtocolWitness(protocol, d.witnessArgs, d.witnessResult, report.interface, goal.algebra),
        id: d.id,
        symbolicDomain: d
      }));
      return report;
    }
    report.execution = await selectExecutableRepresentatives(goal, protocol, decomposition, net, report.interface, {
      ...options, branchingProperty: intention.branchingProperty, branchingExpectedTruth: intention.branchingExpectedTruth
    });
    report.candidates = report.execution.selected.map(d => ({
      ...encodeProtocolWitness(protocol, d.witnessArgs, d.witnessResult, report.interface, goal.algebra),
      id: d.id,
      symbolicDomain: d
    }));
    if (intention.branchingProperty) report.candidates = report.candidates.map(test => {
      const values = Object.fromEntries(Object.entries(test.symbolicDomain.witnessBindings).map(([n, term]) => [n, symbolicToValue(term)]));
      const { steps, expected, pairs, ...metadata } = test;
      const property = instantiateFormula(intention.branchingProperty, values);
      return { ...metadata, pairs: [], expectedTruth: true, formula: { op: 'and', children: [sequenceFormula(pairs), intention.branchingExpectedTruth === false ? { op: 'not', child: property } : property] },
        propertySelection: 'joint-sequence-and-hml', branchingExpectedTruth: intention.branchingExpectedTruth ?? true };
    });
  } catch (e) {
    if (e.code === 'cancelled') throw e;
    report.encodingError = e.message;
    report.diagnostic = diagnostic(e, 'selection');
  }
  return report;
}
// Historical API retained for external scripts.
export { admitIntention as admitSymbolicIntention } from './Admission.js';
