import { performance } from 'node:perf_hooks';
import { createSymbolicSolver } from '../../../src/satel/core/SymbolicZ3.js';
import { deriveGenericSubdomains, findConstraintWitness, prepareAlgebra } from '../../../src/satel/core/GenericSubuniformity.js';
import { deriveIntention } from '../../../src/satel/core/IntentionPipeline.js';
import { admitIntention } from '../../../src/satel/core/Admission.js';
import { evaluateOracleSuite } from '../../../src/satel/core/ValidatedSubuniformity.js';
import { variablesIn } from '../../../src/satel/core/SymbolicTerms.js';
import { compileSymbolicIntention, parseSymbolicSource } from '../../../src/satel/core/SymbolicSource.js';
import { fulfilment, workerService, allocationService } from '../../../src/satel/examples/scale/models.js';
import { allocation, invoice, decomposition } from './solver-cases.js';
import { getContext } from '../../../src/utils/z3/context.js';
import { setLogLevel } from '../../../src/utils/logger.js';
setLogLevel('silent');
const config = JSON.parse(process.argv[2]), samples = [];
const round = x => Math.round(x * 100) / 100;
const nodes = x => !x || typeof x !== 'object' ? 1 : 1 + Object.values(x).reduce((n, t) => n + nodes(t), 0);
const limits = { timeoutMs: 1000, maxTimeMs: 4000, maxBranches: 256, maxSequenceTimeMs: 5000, maxSequenceBranches: 100000, maxHmlSelectionTimeMs: 4000, ...(config.limits || {}) };
let initStart = performance.now(); await getContext();
const warm = await createSymbolicSolver(parseSymbolicSource(''), limits);
await warm({ terms: [], conditions: [true], variables: {}, witness: false });
const initializationMs = round(performance.now() - initStart);
for (let trial = 0; trial < (config.repeats ?? 3); trial++) {
  let metrics = { calls: 0, adapterMs: 0, statuses: {}, unknownReasons: {}, maxDeclaredVariables: 0, maxConditions: 0, maxVariables: 0, maxTermNodes: 0 };
  let started = performance.now();
  const net = config.family === 'resource-apn' ? allocationService(config) : config.family === 'fulfilment' ? fulfilment(config) : config.family === 'workers' ? workerService(config) : null;
  const request = net ? compileSymbolicIntention(net.testIntentions[0]).goal : config.family === 'allocation' ? allocation(config) : config.family === 'invoice' ? invoice(config) : decomposition(config);
  const buildMs = performance.now() - started;
  const base = await createSymbolicSolver(prepareAlgebra(request.algebra), limits);
  const solve = async query => {
    metrics.calls++; metrics.maxConditions = Math.max(metrics.maxConditions, query.conditions.length);
    metrics.maxVariables = Math.max(metrics.maxVariables, Object.keys(query.variables).length);
    metrics.maxDeclaredVariables = Math.max(metrics.maxDeclaredVariables, variablesIn(query.witness === false ? query.conditions : [query.terms, query.conditions]).size);
    metrics.maxTermNodes = Math.max(metrics.maxTermNodes, nodes(query.conditions));
    const t = performance.now(), result = await base(query);
    metrics.adapterMs += performance.now() - t;
    if (result.status === 'unknown') metrics.unknownReasons[result.reason] = (metrics.unknownReasons[result.reason] || 0) + 1;
    metrics.statuses[result.status] = (metrics.statuses[result.status] || 0) + 1;
    return result;
  };
  started = performance.now(); let result, status, details = {}, admissionMs = 0, replayMs = 0, mutants = [];
  try {
    if (config.family === 'allocation') {
      result = await solve(request); status = result.status;
      if (status === 'sat' && config.unsat) throw new Error('Unsatisfiable slot-allocation control returned SAT');
      if (status === 'unsat' && !config.unsat) throw new Error('Planted satisfiable control returned UNSAT');
      details.reason = result.reason;
    } else if (config.family === 'invoice') {
      result = await findConstraintWitness(request, { ...limits, solve, preserveBooleanStructure: true }); status = result.status;
      details.unresolved = result.unresolved.slice(0, 3).map(x => x.reason);
      if (status === 'unsat') throw new Error('Known feasible invoice returned UNSAT');
    } else if (config.family === 'decomposition') {
      result = await deriveGenericSubdomains(request, { ...limits, solve });
      status = result.unresolved.length ? 'partial' : 'complete';
      details = { classes: result.domains.length, unresolved: result.unresolved.length, overlaps: result.overlaps.length, unknownOverlapChecks: result.overlaps.filter(x => x.status === 'unknown').length, reasons: [...new Set(result.unresolved.map(x => x.reason))], coverage: result.coverage };
    } else {
      result = await deriveIntention(net.testIntentions[0], net, { ...limits, solve });
      const e = result.execution;
      status = result.encodingError ? 'encoding-error' : result.decomposition.unresolved.length || e?.unresolved.length ? 'unresolved' : e?.blocked.length ? 'blocked' : e?.selected.length ? 'selected' : 'no-tests';
      details = { places: net.places.length, transitions: net.transitions.length, arcs: net.arcs.length, jsonBytes: Buffer.byteLength(JSON.stringify(net)), sequencePairs: config.family === 'fulfilment' ? config.cycles * 5 : 2, propertyModalDepth: config.family === 'workers' ? config.rounds * 2 : 0, classes: result.decomposition.domains.length, visited: e?.visited, prefixChecks: e?.prefixChecks, pruned: e?.pruned, selected: e?.selected.map(x => ({ witness: x.witnessArgs, paths: x.execution.pathsTried, hml: x.execution.hmlSelection })), reasons: [result.encodingError, ...result.decomposition.unresolved.map(x => x.reason), ...(e?.unresolved || []).map(x => x.reason), ...(e?.blocked || []).map(x => x.reason)].filter(Boolean) };
    }
    const selectionMs = performance.now() - started;
    if (net && status === 'selected') {
      const t = performance.now();
      const suite = await admitIntention(result, net, limits); admissionMs = performance.now() - t;
      if (!suite.selectedTests.length) throw new Error('Selection produced no reference-admitted tests');
      const t2 = performance.now(), replay = await evaluateOracleSuite(suite.selectedTests, net, suite.interface, limits); replayMs = performance.now() - t2;
      if (replay.counts.pass !== suite.selectedTests.length || replay.counts.error || replay.counts.fail) throw new Error('Reference replay failed');
      details.reference = replay.counts;
      if (trial === 0 && config.mutations) {
        for (const mutation of config.family === 'resource-apn' ? ['missing-confirmation', 'wrong-allocation'] : config.family === 'fulfilment' ? ['missing-dispatch', 'wrong-receipt', 'stock-leak'] : ['missing-worker', 'wrong-receipt']) {
          const changed = config.family === 'resource-apn' ? allocationService({ ...config, mutant: mutation }) : config.family === 'fulfilment' ? fulfilment({ ...config, mutant: mutation }) : workerService({ ...config, mutant: mutation });
          const r = await evaluateOracleSuite(suite.selectedTests, changed, suite.interface, limits);
          mutants.push({ id: mutation, ...r.counts, failures: r.results.filter(x => x.verdict !== 'pass').map(x => ({ reason: x.reason, step: x.step })) });
          if (r.counts.error || mutation !== 'stock-leak' && !r.counts.fail) throw new Error(`Mutation control failed: ${mutation}`);
        }
      }
    }
    const sample = { trial, status, buildMs: round(buildMs), selectionMs: round(selectionMs), admissionMs: round(admissionMs), replayMs: round(replayMs), solver: { ...metrics, adapterMs: round(metrics.adapterMs) }, details, mutants, rssMiB: round(process.memoryUsage().rss / 2 ** 20), peakRssMiB: round(process.resourceUsage().maxRSS / 1024) };
    samples.push(sample); process.stdout.write(JSON.stringify({ type: 'sample', sample }) + '\n');
  } catch (error) {
    const sample = { trial, status: 'error', reason: error.message, elapsedMs: round(performance.now() - started), solver: metrics };
    samples.push(sample); process.stdout.write(JSON.stringify({ type: 'sample', sample }) + '\n');
  }
}
process.stdout.write(JSON.stringify({ type: 'done', initializationMs, limits }) + '\n');
process.exit(0);
