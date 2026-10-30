/** Typed output ports of the flat synchronous method/gate fragment.
 * The environment is receptive: a call and its gate occurrences form one event.
 * Occurrences are transient, never tokens in the successor marking.
 */
import { methodSorts, validBuiltinValue } from '../../utils/builtin-values.js';
import { DomainError } from '../diagnostics.js';
const identifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const portIdentifier = name => typeof name === 'string' && identifier.test(name) && !['__proto__', 'prototype', 'constructor'].includes(name);
const requireThat = (ok, message) => { if (!ok) throw new DomainError('invalid-model', message); };
export function getGates(net) {
  const gates = net.gates === undefined ? [] : net.gates;
  requireThat(Array.isArray(gates), 'Gates must be a list of typed declarations');
  const seen = new Set();
  for (const g of gates) {
    requireThat(g && portIdentifier(g.name) && !seen.has(g.name), 'Gate names must be valid and unique');
    seen.add(g.name);
    requireThat(Array.isArray(g.parameters) && g.parameters.every(p => p && portIdentifier(p.name) && methodSorts.includes(p.sort)), `Invalid parameters for gate ${g.name}`);
    requireThat(new Set(g.parameters.map(p => p.name)).size === g.parameters.length, `Duplicate parameter in gate ${g.name}`);
    requireThat(!(net.places || []).some(p => p.id === g.name), `Gate ${g.name} conflicts with a place ID`);
  }
  return gates;
}
// Existing observation bags carry one value per occurrence. Unary gates use
// their value directly; zero/multi-argument gates use an ordered argument list.
export const gateValueSort = g => g.parameters.length === 1 ? g.parameters[0].sort : 'List';
export function validGateValue(gate, value) {
  const args = gate.parameters.length === 1 ? [value] : value;
  return Array.isArray(args) && args.length === gate.parameters.length && args.every((v, i) => validBuiltinValue(v, gate.parameters[i].sort));
}
export function observationChannels(net) {
  return [...(net.places || []), ...getGates(net).map(g => ({ id: g.name, label: g.name, sort: gateValueSort(g), io_type: 'output', gate: g }))];
}
export function validObservationValue(net, id, value) {
  const g = getGates(net).find(g => g.name === id);
  return g ? validGateValue(g, value) : (net.places || []).some(p => p.id === id && validBuiltinValue(value, p.sort));
}
export const emptyGates = net => Object.fromEntries(getGates(net).map(g => [g.name, []]));
