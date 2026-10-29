import { validGateValue } from '../../domain/apn/Gates.js';
import { compilePublicNet, enumerateMethodSuccessors, isMethodRule, markingKey } from '../../domain/apn/PublicMethods.js';
import { publicInterface } from '../core/TestCase.js';
import { checkInterface } from '../core/SequenceRunner.js';
import { equalTokenBags, validBuiltinValue } from '../../utils/builtin-values.js';
import { copy } from '../../domain/snapshots.js';
import { checkCancelled, DomainError, diagnostic } from '../../domain/diagnostics.js';
import { experimentsForTest, traceEvidence } from './Experiments.js';

const positive = (v, name) => { if (!Number.isInteger(v) || v < 1) throw new DomainError('invalid-campaign', `${name} must be a positive integer`); return v; };
const emptyOutputs = io => Object.fromEntries(io.outputs.map(p => [p, []]));
const project = (produced, io) => Object.fromEntries(io.outputs.map(p => [p, produced[p] || []]));
const sameOutputs = (a, b, io) => io.outputs.every(p => equalTokenBags(a[p], b[p]));

function checkResponse(response, io) {
  if (!response || !['accepted', 'refused', 'timeout'].includes(response.status)) throw new DomainError('adapter-error', 'SUT must return accepted, refused, or timeout');
  if (response.status === 'timeout') return;
  const outputs = response.outputs;
  if (!outputs || Array.isArray(outputs) || JSON.stringify(Object.keys(outputs).sort()) !== JSON.stringify([...io.outputs].sort())
    || io.outputs.some(p => !Array.isArray(outputs[p]) || !outputs[p].every(v => { const g = io.gates?.find(g => g.name === p); return g ? validGateValue(g, v) : validBuiltinValue(v, io.outputSorts[p]); }))
    || response.status === 'refused' && Object.values(outputs).some(tokens => tokens.length)) {
    throw new DomainError('adapter-error', 'SUT response must contain one typed token list per public output; a refusal produces none');
  }
}

/** Bounds every async adapter operation; a fresh instance is used after timeouts.
 * The adapter receives cancellation; arbitrary external code may ignore it. */
async function adapterOperation(work, timeoutMs, signal) {
  checkCancelled(signal);
  const controller = new AbortController();
  let timer, onAbort;
  try {
    return await Promise.race([
      Promise.resolve().then(() => work(controller.signal)),
      new Promise((_, reject) => {
        onAbort = () => { controller.abort(); reject(new DomainError('cancelled', 'SATEL operation cancelled')); };
        signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => { controller.abort(); reject(new DomainError('adapter-timeout', 'SUT operation timed out; enabledness is unknown')); }, timeoutMs);
      })
    ]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}

/** One call/response history checked against ALL compatible reference markings.
 * All reference successor searches must complete before the next external call.
 * A reference limit stops the run, never rejects the SUT or drops possibilities. */
export async function runBlackBoxExperiment({ referenceNet, io = publicInterface(referenceNet), calls, createSut, seed = 1 }, options = {}) {
  io = copy(io); calls = copy(calls);
  const events = [], started = Date.now();
  const maxStates = positive(options.maxStates ?? 512, 'maxStates');
  const maxBindings = positive(options.maxBindings ?? 10000, 'maxBindings');
  const maxTotalBindings = positive(options.maxTotalBindings ?? 100000, 'maxTotalBindings');
  const maxTimeMs = positive(options.maxTimeMs ?? 10000, 'maxTimeMs');
  const callTimeoutMs = positive(options.callTimeoutMs ?? 2000, 'callTimeoutMs');
  let states = [copy(referenceNet)], bindingVisits = 0;
  const result = (verdict, reason, extra = {}) => ({ verdict, reason, seed, events, stats: { bindingVisits, durationMs: Date.now() - started }, ...extra });
  const budget = () => {
    checkCancelled(options.signal);
    if (Date.now() - started > maxTimeMs) throw new DomainError('resource-limit', 'Reference/execution time budget reached');
  };
  try {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new DomainError('invalid-campaign', 'seed must be an unsigned 32-bit integer');
    const net = states[0];
    if (!['algebraic', 'algebraic-int'].includes(net.mode) || !net.transitions.length || net.transitions.some(t => !isMethodRule(t))) throw new DomainError('unsupported-model', 'Black-box replay requires synchronous public-method APNs');
    checkInterface(net, io);
    compilePublicNet(net);
    // Validate all call signatures before touching the SUT, including later calls.
    if (!Array.isArray(calls)) throw new DomainError('invalid-test', 'An experimental call list is required');
    for (const call of calls) {
      const m = io.methods.find(m => m.name === call.method);
      if (!m || !call.arguments || JSON.stringify(Object.keys(call.arguments).sort()) !== JSON.stringify(m.parameters.map(p => p.name).sort())
        || m.parameters.some(p => !validBuiltinValue(call.arguments[p.name], p.sort))) throw new DomainError('invalid-test', 'Invalid experimental method call');
    }
    // No model, tests, or expected results are passed into this factory.
    const sut = createSut();
    if (!sut || typeof sut.reset !== 'function' || typeof sut.invoke !== 'function') throw new DomainError('adapter-error', 'SUT adapter requires reset and invoke');
    checkInterface(net, sut.interface);
    if (JSON.stringify([...sut.interface.outputs].sort()) !== JSON.stringify([...io.outputs].sort())) throw new DomainError('interface-mismatch', 'SUT and saved reference must expose the same outputs');
    await adapterOperation(signal => sut.reset({ seed, signal }), callTimeoutMs, options.signal);
    for (const [index, stimulation] of copy(calls).entries()) {
      budget();
      const alternatives = [];
      for (const state of states) {
        const search = enumerateMethodSuccessors(state, stimulation.method, stimulation.arguments, { maxBindings, signal: options.signal, onVisit: () => {
          budget(); if (++bindingVisits > maxTotalBindings) throw new DomainError('resource-limit', 'Total reference binding budget reached');
        } });
        if (!search.complete) return result('inconclusive', search.reason, { step: index + 1 });
        if (!search.successors.length) alternatives.push({ status: 'refused', outputs: emptyOutputs(io), next: state });
        for (const edge of search.successors) alternatives.push({ status: 'accepted', outputs: project(edge.produced, io), next: edge.next });
      }
      const raw = copy(await adapterOperation(signal => sut.invoke(copy(stimulation), { signal }), callTimeoutMs, options.signal));
      checkResponse(raw, io);
      // Only declared protocol observations enter the evidence, even if an adapter
      // accidentally returns extra fields containing implementation details.
      const response = { status: raw.status, ...(raw.outputs ? { outputs: raw.outputs } : {}) };
      if (response.status === 'timeout') return result('inconclusive', 'SUT reported a timeout; enabledness is unknown', { step: index + 1 });
      budget();
      const matching = alternatives.filter(a => a.status === response.status && sameOutputs(a.outputs, response.outputs, io));
      const next = new Map(matching.map(a => [markingKey(a.next), a.next]));
      const expected = [...new Map(alternatives.map(a => [JSON.stringify([a.status, a.outputs]), { status: a.status, outputs: a.outputs }])).values()];
      events.push({ step: index + 1, stimulation, response, compatibleBefore: states.length, compatibleAfter: next.size, expected });
      if (!matching.length) {
        const reasonCode = response.status === 'refused' ? 'unexpected-refusal' : alternatives.every(a => a.status === 'refused') ? 'unexpected-acceptance' : 'unexpected-output';
        const reason = reasonCode === 'unexpected-refusal' ? 'The SUT refused the call, but every compatible reference state accepts it.'
          : reasonCode === 'unexpected-acceptance' ? 'The SUT accepted the call, but every compatible reference state refuses it.'
            : 'The SUT output matches no outcome from any compatible reference state.';
        return result('mismatch', reason, { reasonCode, step: index + 1 });
      }
      if (next.size > maxStates) return result('inconclusive', 'Compatible reference state budget reached; no states were discarded', { step: index + 1 });
      states = [...next.values()];
    }
    return result('compatible', 'This observed execution is permitted by the reference. Unobserved alternatives remain unchecked.');
  } catch (error) {
    if (error.code === 'cancelled') throw error;
    return result(['resource-limit', 'adapter-timeout'].includes(error.code) ? 'inconclusive' : 'error', error.message, { diagnostic: diagnostic(error, 'black-box-replay'), step: events.length + 1 });
  }
}

/** Fixed, reproducible seed campaign. Frequencies are descriptive, not confidence
 * intervals: these schedules are not claimed to be IID operational samples. */
export async function runBlackBoxCampaign({ suite, createSut, repetitions = 16, baseSeed = 1, sutName = 'External SUT' }, options = {}) {
  positive(repetitions, 'repetitions');
  if (!Number.isInteger(baseSeed) || baseSeed < 0 || baseSeed > 0xffffffff) throw new DomainError('invalid-campaign', 'baseSeed must be an unsigned 32-bit integer');
  if (!suite?.referenceNet || !suite.interface || !suite.selectedTests?.length) throw new DomainError('invalid-campaign', 'Generate and admit a reference suite first');
  suite = copy(suite);
  const plans = suite.selectedTests.map(t => experimentsForTest(t, suite.interface, positive(options.maxPaths ?? 64, 'maxPaths')));
  const total = plans.reduce((n, p) => n + p.paths.length * repetitions, 0);
  if (total > positive(options.maxRuns ?? 2048, 'maxRuns')) throw new DomainError('resource-limit', 'Campaign run budget exceeded');
  const runs = [], counts = { compatible: 0, mismatch: 0, inconclusive: 0, error: 0 }, evidenceCounts = { witnessed: 0, counterexample: 0, inconclusive: 0 };
  for (const plan of plans) for (const [pathIndex, calls] of plan.paths.entries()) for (let repetition = 0; repetition < repetitions; repetition++) {
    checkCancelled(options.signal);
    // Yield for progress/cancellation even with purely synchronous local adapters.
    await new Promise(resolve => setTimeout(resolve, 0));
    const seed = (baseSeed + Math.imul(repetition, 0x9e3779b9)) >>> 0;
    const run = await runBlackBoxExperiment({ referenceNet: suite.referenceNet, io: suite.interface, calls, createSut, seed }, options);
    const evidence = traceEvidence(plan.formula, run.events, suite.interface, plan.test.expectedTruth ?? true);
    // Broken adapters provide no trustworthy property evidence.
    if (run.verdict === 'error') Object.assign(evidence, { value: null, verdict: 'inconclusive', reason: 'Adapter/reference error; no property verdict is available.' });
    runs.push({ ...run, testId: plan.test.id, pathIndex, repetition, calls, propertyEvidence: evidence });
    counts[run.verdict]++; evidenceCounts[evidence.verdict]++;
    options.onProgress?.({ current: runs.length, total });
  }
  return { schemaVersion: 1, sutName, repetitions, baseSeed, total, counts, evidenceCounts, runs,
    policy: 'Fresh instance and declared initial configuration per path/run; deterministic seed schedule; no confidence or exhaustive HML claim.',
    referenceName: suite.referenceNet.satelExample?.name || 'Saved reference APN' };
}
