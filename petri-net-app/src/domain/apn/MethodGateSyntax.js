/** Concrete syntax for a flat CO-OPN-style class, with receptive output gates.
 * Class / Interface / Methods / Gates / Body / Places / Initial / Axioms / Where / End.
 * Axioms: [ruleId:] method args [With this.gate args // ...] :: [guard =>] pre -> post;
 * Terms with whitespace must be parenthesized. Axiom labels are an editor extension.
 * No JS evaluation, contexts, autonomous transitions or asynchronous gate queues.
 */
import { compilePublicNet, getPublicMethods, compileMethodRule } from './PublicMethods.js';
import { getGates, portIdentifier } from './Gates.js';
import { parseMethodValue } from './MethodTerms.js';
import { methodSorts } from '../../utils/builtin-values.js';
const fail = message => { throw new Error(`APN source: ${message}`); };

// All structural separators are recognized outside strings and balanced terms.
export function splitSurface(text, separator, { allowIncomplete = false } = {}) {
  const parts = []; let start = 0, stack = [], quote = false, escape = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (escape) escape = false; else if (c === '\\') escape = true; else if (c === '"') quote = false; continue; }
    if (c === '"') { quote = true; continue; }
    if ('(['.includes(c)) { stack.push(c); continue; }
    if (')]'.includes(c)) { if (stack.pop() !== (c === ')' ? '(' : '[')) fail('Unbalanced term delimiters'); continue; }
    const match = !stack.length && (separator === 'space' ? /\s/.test(c) : text.startsWith(separator, i));
    if (match) { parts.push(text.slice(start, i).trim()); i += separator === 'space' ? 0 : separator.length - 1; start = i + 1; }
  }
  if (!allowIncomplete && (quote || stack.length)) fail('Unterminated string or term');
  parts.push(text.slice(start).trim());
  return separator === 'space' ? parts.filter(Boolean) : parts;
}
const name = n => { if (!portIdentifier(n)) fail(`Invalid identifier: ${n}`); return n; };
function application(text) {
  const parts = splitSurface(text, 'space');
  if (!parts.length) fail('Expected a port/place application');
  return { name: name(parts[0].replace(/^this\./, '')), args: parts.slice(1) };
}
function signature(line) {
  const parts = line.split(':');
  if (parts.length !== 2) fail(`Expected name : Sort Sort; in ${line}`);
  const sorts = parts[1].trim() ? parts[1].trim().split(/\s+/) : [];
  if (sorts.some(s => !methodSorts.includes(s))) fail(`Unsupported port/place sort in ${line}`);
  return { name: name(parts[0].trim()), sorts };
}
const bag = text => ['empty', '∅'].includes(text.trim()) ? [] : splitSurface(text, ',').map(application);
export function parseMethodGateSource(source, previous = {}) {
  const lines = source.split(/\r?\n/).filter(l => !l.trim().startsWith('--'));
  let section = '', className = '', ended = false, phase = 'start';
  const sections = { Methods: [], Gates: [], Places: [], Initial: [], Axioms: [], Where: [] };
  const seenSections = new Set();
  let pending = '';
  for (const raw of lines) {
    const line = raw.trim(); if (!line) continue;
    if (ended) fail('Unexpected content after End');
    if (!pending.trim()) {
      const start = line.match(/^Class\s+(\w+)\s*;$/i);
      if (start) { if (phase !== 'start') fail('Only one flat class is supported'); className = name(start[1]); phase = 'class'; continue; }
      const end = line.match(/^End\s+(\w+)\s*;$/i);
      if (end) {
        if (end[1] !== className || phase !== 'body' || !seenSections.has('Axioms')) fail('Mismatched End or incomplete class body');
        ended = true; continue;
      }
      if (/^Interface$/i.test(line)) {
        if (phase !== 'class') fail('Interface must follow Class');
        phase = 'interface'; section = ''; continue;
      }
      if (/^Body$/i.test(line)) {
        if (phase !== 'interface') fail('Body must follow Interface');
        phase = 'body'; section = ''; continue;
      }
      const heading = Object.keys(sections).find(k => k.toLowerCase() === line.toLowerCase());
      if (heading) {
        const bodyOrder = ['Places', 'Initial', 'Axioms', 'Where'];
        if (seenSections.has(heading)) fail(`Repeated ${heading} section`);
        if (['Methods', 'Gates'].includes(heading)) {
          if (phase !== 'interface') fail(`${heading} belongs in Interface`);
        } else {
          const index = bodyOrder.indexOf(heading);
          if (phase !== 'body' || index > 0 && !seenSections.has(bodyOrder[index - 1])) fail(`Misplaced ${heading} section`);
        }
        seenSections.add(heading); section = heading; continue;
      }
    }
    if (!section || !className) fail(`Unexpected syntax: ${line}`);
    pending += `\n${raw}`;
    const pieces = splitSurface(pending, ';', { allowIncomplete: true });
    pending = pieces.pop(); sections[section].push(...pieces.filter(Boolean));
  }
  if (!className || !ended || pending.trim()) fail('Expected Class name; ... End name; and terminated statements');
  const declarations = kind => {
    const entries = sections[kind].map(signature);
    if (new Set(entries.map(x => x.name)).size !== entries.length) fail(`Duplicate ${kind} declaration`);
    return entries;
  };
  const methods = declarations('Methods'), gates = declarations('Gates'), places = declarations('Places');
  if (places.some(p => p.sorts.length !== 1)) fail('A place has exactly one sort');
  const net = { ...previous, mode: 'algebraic', apnClass: className,
    gates: gates.map(g => ({ name: g.name, parameters: g.sorts.map((sort, i) => ({ name: `arg${i + 1}`, sort })) })),
    places: places.map((p, i) => ({ ...previous.places?.find(x => x.id === p.name), id: p.name, label: p.name, sort: p.sorts[0], io_type: 'internal', valueTokens: [], tokens: 0, x: previous.places?.find(x => x.id === p.name)?.x ?? 160, y: previous.places?.find(x => x.id === p.name)?.y ?? 100 + i * 140 })),
    transitions: [], arcs: [] };
  for (const statement of sections.Initial) for (const token of bag(statement)) {
    const place = net.places.find(p => p.id === token.name);
    if (!place || token.args.length !== 1) fail(`Invalid initial token: ${token.name}`);
    place.valueTokens.push(parseMethodValue(token.args[0], place.sort)); place.tokens++;
  }
  const canonicalParameters = new Map();
  for (const [i, statement] of sections.Axioms.entries()) {
    const fields = splitSurface(statement, '::');
    if (fields.length !== 2) fail('Axiom requires event :: pre -> post');
    let event = fields[0], id = `rule${i + 1}`;
    const label = event.match(/^(\w+)\s*:\s*(.*)$/s);
    if (label) { id = name(label[1]); event = label[2]; }
    // With is a reserved structural keyword, outside quoted/balanced terms.
    const words = splitSurface(event, 'space'), wi = words.findIndex(w => w.toLowerCase() === 'with');
    const call = application((wi < 0 ? words : words.slice(0, wi)).join(' '));
    const declaration = methods.find(m => m.name === call.name);
    if (!declaration || call.args.length !== declaration.sorts.length || call.args.some(a => !portIdentifier(a))) fail(`Method ${call.name} must use its declared arity and variable parameters`);
    const parameters = call.args.map((n, k) => ({ name: n, sort: declaration.sorts[k] }));
    if (canonicalParameters.has(call.name) && JSON.stringify(canonicalParameters.get(call.name)) !== JSON.stringify(parameters)) fail(`Use the same formal parameter names in all ${call.name} axioms`);
    canonicalParameters.set(call.name, parameters);
    const calls = wi < 0 ? [] : splitSurface(words.slice(wi + 1).join(' '), '//').map(application);
    if (wi >= 0 && !calls.length) fail('With requires a gate');
    const guarded = splitSurface(fields[1], '=>');
    if (guarded.length > 2) fail('Only one guard separator is allowed');
    const marking = splitSurface(guarded.at(-1), '->');
    if (marking.length !== 2) fail('Axiom requires pre -> post');
    const old = previous.transitions?.find(t => t.id === id);
    const t = { id, label: old?.label || id, x: old?.x ?? 450 + i % 2 * 270, y: old?.y ?? 100 + Math.floor(i / 2) * 160,
      method: { name: call.name, parameters }, guard: guarded.length === 2 ? guarded[0] : '',
      gates: calls.map(g => ({ gate: g.name, arguments: g.args })) };
    net.transitions.push(t);
    for (const [side, text] of marking.entries()) for (const [j, arc] of bag(text).entries()) {
      if (!net.places.some(p => p.id === arc.name) || arc.args.length !== 1) fail(`Invalid marking term ${arc.name}`);
      net.arcs.push({ id: `${id}_${side ? 'out' : 'in'}_${j}`, source: side ? id : arc.name, target: side ? arc.name : id,
        sourceType: side ? 'transition' : 'place', targetType: side ? 'place' : 'transition', type: side ? 'transition-to-place' : 'place-to-transition', binding: arc.args[0], weight: 1 });
    }
  }
  if (methods.some(m => !canonicalParameters.has(m.name))) fail('Every declared method must have at least one axiom');
  const compiled = compilePublicNet(net);
  const where = declarations('Where');
  for (const variable of where) {
    if (variable.sorts.length !== 1) fail('Where variables have one sort');
    for (const plans of Object.values(compiled.plans)) for (const p of plans) {
      if (p.variables[variable.name] && p.variables[variable.name] !== variable.sorts[0]) fail(`Where sort disagrees for ${variable.name}`);
    }
  }
  return net;
}
export function formatMethodValue(value) {
  if (Array.isArray(value)) return `[${value.map(formatMethodValue).join(', ')}]`;
  if (value?.__pair__) return `(${formatMethodValue(value.fst)}, ${formatMethodValue(value.snd)})`;
  return JSON.stringify(value);
}
const term = text => `(${text})`;
export function serializeMethodGateSource(net) {
  compilePublicNet(net);
  if (net.transitions.some(t => !t.method)) fail('Concrete class syntax requires method-associated rules');
  if (net.places.some(p => p.io_type === 'output')) fail('Convert output places to gates before exporting class syntax');
  const className = portIdentifier(net.apnClass) ? net.apnClass : 'APN';
  const methods = getPublicMethods(net), gates = getGates(net);
  const lines = [`Class ${className};`, '', 'Interface', '  Methods', ...methods.map(m => `    ${m.name} : ${m.parameters.map(p => p.sort).join(' ')};`), '  Gates', ...gates.map(g => `    ${g.name} : ${g.parameters.map(p => p.sort).join(' ')};`), '', 'Body', '  Places', ...net.places.map(p => `    ${p.id} : ${p.sort};`), '  Initial'];
  const initial = net.places.flatMap(p => p.valueTokens.map(v => `${p.id} ${term(formatMethodValue(v))}`));
  lines.push(`    ${initial.join(', ') || 'empty'};`, '  Axioms');
  for (const t of net.transitions) {
    const m = methods.find(m => m.name === t.method.name);
    const plan = compileMethodRule(net, m, t.id);
    const pre = plan.ins.map(x => `${x.place} ${x.variable}`).join(', ') || 'empty';
    const post = net.arcs.filter(a => (a.sourceId || a.source) === t.id).map(a => `${a.targetId || a.target} ${term((a.bindings || [a.binding])[0])}`).join(', ') || 'empty';
    const sync = (t.gates || []).map(g => `this.${g.gate}${g.arguments.map(a => ` ${term(a)}`).join('')}`).join(' // ');
    lines.push(`    ${t.id}: ${m.name}${m.parameters.map(p => ` ${p.name}`).join('')}${sync ? ` With ${sync}` : ''} ::`, `      ${t.guard?.trim() ? `${t.guard} => ` : ''}${pre} -> ${post};`);
  }
  lines.push('', `End ${className};`, '');
  return lines.join('\n');
}
