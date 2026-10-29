import { emptyGates, getGates } from '../../domain/apn/Gates.js';
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator.js';
import { isMethodRule } from '../../domain/apn/PublicMethods.js';
import { initialMarkingOf, withInitialMarking } from './InitialMarking.js';
import { publicInterface } from './TestCase.js';
import { inputSelector } from './DirectTransitionDriver.js';
import { copy } from '../../domain/snapshots.js';
import { checkCancelled, DomainError } from '../../domain/diagnostics.js';
export function checkInterface(net, io) {
  const actual = publicInterface(net);
  const signatures = methods => JSON.stringify([...methods].sort((a, b) => a.name.localeCompare(b.name)));
  if (!Array.isArray(io.methods) || signatures(actual.methods) !== signatures(io.methods)) throw new DomainError('interface-mismatch', 'Public method interface does not match the saved contract');
  if (Object.hasOwn(io, 'gates')) {
    // Gate formal names are documentation: occurrences carry ordered arguments.
    // Method formal names remain significant because calls use a named map.
    const gateSignatures = gates => signatures(gates.map(g => ({ name: g.name, sorts: g.parameters.map(p => p.sort) })));
    let declared;
    try { declared = getGates({ gates: io.gates }); }
    catch { throw new DomainError('interface-mismatch', 'Malformed gate signatures in the saved contract'); }
    if (gateSignatures(actual.gates || []) !== gateSignatures(declared)) throw new DomainError('interface-mismatch', 'Gate signatures do not match the saved contract');
  } else if (actual.gates?.some(g => g.parameters.length !== 1)) {
    throw new DomainError('interface-mismatch', 'Zero- and multi-argument gates require explicit signatures in the saved contract');
  }
  if (!Array.isArray(io.outputs) || new Set(io.outputs).size !== io.outputs.length || io.outputs.some(id => !actual.outputs.includes(id))) throw new DomainError('interface-mismatch', 'Invalid public output interface');
  if (io.outputSorts && io.outputs.some(id => io.outputSorts[id] !== actual.outputSorts[id])) throw new DomainError('interface-mismatch', 'Public output sorts do not match the saved contract');
}

/** Single continuous execution. onStep is called BEFORE the next stimulation.
 * Recording and checking use this driver, but only checking admits tests. */
export async function runSequence(net, pairs, io, options = {}) {
  net = copy(net);
  pairs = copy(pairs);
  if (!pairs.length) throw new DomainError('invalid-test', 'A nonempty method-call sequence is required');
  const methods = pairs.some(p => p.stimulation.method);
  if (methods) {
    if (options.initialMarking !== undefined || pairs.some(p => !p.stimulation.method)) throw new DomainError('invalid-test', 'Method tests cannot override the model initial marking or mix direct transition steps');
    if (!['algebraic', 'algebraic-int'].includes(net.mode)) throw new DomainError('unsupported-model', 'An algebraic net is required');
    if (!net.transitions.length || net.transitions.some(t => !isMethodRule(t))) throw new DomainError('unsupported-model', 'The method oracle requires public methods only; internal exploration is unsupported');
    if (io) checkInterface(net, io);
  } else net = withInitialMarking(net, options.initialMarking);
  const sim = options.simulator || new AlgebraicSimulator();
  const execution = {
    status: 'completed',
    observations: [],
    annotations: [],
    markings: [initialMarkingOf(net)],
    events: []
  };
  try {
    checkCancelled(options.signal);
    await sim.initialize(net);
    for (const [index, pair] of pairs.entries()) {
      checkCancelled(options.signal);
      const {
        stimulation,
        assertion = 'required'
      } = pair;
      let call, enabled;
      if (methods) {
        if (assertion === 'blocked') enabled = sim.checkMethod(stimulation.method, stimulation.arguments);else {
          call = await sim.invokeMethod(stimulation.method, stimulation.arguments);
          enabled = call.status !== 'blocked';
        }
      } else {
        const acceptAssignment = inputSelector(stimulation, sim);
        enabled = await sim.isTransitionEnabled(stimulation.transition, acceptAssignment);
        if (enabled && assertion !== 'blocked') {
          await sim.fireTransitionSpecific(stimulation.transition, {
            acceptAssignment
          });
          if (sim.lastFiring?.transitionId !== stimulation.transition) throw new DomainError('missing-evidence', 'Missing firing evidence');
          call = sim.lastFiring;
        }
      }
      const marking = initialMarkingOf(sim.getCurrentState());
      const produced = copy(call?.produced || emptyGates(net));
      const outputs = io?.outputs ? Object.fromEntries(io.outputs.map(id => [id, produced[id] || []])) : produced;
      const event = {
        step: index + 1,
        enabled,
        previousMarking: copy(execution.markings[execution.markings.length - 1]),
        produced,
        outputs,
        marking,
        transitionId: call?.transitionId,
        consumed: copy(call?.consumed || {})
      };
      execution.events.push(event);
      execution.markings.push(marking);
      if (enabled && assertion !== 'blocked') {
        execution.observations.push(outputs);
        execution.annotations.push(call.transitionId);
      }
      if (options.onStep && (await options.onStep(event, pair)) === false) {
        execution.status = 'stopped';
        execution.step = index + 1;
        return execution;
      }
      if (!enabled && assertion !== 'blocked') {
        execution.status = 'blocked';
        execution.step = index + 1;
        return execution;
      }
    }
    return execution;
  } catch (error) {
    error.execution = execution;
    error.step = execution.events.length + 1;
    throw error;
  } finally {
    sim.reset();
  }
}
