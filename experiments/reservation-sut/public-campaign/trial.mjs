import {adapter, io} from '../experiments/adapters.mjs';
import {editorImport} from '../experiments/runtime.mjs';
const {runBlackBoxExperiment} = await editorImport('src/satel/blackbox/Campaign.js');
const {traceEvidence} = await editorImport('src/satel/blackbox/Experiments.js');

const call = (method, args = {}) => ({method, arguments: args});

export function policy(kind, history) {
  const {stimulation, response} = history.at(-1);
  switch (stimulation.method) {
    case 'open':
      if (response.outputs.ready[0] !== true) return null;
      return kind === 'automatic' ? call('allocate') : call('reserve', {warehouse: kind === 'manual-a' ? 1 : 2});
    case 'allocate':
      return response.outputs.allocated[0] === 1 ? call('reserve', {warehouse: 2}) : call('finish');
    case 'reserve':
      return kind === 'automatic' && response.status === 'refused' ? call('finish') : null;
    default:
      return null;
  }
}

// The caller supplies a reservation at the public initial condition.
// SATEL's adapter initialization hook only opens the page in browser trials.
export async function trial(corpus, kind, base, page) {
  const transport = adapter(base, page);
  const result = await runBlackBoxExperiment({
    referenceNet: corpus.referenceNet, io: corpus.interface,
    calls: [call('open')], continuation: history => policy(kind, history),
    createSut: () => ({interface: io, reset: async () => { if (page) await page.goto(base); }, invoke: transport.invoke})
  }, {maxAdaptivePairs: 4, callTimeoutMs: 15000, maxTimeMs: 60000});
  const tests = corpus.selectedTests.filter(t => (t.id === 'both-choices-1') === (kind !== 'automatic'));
  const hml = Object.fromEntries(tests.map(t => [t.id, result.verdict === 'error' ? 'inconclusive' :
    traceEvidence(t.formula, result.events, corpus.interface, t.expectedTruth).verdict]));
  const {seed, stats, ...record} = result; // No seed is supplied to the application.
  return {kind, ...record, hml};
}
