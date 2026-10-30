/** Editor-specific SATEL metadata; standard PNML retains the net and marking. */
import { compilePublicNet } from '../../domain/apn/PublicMethods.js';
import { APN_NS } from './constants.js';
import { getPublicMethods } from '../../features/simulation/PublicMethods.js';

export function writeSatelMetadata(doc, netElement, net) {
  const hasGates = net.gates !== undefined || (net.transitions || []).some(t => t.gates !== undefined);
  const places = (net.places || []).filter(p => p.sort || p.io_type || p.io_description)
    .map(({ id, sort, io_type, io_description }) => ({ id, sort, io_type, io_description }));
  const transitions = (net.transitions || []).filter(t => t.method != null || t.gates !== undefined || t.io_type || t.io_description)
    .map(({ id, method, gates, io_type, io_description }) => ({ id, method, gates, io_type, io_description }));
  if (!places.length && !transitions.length && !net.testIntentions && !net.satelExample && net.gates === undefined) return false;
  getPublicMethods(net); // Do not export a malformed declaration as an internal rule.
  const element = doc.createElementNS(APN_NS, 'apn:satel');
  if (hasGates) compilePublicNet(net);
  element.setAttribute('version', hasGates ? '2' : '1');
  element.textContent = JSON.stringify({ places, transitions, gates: hasGates ? net.gates ?? [] : undefined, apnClass: net.apnClass, testIntentions: net.testIntentions, satelExample: net.satelExample }).replace(/[\ufffe\uffff]/g, ch => '\\u' + ch.charCodeAt(0).toString(16));
  netElement.appendChild(element);
  return true;
}

export function readSatelMetadata(netElement, net) {
  const elements = [...netElement.getElementsByTagNameNS(APN_NS, 'satel')].filter(e => e.parentElement === netElement);
  if (!elements.length) return;
  try {
    if (elements.length !== 1 || !['1', '2'].includes(elements[0].getAttribute('version'))) throw new Error('Unsupported SATEL metadata version');
    const metadata = JSON.parse(elements[0].textContent);
    if (elements[0].getAttribute('version') === '2' && !Array.isArray(metadata.gates)) throw new Error('Version 2 requires gate declarations');
    if (elements[0].getAttribute('version') === '1' && (metadata.gates !== undefined || metadata.transitions?.some(t => t.gates !== undefined))) throw new Error('Gate metadata requires version 2');
    for (const kind of ['places', 'transitions']) {
      if (!Array.isArray(metadata[kind])) throw new Error(`Invalid SATEL ${kind}`);
      const seen = new Set();
      for (const item of metadata[kind]) {
        const target = net[kind].find(x => x.id === item.id);
        if (!target || seen.has(item.id)) throw new Error(`Invalid SATEL element: ${item.id}`);
        seen.add(item.id);
        for (const field of ['io_type', 'io_description', ...(kind === 'places' ? ['sort'] : ['method', 'gates'])]) {
          if (Object.hasOwn(item, field)) target[field] = item[field];
        }
      }
    }
    if (metadata.testIntentions !== undefined) {
      if (!Array.isArray(metadata.testIntentions)) throw new Error('Invalid saved intentions');
      net.testIntentions = metadata.testIntentions;
    }
    if (metadata.satelExample !== undefined) net.satelExample = metadata.satelExample;
    if (metadata.gates !== undefined) {
      net.gates = metadata.gates;
      net.apnClass = metadata.apnClass;
      compilePublicNet(net);
    }
    getPublicMethods(net);
  } catch (cause) {
    const error = new Error(`Invalid SATEL metadata: ${cause.message}`);
    error.satelMetadata = true;
    throw error;
  }
}
