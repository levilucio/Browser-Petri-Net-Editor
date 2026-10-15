import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator.js';
import { getPublicMethods, isMethodRule } from '../../features/simulation/PublicMethods.js';
import { initialMarkingOf } from './InitialMarking.js';

const copy = x => JSON.parse(JSON.stringify(x));

/** Synchronous method-call sequences. No hidden internal exploration or marking overrides. */
export async function observeBoundedTrace(net, io, steps) {
  net = copy(net); io = copy(io); steps = copy(steps);
  if (!['algebraic', 'algebraic-int'].includes(net.mode)) throw new Error('An algebraic net is required');
  if (!net.transitions?.length || net.transitions.some(t => !isMethodRule(t))) throw new Error('The method oracle requires all rules to implement public methods; internal exploration is unsupported');
  const actualMethods = getPublicMethods(net).map(({ name, parameters }) => ({ name, parameters }));
  const signatures = ms => JSON.stringify([...ms].sort((a, b) => a.name.localeCompare(b.name)));
  if (!Array.isArray(io.methods) || signatures(actualMethods) !== signatures(io.methods)) throw new Error('Public method interface does not match the saved contract');
  if (!Array.isArray(io.outputs) || !io.outputs.length || new Set(io.outputs).size !== io.outputs.length || io.outputs.some(id => !net.places.some(p => p.id === id && p.io_type === 'output'))) throw new Error('Invalid public output interface');
  if (!Array.isArray(steps) || !steps.length) throw new Error('A nonempty method-call sequence is required');
  const sim = new AlgebraicSimulator();
  await sim.initialize(net);
  const observations = [], annotations = [], markings = [initialMarkingOf(net)];
  try {
    for (const [index, step] of steps.entries()) {
      const result = await sim.invokeMethod(step.method, step.arguments);
      if (result.status === 'blocked') return { status: 'blocked', step: index + 1, observations, annotations, markings };
      observations.push(Object.fromEntries(io.outputs.map(id => [id, result.produced[id] || []])));
      annotations.push(result.transitionId);
      markings.push(initialMarkingOf(result.state));
    }
    return { status: 'completed', observations, annotations, markings };
  } finally { sim.reset(); }
}
