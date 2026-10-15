/** Editor-specific SATEL metadata; standard PNML retains the net and marking. */
import { APN_NS } from './constants.js';
import { getPublicMethods } from '../../features/simulation/PublicMethods.js';

export function writeSatelMetadata(doc, netElement, net) {
  const places = (net.places || []).filter(p => p.sort || p.io_type || p.io_description)
    .map(({ id, sort, io_type, io_description }) => ({ id, sort, io_type, io_description }));
  const transitions = (net.transitions || []).filter(t => t.method != null || t.io_type || t.io_description)
    .map(({ id, method, io_type, io_description }) => ({ id, method, io_type, io_description }));
  if (!places.length && !transitions.length && !net.testIntentions && !net.satelExample) return false;
  getPublicMethods(net); // Do not export a malformed declaration as an internal rule.
  const element = doc.createElementNS(APN_NS, 'apn:satel');
  element.setAttribute('version', '1');
  element.textContent = JSON.stringify({ places, transitions, testIntentions: net.testIntentions, satelExample: net.satelExample });
  netElement.appendChild(element);
  return true;
}

export function readSatelMetadata(netElement, net) {
  const elements = [...netElement.getElementsByTagNameNS(APN_NS, 'satel')].filter(e => e.parentElement === netElement);
  if (!elements.length) return;
  try {
    if (elements.length !== 1 || elements[0].getAttribute('version') !== '1') throw new Error('Unsupported SATEL metadata version');
    const metadata = JSON.parse(elements[0].textContent);
    for (const kind of ['places', 'transitions']) {
      if (!Array.isArray(metadata[kind])) throw new Error(`Invalid SATEL ${kind}`);
      const seen = new Set();
      for (const item of metadata[kind]) {
        const target = net[kind].find(x => x.id === item.id);
        if (!target || seen.has(item.id)) throw new Error(`Invalid SATEL element: ${item.id}`);
        seen.add(item.id);
        for (const field of ['io_type', 'io_description', ...(kind === 'places' ? ['sort'] : ['method'])]) {
          if (Object.hasOwn(item, field)) target[field] = item[field];
        }
      }
    }
    if (metadata.testIntentions !== undefined) {
      if (!Array.isArray(metadata.testIntentions)) throw new Error('Invalid saved intentions');
      net.testIntentions = metadata.testIntentions;
    }
    if (metadata.satelExample !== undefined) net.satelExample = metadata.satelExample;
    getPublicMethods(net);
  } catch (cause) {
    const error = new Error(`Invalid SATEL metadata: ${cause.message}`);
    error.satelMetadata = true;
    throw error;
  }
}
