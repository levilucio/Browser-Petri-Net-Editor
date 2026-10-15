import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator.js';
import { parseArithmetic } from '../../utils/arith-parser.js';
import { parseBooleanExpr } from '../../utils/z3-arith.js';

const copy = value => JSON.parse(JSON.stringify(value));
const requireCondition = (condition, message) => { if (!condition) throw new Error(message); };
const isNat = value => Number.isInteger(value) && value >= 0 && value <= 2147483647;

// Restrict this increment explicitly. No action interpreter, solver fallback,
// unbound variables, token-choice nondeterminism or user-defined ADTs is implied.
function arithmetic(ast, variables) {
  if (ast.type === 'int') {
    requireCondition(isNat(ast.value), 'Only nonnegative 32-bit integer literals are supported');
    return;
  }
  if (ast.type === 'var') {
    requireCondition(!ast.varType && variables.has(ast.name), `Unbound/unsupported variable: ${ast.name}`);
    return;
  }
  requireCondition(ast.type === 'binop' && ['+', '-'].includes(ast.op), 'Only Nat addition and subtraction are supported');
  arithmetic(ast.left, variables);
  arithmetic(ast.right, variables);
}

function evaluate(ast, env) {
  if (ast.type === 'int') return ast.value;
  if (ast.type === 'var') return env[ast.name];
  const left = evaluate(ast.left, env), right = evaluate(ast.right, env);
  const value = ast.op === '+' ? left + right : left - right;
  requireCondition(isNat(value), 'Arithmetic leaves the supported Nat range');
  return value;
}

function guardHolds(ast, env) {
  if (!ast) return true;
  const left = evaluate(ast.left, env), right = evaluate(ast.right, env);
  switch (ast.op) {
    case '<': return left < right;
    case '<=': return left <= right;
    case '>': return left > right;
    case '>=': return left >= right;
    case '==': return left === right;
    case '!=': return left !== right;
    default: throw new Error('Unsupported comparison');
  }
}

function compile(net, io) {
  requireCondition(net?.mode === 'algebraic', 'An algebraic net is required');
  requireCondition(Array.isArray(net.places) && Array.isArray(net.transitions) && Array.isArray(net.arcs), 'Malformed net');
  requireCondition(net.places.length && net.transitions.length, 'Empty net');
  const allIds = [...net.places, ...net.transitions, ...net.arcs].map(x => x.id);
  requireCondition(allIds.every(id => typeof id === 'string' && id.length > 0) && new Set(allIds).size === allIds.length, 'Net IDs must be nonempty and unique');
  requireCondition(io?.actions && Array.isArray(io.outputs) && io.outputs.length > 0, 'A public interface is required');
  const inputs = Object.values(io.actions);
  requireCondition(inputs.length > 0 && new Set(inputs).size === inputs.length, 'Actions must identify distinct input places');
  requireCondition(new Set(io.outputs).size === io.outputs.length, 'Duplicate output places');
  const places = new Map(net.places.map(p => [p.id, p]));
  requireCondition(inputs.every(id => places.get(id)?.io_type === 'input'), 'Action targets must be input places');
  requireCondition(io.outputs.every(id => places.get(id)?.io_type === 'output'), 'Observations must identify output places');
  for (const p of net.places) {
    requireCondition(p.sort === 'Nat', `Unsupported sort at ${p.id}: only Nat is supported in this increment`);
    requireCondition(['input', 'output', 'internal'].includes(p.io_type), `Missing I/O role: ${p.id}`);
    requireCondition(Array.isArray(p.valueTokens) && p.valueTokens.length <= 1 && p.valueTokens.every(isNat), `Invalid singleton Nat marking: ${p.id}`);
    requireCondition(p.tokens === p.valueTokens.length, `Inconsistent token count: ${p.id}`);
    if (p.io_type !== 'internal') requireCondition(p.tokens === 0, `Public places must start empty: ${p.id}`);
    if (p.io_type === 'input') requireCondition(inputs.includes(p.id), `Unmapped input: ${p.id}`);
    if (p.io_type === 'output') requireCondition(io.outputs.includes(p.id), `Unobserved output: ${p.id}`);
  }
  const transitions = new Set(net.transitions.map(t => t.id));
  for (const a of net.arcs) {
    const incoming = places.has(a.source) && transitions.has(a.target);
    const outgoing = transitions.has(a.source) && places.has(a.target);
    requireCondition(incoming || outgoing, `Non-bipartite/unknown arc: ${a.id}`);
    requireCondition(a.sourceType === (incoming ? 'place' : 'transition') && a.targetType === (incoming ? 'transition' : 'place'), `Incorrect arc direction: ${a.id}`);
    requireCondition((a.sourceId === undefined || a.sourceId === a.source) && (a.targetId === undefined || a.targetId === a.target), `Conflicting arc endpoints: ${a.id}`);
    requireCondition(!a.type || a.type === `${a.sourceType}-to-${a.targetType}`, `Conflicting arc type: ${a.id}`);
    requireCondition((a.weight === undefined || a.weight === 1) && a.bindings === undefined && typeof a.binding === 'string', `Only single binding, unit arcs are supported: ${a.id}`);
    requireCondition(incoming ? places.get(a.source).io_type !== 'output' : places.get(a.target).io_type !== 'input', `Public interface direction violated: ${a.id}`);
  }
  const rules = net.transitions.map(t => {
    requireCondition(!t.action?.trim(), `Transition actions are outside this increment: ${t.id}`);
    const incoming = net.arcs.filter(a => a.target === t.id);
    const outgoing = net.arcs.filter(a => a.source === t.id);
    requireCondition(incoming.filter(a => inputs.includes(a.source)).length === 1, `Each rule must consume one public request: ${t.id}`);
    requireCondition(new Set(incoming.map(a => a.source)).size === incoming.length && new Set(outgoing.map(a => a.target)).size === outgoing.length, `Parallel arcs are unsupported: ${t.id}`);
    requireCondition(incoming.every(a => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(a.binding)), `Input bindings must be variables: ${t.id}`);
    const variables = new Set(incoming.map(a => a.binding));
    requireCondition(variables.size === incoming.length, `Repeated input variables are unsupported: ${t.id}`);
    const guard = t.guard?.trim() ? parseBooleanExpr(t.guard, parseArithmetic) : null;
    if (guard) {
      requireCondition(guard.type === 'cmp' && ['<', '<=', '>', '>=', '==', '!='].includes(guard.op), `Only a single comparison guard is supported: ${t.id}`);
      arithmetic(guard.left, variables);
      arithmetic(guard.right, variables);
    }
    const outputs = outgoing.map(a => {
      const ast = parseArithmetic(a.binding);
      arithmetic(ast, variables);
      return { place: a.target, ast };
    });
    return { id: t.id, incoming, guard, outputs };
  });
  return { rules, inputs };
}

/**
 * Execute public requests on the existing APN simulator. Rule IDs are diagnostic
 * evidence only; they are neither selection criteria nor expected outputs.
 * Errors in the supported fragment are raised, not turned into failed tests.
 */
export async function observeBoundedTrace(net, io, steps) {
  net = copy(net);
  io = copy(io);
  steps = copy(steps);
  const { rules, inputs } = compile(net, io);
  requireCondition(Array.isArray(steps) && steps.length > 0, 'A nonempty stimulus sequence is required');
  for (const step of steps) {
    requireCondition(Object.hasOwn(io.actions, step.action), `Unknown public action: ${step.action}`);
    requireCondition(isNat(step.value), 'Stimulus must be a nonnegative 32-bit integer');
  }
  const simulator = new AlgebraicSimulator();
  await simulator.initialize(copy(net));
  const observations = [], annotations = [];
  try {
    for (let index = 0; index < steps.length; index++) {
      const state = new Map(simulator.getCurrentState().places.map(p => [p.id, p.valueTokens]));
      requireCondition([...state.values()].every(tokens => tokens.length <= 1 && tokens.every(isNat)), 'Unsupported runtime marking');
      requireCondition([...inputs, ...io.outputs].every(id => state.get(id).length === 0), 'Unconsumed public tokens');
      const step = steps[index];
      simulator.injectTokens(io.actions[step.action], [step.value]);
      state.set(io.actions[step.action], [step.value]);

      // Preflight avoids legacy simulator fallbacks silently swallowing invalid
      // guards or output expressions, and checks its execution against the
      // explicitly supported single-binding arithmetic fragment.
      const enabled = rules.flatMap(rule => {
        if (!rule.incoming.every(a => state.get(a.source).length === 1)) return [];
        const env = Object.fromEntries(rule.incoming.map(a => [a.binding, state.get(a.source)[0]]));
        return guardHolds(rule.guard, env) ? [{ rule, env }] : [];
      });
      const simulatorEnabled = await simulator.getEnabledTransitions();
      requireCondition(JSON.stringify(simulatorEnabled.slice().sort()) === JSON.stringify(enabled.map(e => e.rule.id).sort()), 'Simulator/fragment enabled-rule disagreement');
      requireCondition(enabled.length <= 1, `Nondeterminism is unsupported at step ${index + 1}`);
      if (enabled.length === 0) return { status: 'blocked', step: index + 1, observations, annotations };
      const { rule, env } = enabled[0];
      const expectedState = new Map([...state].map(([id, tokens]) => [id, [...tokens]]));
      rule.incoming.forEach(a => expectedState.set(a.source, []));
      rule.outputs.forEach(o => expectedState.get(o.place).push(evaluate(o.ast, env)));
      requireCondition([...expectedState.values()].every(tokens => tokens.length <= 1), 'Multiple tokens per place are unsupported');
      await simulator.fireTransition(rule.id);
      const after = new Map(simulator.getCurrentState().places.map(p => [p.id, p.valueTokens]));
      for (const [id, expected] of expectedState) {
        requireCondition(JSON.stringify(after.get(id)) === JSON.stringify(expected), `Simulator/fragment marking disagreement: ${id}`);
      }
      requireCondition(inputs.every(id => after.get(id).length === 0), 'Request was not consumed');
      observations.push(Object.fromEntries(io.outputs.map(id => [id, copy(after.get(id))])));
      annotations.push(rule.id);
      // Outputs are events observed once, not accumulated marking suffixes.
      io.outputs.forEach(id => simulator.setPlaceMarking(id, []));
    }
    return { status: 'completed', observations, annotations };
  } finally {
    simulator.reset();
  }
}
