import { DomainError } from '../../domain/diagnostics.js';
import { instantiateTerm } from './VariableInstantiator.js';
import { copy } from '../../domain/snapshots.js';

const invalid = message => { throw new DomainError('invalid-test', message); };
/** Finite HML AST. Modal labels are concrete public calls and optional observation predicates.
 * A missing observation matches every response; excludeObservation complements that predicate.
 * Variables occur in argument/observation terms only, and share one substitution across the tree.
 */
export function validateFormula(formula) {
  let count = 0;
  const visit = (node, depth) => {
    if (++count > 1000 || depth > 64) invalid('Property limit: 1,000 nodes and 64 nested levels');
    if (!node || typeof node !== 'object' || Array.isArray(node)) invalid('Expected an HML property node');
    if (['true', 'false'].includes(node.op)) return;
    if (['and', 'or'].includes(node.op)) {
      if (!Array.isArray(node.children) || node.children.length < 1) invalid('A property group needs at least one obligation');
      node.children.forEach(child => visit(child, depth + 1)); return;
    }
    if (node.op === 'marking') {
      if (!node.markings || typeof node.markings !== 'object' || Array.isArray(node.markings)) invalid('A marking predicate requires place constraints');
      return;
    }
    if (node.op === 'not') { visit(node.child, depth + 1); return; }
    if (!['diamond', 'box'].includes(node.op)) invalid(`Unknown property operator: ${node.op}`);
    const s = node.stimulation;
    if (!s || typeof s.method !== 'string' || !s.method || !s.arguments || typeof s.arguments !== 'object' || Array.isArray(s.arguments) || s.transition !== undefined || s.inputs !== undefined) invalid('Property modalities require a public method and named arguments');
    if (node.excludeObservation !== undefined && typeof node.excludeObservation !== 'boolean') invalid('Invalid observation complement');
    if (node.excludeObservation && !node.observation) invalid('An observation complement requires an observation');
    if (node.observation) {
      const o = node.observation;
      if (!o.outputs || typeof o.outputs !== 'object' || Array.isArray(o.outputs) || !Object.values(o.outputs).every(Array.isArray)) invalid('Property observations require place/token lists');
      if (o.scope && !['listed', 'public'].includes(o.scope)) invalid('Unknown property observation scope');
      if (o.type || o.markings && (typeof o.markings !== 'object' || Array.isArray(o.markings))) invalid('Invalid property observation');
    }
    visit(node.child, depth + 1);
  };
  visit(formula, 0);
  return formula;
}
export function mapFormula(formula, mapModal) {
  if (formula.op === 'marking') return mapModal(formula);
  if (formula.children) return { ...formula, children: formula.children.map(c => mapFormula(c, mapModal)) };
  if (['diamond', 'box'].includes(formula.op)) return { ...mapModal(formula), child: mapFormula(formula.child, mapModal) };
  if (formula.child) return { ...formula, child: mapFormula(formula.child, mapModal) };
  return copy(formula);
}
export function instantiateFormula(formula, values) {
  return mapFormula(formula, node => node.op === 'marking' ? { ...node, markings: instantiateTerm(node.markings, values) } : ({ ...node,
    stimulation: { ...node.stimulation, arguments: instantiateTerm(node.stimulation.arguments, values) },
    ...(node.observation ? { observation: instantiateTerm(node.observation, values) } : {}) }));
}
/** Existing method sequences mean one possible complete path, with universal final refusal. */
export function sequenceFormula(pairs) {
  return pairs.reduceRight((child, pair) => pair.assertion === 'blocked' || pair.observation.type === 'notEnabled'
    ? { op: 'and', children: [{ op: 'box', stimulation: copy(pair.stimulation), child: { op: 'false' } }, { op: 'marking', markings: copy(pair.observation.markings || {}) }] }
    : { op: 'diamond', stimulation: copy(pair.stimulation), observation: copy(pair.observation), child }, { op: 'true' });
}
const term = x => typeof x === 'string' ? x.startsWith('$') ? x : JSON.stringify(x) : Array.isArray(x) ? `[${x.map(term).join(', ')}]` : x?.__pair__ ? `(${term(x.fst)}, ${term(x.snd)})` : x && typeof x === 'object' ? Object.hasOwn(x, 'literal') ? JSON.stringify(x.literal) : JSON.stringify(x) : String(x);
export const formatHmlTerm = term;
export function formulaNotation(node) {
  if (node.op === 'marking') return `marking(${Object.entries(node.markings).map(([p, c]) => `${p}: ${Object.entries(c).map(([k, v]) => `${k} ${term(v)}`).join(' ')}`).join('; ') || 'unconstrained'})`;
  if (node.op === 'true') return '⊤';
  if (node.op === 'false') return '⊥';
  if (node.op === 'not') return `¬(${formulaNotation(node.child)})`;
  if (node.children) return `(${node.children.map(formulaNotation).join(node.op === 'and' ? ' ∧ ' : ' ∨ ')})`;
  const call = `${node.stimulation.method}(${Object.entries(node.stimulation.arguments).map(([n, v]) => `${n}=${term(v)}`).join(', ')})`;
  const obs = node.observation ? [...Object.entries(node.observation.outputs).map(([p, ts]) => `${p} ↦ ⟦${ts.map(term).join(', ')}⟧`), ...Object.entries(node.observation.markings || {}).map(([p, c]) => `${p}: ${Object.entries(c).map(([k, v]) => `${k} ${term(v)}`).join(' ')}`)].join('; ') || 'unconstrained' : '*';
  const label = `${call} / ${node.excludeObservation ? 'not (' + obs + ')' : obs}`;
  return `${node.op === 'diamond' ? '⟨' : '['}${label}${node.op === 'diamond' ? '⟩' : ']'} ${formulaNotation(node.child)}`;
}
