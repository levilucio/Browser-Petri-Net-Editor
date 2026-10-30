import { compilePublicNet } from './PublicMethods.js';
import { portIdentifier } from './Gates.js';
/** Preserve public responses and all state actually read or asserted. Pure output
 * logs disappear. A log used as state is retained under a fresh internal name.
 * Expectations are retained verbatim, except marking-place renaming.
 */
export function convertOutputPlacesToGates(source) {
  const net = JSON.parse(JSON.stringify(source));
  if (net.gates !== undefined) { compilePublicNet(net); return net; }
  if (net.transitions.some(t => !t.method)) throw new Error('Convert direct-transition examples to public methods before gate migration');
  compilePublicNet(net); // Never discard malformed legacy output arcs during conversion.
  const outputs = net.places.filter(p => p.io_type === 'output');
  const retained = new Set(net.arcs.filter(a => outputs.some(p => p.id === (a.sourceId || a.source))).map(a => a.sourceId || a.source));
  function assertions(value) {
    if (!value || typeof value !== 'object') return;
    for (const id of Object.keys(value.markings || {})) retained.add(id);
    Object.values(value).forEach(assertions);
  }
  assertions(net.testIntentions);
  // Nonempty initial output markings are state, even if not subsequently read.
  outputs.filter(p => p.valueTokens.length).forEach(p => retained.add(p.id));
  const used = new Set([...net.places, ...net.transitions, ...net.arcs].map(x => x.id));
  const rename = new Map();
  for (const p of outputs) if (retained.has(p.id)) {
    let id = `${p.id}_state`; while (used.has(id)) id += '_'; used.add(id); rename.set(p.id, id);
  }
  net.gates = outputs.map(p => ({ name: p.id, parameters: [{ name: 'arg1', sort: p.sort }] }));
  for (const t of net.transitions) t.gates = net.arcs.filter(a => (a.sourceId || a.source) === t.id && outputs.some(p => p.id === (a.targetId || a.target)))
    .map(a => ({ gate: a.targetId || a.target, arguments: [Array.isArray(a.bindings) ? a.bindings[0] : a.binding] }));
  net.arcs = net.arcs.filter(a => !outputs.some(p => p.id === (a.targetId || a.target) && !retained.has(p.id)));
  net.places = net.places.filter(p => p.io_type !== 'output' || retained.has(p.id)).map(p => ({ ...p, id: rename.get(p.id) || p.id, label: rename.get(p.id) || p.label, io_type: 'internal' }));
  for (const a of net.arcs) for (const key of ['source', 'sourceId', 'target', 'targetId']) if (rename.has(a[key])) a[key] = rename.get(a[key]);
  function rewrite(value) {
    if (!value || typeof value !== 'object') return;
    if (value.markings) value.markings = Object.fromEntries(Object.entries(value.markings).map(([id, v]) => [rename.get(id) || id, v]));
    Object.values(value).forEach(rewrite);
  }
  rewrite(net.testIntentions);
  net.apnClass = (net.satelExample?.id || 'APN').replace(/[^A-Za-z0-9_]/g, '_');
  if (!portIdentifier(net.apnClass)) net.apnClass = `APN_${net.apnClass}`;
  net.gateMigration = { retainedState: Object.fromEntries(rename) };
  compilePublicNet(net);
  return net;
}
