import { formatSymbolicTerm, validateSymbolicGoal, unify, substitute, evaluateGround, termSort, variablesIn } from './SymbolicTerms.js';

const identifier = '[A-Za-z_][A-Za-z0-9_]*';
export function parseVariables(text) {
  const vars = {};
  if (!text.trim()) return vars;
  for (const part of text.split(',')) {
    const match = part.trim().match(new RegExp(`^(${identifier})\\s*:\\s*(${identifier})$`));
    if (!match || Object.hasOwn(vars, match[1])) throw new Error(`Invalid or duplicate variable: ${part.trim()}`);
    vars[match[1]] = match[2];
  }
  return vars;
}
export function parseTerms(text, algebra, variables = {}) {
  const tokens = []; let rest = text.trim();
  while (rest) {
    const m = rest.match(/^(\d+|[A-Za-z_][A-Za-z0-9_]*|==|!=|<=|>=|[(),+\-<>])/);
    if (!m) throw new Error(`Unexpected expression near: ${rest.slice(0, 30)}`);
    tokens.push(m[0]); rest = rest.slice(m[0].length).trimStart();
  }
  let pos = 0;
  const take = token => { if (tokens[pos++] !== token) throw new Error(`Expected ${token}`); };
  const atom = () => {
    const token = tokens[pos++];
    if (!token) throw new Error('Incomplete expression');
    if (token === '(') { const t = expression(); take(')'); return t; }
    if (token === '-') { const value = atom(); if (typeof value !== 'number') throw new Error('Unary minus requires a literal'); return -value; }
    if (/^\d+$/.test(token)) { const n = Number(token); if (!Number.isSafeInteger(n)) throw new Error('Literal exceeds exact integer range'); return n; }
    if (token === 'true' || token === 'false') return token === 'true';
    if (tokens[pos] === '(') {
      pos++; const args = [];
      if (tokens[pos] !== ')') { args.push(expression()); while (tokens[pos] === ',') { pos++; args.push(expression()); } }
      take(')');
      if (Object.hasOwn(algebra.constructors, token)) return { ctor: token, args };
      if (Object.hasOwn(algebra.operations, token)) return { call: token, args };
      throw new Error(`Unknown constructor/operation: ${token}`);
    }
    if (Object.hasOwn(variables, token)) return { var: token };
    throw new Error(`Undeclared variable: ${token}`);
  };
  const sum = () => { let t = atom(); while (['+', '-'].includes(tokens[pos])) { const op = tokens[pos++]; t = { op, left: t, right: atom() }; } return t; };
  const expression = () => {
    let t = sum(); if (['==', '!=', '<', '<=', '>', '>='].includes(tokens[pos])) { const op = tokens[pos++]; t = { op, left: t, right: sum() }; } return t;
  };
  const values = [];
  if (tokens.length) { values.push(expression()); while (tokens[pos] === ',') { pos++; values.push(expression()); } }
  if (pos !== tokens.length) throw new Error(`Unexpected token: ${tokens[pos]}`);
  return values;
}
const one = (text, algebra, vars) => { const terms = parseTerms(text, algebra, vars); if (terms.length !== 1) throw new Error('Expected one expression'); return terms[0]; };
const lines = source => String(source).split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));

/** Explicit signatures and oriented conditional equations; no eval or implicit rewrite axioms. */
export function parseSymbolicSource(source) {
  const algebra = { constructors: {}, operations: {} }, rules = [];
  for (const line of lines(source)) {
    const signature = line.match(new RegExp(`^(constructor|operation)\\s+(${identifier})\\(([^)]*)\\)\\s*:\\s*(${identifier})$`));
    if (signature) {
      const [, kind, name, params, result] = signature;
      if (algebra.constructors[name] || algebra.operations[name]) throw new Error(`Duplicate signature: ${name}`);
      const parameters = params.trim() ? params.split(',').map(s => s.trim()) : [];
      (kind === 'constructor' ? algebra.constructors : algebra.operations)[name] = { parameters, result, ...(kind === 'operation' ? { rules: [] } : {}) }; continue;
    }
    if (line.startsWith('rule ')) { rules.push(line); continue; }
    throw new Error(`Expected constructor, operation or rule: ${line}`);
  }
  for (const line of rules) {
    const match = line.match(/^rule\s+([A-Za-z_][\w.-]*)\s*\(([^)]*)\)\s*:\s*(.+?)\s+=(?!=)\s+(.+)$/);
    if (!match) throw new Error(`Invalid rule syntax: ${line}`);
    const [, id, declarations, lhs, rhsAndCondition] = match;
    const variables = parseVariables(declarations), parts = rhsAndCondition.split(/\s+if\s+/);
    if (parts.length > 2) throw new Error('Only one if clause is allowed per rule');
    const left = one(lhs, algebra, variables);
    if (!left?.call) throw new Error('A defining equation must have an operation call on the left');
    const result = one(parts[0], algebra, variables);
    const conditions = parts[1] ? parts[1].split(/\s+and\s+/).map(c => one(c, algebra, variables)) : [];
    algebra.operations[left.call].rules.push({ id, variables, patterns: left.args, conditions, result });
  }
  return algebra;
}
export function formatSymbolicSource(algebra) {
  return [
    ...Object.entries(algebra.constructors).map(([n, s]) => `constructor ${n}(${s.parameters.join(', ')}) : ${s.result}`),
    ...Object.entries(algebra.operations).map(([n, s]) => `operation ${n}(${s.parameters.join(', ')}) : ${s.result}`), '',
    ...Object.entries(algebra.operations).flatMap(([name, s]) => s.rules.map(r => `rule ${r.id}(${Object.entries(r.variables || {}).map(([n, s]) => `${n}: ${s}`).join(', ')}): ${name}(${r.patterns.map(formatSymbolicTerm).join(', ')}) = ${formatSymbolicTerm(r.result)}${r.conditions?.length ? ` if ${r.conditions.map(formatSymbolicTerm).join(' and ')}` : ''}`)),
  ].join('\n');
}
export function compileSymbolicIntention(intention) {
  const s = intention.symbolic;
  if (!s || !intention.id || !intention.name) throw new Error('Symbolic intention needs an ID, name and definition');
  const algebra = parseSymbolicSource(s.source);
  const variables = parseVariables(s.variablesText || '');
  const goal = { algebra, variables, operation: s.operation, args: parseTerms(s.argsText, algebra, variables), maxDepth: Number(s.maxDepth),
    conditions: (s.conditionsText || '').trim() ? s.conditionsText.split(/\s+and\s+/).map(c => one(c, algebra, variables)) : [] };
  validateSymbolicGoal(goal);
  const protocol = s.protocolSource?.trim() ? parseProtocol(s.protocolSource, algebra, goal) : null;
  return { goal, protocol };
}

/** Declarative constructor-to-method mapping. Each case specifies a pair sequence. */
export function parseProtocol(source, algebra, goal) {
  const cases = []; let current;
  for (const line of lines(source)) {
    if (line.startsWith('case ')) {
      const m = line.match(/^case\s+([\w.-]+)\s*\(([^)]*)\):$/);
      if (!m) throw new Error(`Invalid protocol case: ${line}`);
      current = { id: m[1], variables: parseVariables(m[2]), pairs: [] }; cases.push(current); continue;
    }
    if (!current) throw new Error('Protocol must start with a case declaration');
    if (line.startsWith('inputs ')) {
      if (current.patterns) throw new Error('Duplicate inputs declaration');
      current.patterns = parseTerms(line.slice(7), algebra, current.variables); continue;
    }
    if (line.startsWith('result ')) {
      if (current.result !== undefined) throw new Error('Duplicate result declaration');
      current.result = one(line.slice(7), algebra, current.variables); continue;
    }
    const pair = line.match(/^pair\s+([A-Za-z_]\w*)\((.*?)\)\s*=>\s*(.*)$/);
    if (!pair) throw new Error(`Invalid protocol pair: ${line}`);
    const args = {};
    // Argument expressions may contain commas in constructor terms; method parameters
    // are numeric in this increment, so named argument splitting is intentionally strict.
    for (const part of pair[2].trim() ? pair[2].split(',') : []) {
      const a = part.trim().match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/);
      if (!a || Object.hasOwn(args, a[1])) throw new Error('Expected unique named method arguments');
      args[a[1]] = one(a[2], algebra, current.variables);
    }
    const outputs = {};
    if (pair[3] !== 'none') {
      // Parse output applications using signatures supplied by the notation itself.
      const names = [...pair[3].matchAll(/\b([A-Za-z_]\w*)\s*\(/g)].map(m => m[1]);
      const notation = { constructors: { ...algebra.constructors }, operations: { ...algebra.operations } };
      names.forEach(n => { notation.constructors[n] = {}; delete notation.operations[n]; });
      for (const o of parseTerms(pair[3], notation, current.variables)) {
        if (!o?.ctor || o.args.length !== 1) throw new Error('Use place(token) observations separated by commas');
        (outputs[o.ctor] ||= []).push(o.args[0]);
      }
    }
    current.pairs.push({ stimulation: { method: pair[1], arguments: args }, observation: { outputs } });
  }
  if (!cases.length) throw new Error('Protocol has no cases');
  const pattern = t => t?.var || typeof t === 'number' || typeof t === 'boolean' || (t?.ctor && t.args.every(pattern));
  for (const c of cases) {
    const op = algebra.operations[goal.operation];
    if (c.patterns?.length !== op.parameters.length || c.result === undefined || !c.pairs.length) throw new Error(`Incomplete protocol case: ${c.id}`);
    c.patterns.forEach((p, i) => { if (!pattern(p) || termSort(p, c.variables, algebra, op.parameters[i]) !== op.parameters[i]) throw new Error(`Invalid input pattern: ${c.id}`); });
    if (!pattern(c.result) || termSort(c.result, c.variables, algebra, op.result) !== op.result) throw new Error(`Invalid result pattern: ${c.id}`);
    const bound = variablesIn([c.patterns, c.result]);
    for (const n of Object.keys(c.variables)) if (!bound.has(n)) throw new Error(`Protocol variable is not bound by inputs/result: ${n}`);
  }
  return cases;
}
export function encodeProtocolWitness(protocol, args, result, io) {
  const matches = [];
  for (const c of protocol) {
    const bindings = new Map();
    if (!c.patterns.every((p, i) => unify(p, args[i], bindings)) || !unify(c.result, result, bindings)) continue;
    const steps = [], expected = [];
    for (const p of c.pairs) {
      steps.push({ method: p.stimulation.method, arguments: Object.fromEntries(Object.entries(p.stimulation.arguments).map(([n, t]) => [n, evaluateGround(substitute(t, bindings))])) });
      const outputs = Object.fromEntries(io.outputs.map(n => [n, []]));
      for (const [n, ts] of Object.entries(p.observation.outputs)) {
        if (!Object.hasOwn(outputs, n)) throw new Error(`Unknown public output in protocol: ${n}`);
        outputs[n] = ts.map(t => evaluateGround(substitute(t, bindings)));
      }
      expected.push(outputs);
    }
    matches.push({ steps, expected });
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
  const algebra = { constructors: {}, operations: {} }, equations = [];
  const children = (node, tag) => [...node.children].filter(n => n.localName === tag);
  for (const type of [...doc.getElementsByTagName('*')].filter(n => ['type', 'adt'].includes(n.localName))) {
    const sort = type.getAttribute('name');
    for (const node of [...children(type, 'constructor'), ...children(type, 'operation')]) {
      const name = node.getAttribute('name'), result = node.getAttribute('result') || sort;
      const params = [...node.children].filter(n => ['param', 'parameter'].includes(n.localName));
      if (params.some(p => p.hasAttribute('index'))) {
        params.sort((a, b) => Number(a.getAttribute('index')) - Number(b.getAttribute('index')));
        if (params.some((p, i) => !p.hasAttribute('index') || Number(p.getAttribute('index')) !== i)) throw new Error(`Missing typed parameters or invalid parameter indices for ${name}`);
      }
      const parameters = params.map(p => p.getAttribute('type'));
      if (node.hasAttribute('arity') && Number(node.getAttribute('arity')) !== parameters.length) throw new Error(`Missing typed parameters for ${name}`);
      if (algebra.constructors[name] || algebra.operations[name]) throw new Error(`Duplicate/overloaded signature is unsupported: ${name}`);
      (node.localName === 'constructor' ? algebra.constructors : algebra.operations)[name] = { parameters, result, ...(node.localName === 'operation' ? { rules: [] } : {}) };
    }
    for (const ax of [...type.getElementsByTagName('*')].filter(n => ['axiom', 'equation'].includes(n.localName))) equations.push({ id: ax.getAttribute('name') || `equation${equations.length + 1}`, text: ax.textContent.trim() });
  }
  if (!Object.keys(algebra.constructors).length) throw new Error('Custom XML must declare free constructors explicitly');
  const source = formatSymbolicSource(algebra);
  const ruleLines = equations.map(({ id, text }) => {
    const split = text.match(/^(.+?)\s+=(?!=)\s+(.+)$/);
    if (!split) throw new Error(`Unsupported equation syntax: ${id}. Use operation(patterns) = result [if conditions].`);
    const candidates = Object.fromEntries([...split[1].matchAll(/[A-Za-z_][A-Za-z0-9_]*/g)].map(m => m[0]).filter(n => !algebra.constructors[n] && !algebra.operations[n] && !['true', 'false'].includes(n)).map(n => [n, 'pending']));
    const lhs = one(split[1], algebra, candidates), vars = {};
    if (!lhs?.call) throw new Error(`Axiom ${id} is not an oriented operation definition (quotient axioms are unsupported)`);
    const infer = (t, expected) => {
      if (t?.var) { if (vars[t.var] && vars[t.var] !== expected) throw new Error(`Conflicting variable sort in ${id}`); vars[t.var] = expected; return; }
      const sig = t?.ctor ? algebra.constructors[t.ctor] : t?.call ? algebra.operations[t.call] : null;
      if (sig) t.args.forEach((a, i) => infer(a, sig.parameters[i]));
    };
    infer(lhs);
    return `rule ${id}(${Object.entries(vars).map(([n, s]) => `${n}: ${s}`).join(', ')}): ${text}`;
  });
  // Reparse to reject unsupported syntax immediately; full type checks run on Save.
  const result = source + '\n' + ruleLines.join('\n'); parseSymbolicSource(result); return result;
}
