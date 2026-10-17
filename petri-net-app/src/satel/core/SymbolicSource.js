import { validateFormula } from './HmlFormula.js';
import { evaluateGroundTerm } from './GroundTerms.js';
import { symbolicToValue } from '../../utils/builtin-values.js';
import { splitTopLevel } from '../../utils/split-terms.js';
import { addBuiltins, builtinNames, resolveBuiltin, NIL, CONS, PAIR } from './BuiltinAlgebra.js';
import { formatSymbolicTerm, validateSymbolicGoal, unify, substitute, termSort, variablesIn, elaborateTerm } from './SymbolicTerms.js';
import { parseVariables, parseTerms, parseSymbolicSource, formatSymbolicSource, one, lines } from '../../domain/algebra/Source.js';
export { parseVariables, parseTerms, parseSymbolicSource, formatSymbolicSource } from '../../domain/algebra/Source.js';
const identifier = '[A-Za-z_][A-Za-z0-9_]*';
export function compileSymbolicIntention(intention) {
  if (intention.branchingProperty) validateFormula(intention.branchingProperty);
  const s = intention.symbolic;
  if (!s || !intention.id || !intention.name) throw new Error('Symbolic intention needs an ID, name and definition');
  const algebra = parseSymbolicSource(s.source);
  const variables = parseVariables(s.variablesText || '');
  let args, operation;
  if (s.goalKind === 'guard') {
    const condition = one(s.guardText || '', algebra, variables);
    operation = '_guardGoal';
    if (algebra.operations[operation] || algebra.constructors[operation]) throw new Error('Reserved guard goal name');
    args = Object.keys(variables).map(name => ({
      var: name
    }));
    algebra.operations[operation] = {
      parameters: Object.values(variables),
      result: 'Bool',
      rules: [true, false].map(value => ({
        id: `guard.${value}`,
        variables,
        patterns: args,
        result: value,
        conditions: [value ? condition : {
          op: 'not',
          left: condition
        }]
      }))
    };
  } else {
    args = parseTerms(s.argsText || '', algebra, variables);
    operation = algebra.operations[s.operation] ? s.operation : resolveBuiltin(s.operation, args, t => termSort(t, variables, algebra));
  }
  const goal = {
    algebra,
    variables,
    operation,
    args,
    maxDepth: Number(s.maxDepth),
    conditions: (s.conditionsText || '').trim() ? [one(s.conditionsText, algebra, variables)] : []
  };
  validateSymbolicGoal(goal);
  const protocol = s.protocolSource?.trim() ? parseProtocol(s.protocolSource, algebra, goal) : null;
  return {
    goal,
    protocol
  };
}

/** Declarative constructor-to-method mapping. Each case specifies a pair sequence. */
export function parseProtocol(source, algebra, goal) {
  const cases = [];
  let current;
  for (const line of lines(source)) {
    if (line.startsWith('case ')) {
      const m = line.match(/^case\s+([\w.-]+)\s*\(([^)]*)\):$/);
      if (!m) throw new Error(`Invalid protocol case: ${line}`);
      current = {
        id: m[1],
        variables: parseVariables(m[2]),
        pairs: []
      };
      cases.push(current);
      continue;
    }
    if (!current) throw new Error('Protocol must start with a case declaration');
    if (line.startsWith('inputs ')) {
      if (current.patterns) throw new Error('Duplicate inputs declaration');
      current.patterns = parseTerms(line.slice(7), algebra, current.variables);
      continue;
    }
    if (line.startsWith('result ')) {
      if (current.result !== undefined) throw new Error('Duplicate result declaration');
      current.result = one(line.slice(7), algebra, current.variables);
      continue;
    }
    const sides = splitTopLevel(line, '=>');
    const method = sides[0].match(/^pair\s+([A-Za-z_]\w*)\((.*)\)$/);
    const pair = sides.length === 2 && method ? [line, method[1], method[2], sides[1]] : null;
    if (!pair) throw new Error(`Invalid protocol pair: ${line}`);
    const args = {};
    for (const part of pair[2].trim() ? splitTopLevel(pair[2]) : []) {
      const a = part.trim().match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (!a || Object.hasOwn(args, a[1])) throw new Error('Expected unique named method arguments');
      args[a[1]] = one(a[2], algebra, current.variables);
    }
    const outputs = {};
    const refused = pair[3] === 'refused';
    if (pair[3] !== 'none' && !refused) {
      for (const text of splitTopLevel(pair[3])) {
        const output = text.match(/^([A-Za-z_]\w*)\((.*)\)$/);
        if (!output) throw new Error('Use place(token) observations separated by commas');
        (outputs[output[1]] ||= []).push(one(output[2], algebra, current.variables));
      }
    }
    current.pairs.push({
      assertion: refused ? 'blocked' : 'required',
      stimulation: {
        method: pair[1],
        arguments: args
      },
      observation: {
        outputs
      }
    });
  }
  if (!cases.length) throw new Error('Protocol has no cases');
  const pattern = t => t?.var || typeof t === 'number' || typeof t === 'boolean' || typeof t === 'string' || t?.ctor && t.args.every(pattern);
  for (const c of cases) {
    if (c.pairs.some((p, i) => p.assertion === 'blocked' && i !== c.pairs.length - 1)) throw new Error('A refused call must be the final pair');
    const op = algebra.operations[goal.operation];
    if (c.patterns?.length !== op.parameters.length || c.result === undefined || !c.pairs.length) throw new Error(`Incomplete protocol case: ${c.id}`);
    c.patterns.forEach((p, i) => {
      if (!pattern(p) || termSort(p, c.variables, algebra, op.parameters[i]) !== op.parameters[i]) throw new Error(`Invalid input pattern: ${c.id}`);
    });
    if (!pattern(c.result) || termSort(c.result, c.variables, algebra, op.result) !== op.result) throw new Error(`Invalid result pattern: ${c.id}`);
    c.patterns = c.patterns.map((p, i) => elaborateTerm(p, c.variables, algebra, op.parameters[i]));
    c.result = elaborateTerm(c.result, c.variables, algebra, op.result);
    const bound = variablesIn([c.patterns, c.result]);
    for (const n of Object.keys(c.variables)) if (!bound.has(n)) throw new Error(`Protocol variable is not bound by inputs/result: ${n}`);
  }
  return cases;
}
export function encodeProtocolWitness(protocol, args, result, io, algebra) {
  const matches = [];
  for (const c of protocol) {
    const bindings = new Map();
    if (!c.patterns.every((p, i) => unify(p, args[i], bindings)) || !unify(c.result, result, bindings)) continue;
    const steps = [],
      expected = [];
    for (const p of c.pairs) {
      steps.push({
        method: p.stimulation.method,
        arguments: Object.fromEntries(Object.entries(p.stimulation.arguments).map(([n, t]) => [n, symbolicToValue(evaluateGroundTerm(substitute(t, bindings), algebra))]))
      });
      const outputs = Object.fromEntries(io.outputs.map(n => [n, []]));
      for (const [n, ts] of Object.entries(p.observation.outputs)) {
        if (!Object.hasOwn(outputs, n)) throw new Error(`Unknown public output in protocol: ${n}`);
        outputs[n] = ts.map(t => symbolicToValue(evaluateGroundTerm(substitute(t, bindings), algebra)));
      }
      expected.push(outputs);
    }
    matches.push({
      steps,
      expected,
      pairs: steps.map((stimulation, i) => ({ stimulation, assertion: c.pairs[i].assertion, observation: { outputs: expected[i], scope: 'public' } }))
    });
  }
  if (matches.length !== 1) throw new Error(`Witness must match exactly one protocol case (matched ${matches.length})`);
  return matches[0];
}

/** Import explicit constructor signatures and oriented equations from custom editor ADT XML.
 * Unsupported axioms are rejected, never silently treated as defining equations.
 */
export function importSymbolicADTXml(xml) {
  if (!xml?.trim()) throw new Error('No custom ADT XML is attached to this model');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.querySelector('parsererror')) throw new Error('ADT XML must be one well-formed document');
  const algebra = {
      constructors: {},
      operations: {}
    },
    equations = [];
  const children = (node, tag) => [...node.children].filter(n => n.localName === tag);
  for (const type of [...doc.getElementsByTagName('*')].filter(n => ['type', 'adt'].includes(n.localName))) {
    const sort = type.getAttribute('name');
    for (const node of [...children(type, 'constructor'), ...children(type, 'operation')]) {
      const name = node.getAttribute('name'),
        result = node.getAttribute('result') || sort;
      const params = [...node.children].filter(n => ['param', 'parameter'].includes(n.localName));
      if (params.some(p => p.hasAttribute('index'))) {
        params.sort((a, b) => Number(a.getAttribute('index')) - Number(b.getAttribute('index')));
        if (params.some((p, i) => !p.hasAttribute('index') || Number(p.getAttribute('index')) !== i)) throw new Error(`Missing typed parameters or invalid parameter indices for ${name}`);
      }
      const parameters = params.map(p => p.getAttribute('type'));
      if (node.hasAttribute('arity') && Number(node.getAttribute('arity')) !== parameters.length) throw new Error(`Missing typed parameters for ${name}`);
      if (algebra.constructors[name] || algebra.operations[name]) throw new Error(`Duplicate/overloaded signature is unsupported: ${name}`);
      (node.localName === 'constructor' ? algebra.constructors : algebra.operations)[name] = {
        parameters,
        result,
        ...(node.localName === 'operation' ? {
          rules: []
        } : {})
      };
    }
    for (const ax of [...type.getElementsByTagName('*')].filter(n => ['axiom', 'equation'].includes(n.localName))) equations.push({
      id: ax.getAttribute('name') || `equation${equations.length + 1}`,
      text: ax.textContent.trim()
    });
  }
  if (!Object.keys(algebra.constructors).length) throw new Error('Custom XML must declare free constructors explicitly');
  const source = formatSymbolicSource(algebra);
  const ruleLines = equations.map(({
    id,
    text
  }) => {
    const split = text.match(/^(.+?)\s+=(?!=)\s+(.+)$/);
    if (!split) throw new Error(`Unsupported equation syntax: ${id}. Use operation(patterns) = result [if conditions].`);
    const candidates = Object.fromEntries([...split[1].matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map(m => m[0]).filter(n => !algebra.constructors[n] && !algebra.operations[n] && !['true', 'false'].includes(n)).map(n => [n, 'pending']));
    const lhs = one(split[1], algebra, candidates),
      vars = {};
    if (!lhs?.call) throw new Error(`Axiom ${id} is not an oriented operation definition (quotient axioms are unsupported)`);
    const infer = (t, expected) => {
      if (t?.var) {
        if (vars[t.var] && vars[t.var] !== expected) throw new Error(`Conflicting variable sort in ${id}`);
        vars[t.var] = expected;
        return;
      }
      const sig = t?.ctor ? algebra.constructors[t.ctor] : t?.call ? algebra.operations[t.call] : null;
      if (sig) t.args.forEach((a, i) => infer(a, sig.parameters[i]));
    };
    infer(lhs);
    return `rule ${id}(${Object.entries(vars).map(([n, s]) => `${n}: ${s}`).join(', ')}): ${text}`;
  });
  // Reparse to reject unsupported syntax immediately; full type checks run on Save.
  const result = source + '\n' + ruleLines.join('\n');
  parseSymbolicSource(result);
  return result;
}

/** Explicit snapshot, never a hidden dependency on the current simulator state. */
export function guardFromTransition(net, transitionId, source = '') {
  const transition = net.transitions.find(t => t.id === transitionId);
  if (!transition?.guard?.trim()) throw new Error('Choose a transition with a guard');
  const variables = {};
  const declare = (name, sort) => {
    if (variables[name] && variables[name] !== sort) throw new Error(`Conflicting guard variable sort: ${name}`);
    variables[name] = sort;
  };
  for (const p of transition.method?.parameters || []) declare(p.name, p.sort);
  for (const arc of net.arcs.filter(a => a.target === transitionId && a.sourceType === 'place')) {
    const binding = (arc.binding || '').trim();
    if (/^[a-z_][A-Za-z0-9_]*$/.test(binding)) declare(binding, net.places.find(p => p.id === arc.source)?.sort || 'Int');else if (!/^-?\d+$/.test(binding)) throw new Error('This input arc needs explicit variable declarations; copy the guard manually');
  }
  const algebra = parseSymbolicSource(source);
  const term = one(transition.guard, algebra, variables);
  if (termSort(term, variables, algebra) !== 'Bool') throw new Error('Guard must be Boolean');
  const used = variablesIn(term);
  return {
    goalKind: 'guard',
    guardText: transition.guard,
    variablesText: Object.entries(variables).filter(([name]) => used.has(name)).map(([name, sort]) => `${name}: ${sort}`).join(', ')
  };
}
