/** Paper evidence audit, not a new selector or production oracle.
 * From petri-net-app:
 * node tools/node/run-satel-black-box.js /tmp/satel-black-box-current.json
 * node tools/node/audit-satel-black-box-evidence.js /tmp/satel-black-box-current.json ../docs/satel/experiments/black-box-evidence-audit-2026-10-24.json
 * Omit both arguments for a historical-data and finite-LTS check on stdout.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { traceEvidence } from '../../src/satel/blackbox/Experiments.js';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const historicalPath = 'docs/satel/experiments/black-box-2026-10-19.json';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha256 = text => createHash('sha256').update(text).digest('hex');
const historical = read(path.join(root, historicalPath));
const current = process.argv[2] ? read(process.argv[2]) : null;
const tally = (rows, key) => rows.reduce((out, row) => {
  const value = key(row); out[value] = (out[value] || 0) + 1; return out;
}, {});
const normalizedRun = r => ({ testId: r.testId, pathIndex: r.pathIndex,
  repetition: r.repetition, seed: r.seed, verdict: r.verdict,
  propertyValue: r.propertyEvidence ? r.propertyEvidence.value : r.propertyValue,
  propertyVerdict: r.propertyEvidence ? r.propertyEvidence.verdict : r.propertyVerdict });
function summarize(campaigns) {
  const summaries = campaigns.map(c => {
    const runs = c.runs.map(normalizedRun);
    assert.equal(runs.length, c.total);
    const counts = tally(runs, r => r.verdict);
    const evidence = tally(runs, r => r.propertyVerdict);
    for (const [key, value] of Object.entries(c.counts)) assert.equal(counts[key] || 0, value);
    for (const [key, value] of Object.entries(c.evidenceCounts)) assert.equal(evidence[key] || 0, value);
    const paths = c.paths || [...new Map(c.runs.map(r => [r.testId + ':' + r.pathIndex,
      { testId: r.testId, pathIndex: r.pathIndex, calls: r.calls }])).values()];
    return { intention: c.intention, sut: c.sutName, total: c.total,
      counts: c.counts, evidenceCounts: c.evidenceCounts,
      jointCounts: tally(runs, r => r.verdict + '/' + r.propertyVerdict),
      paths: paths.map(p => ({ ...p,
        counts: tally(runs.filter(r => r.testId === p.testId && r.pathIndex === p.pathIndex), r => r.verdict) })) };
  });
  const runs = campaigns.flatMap(c => c.runs.map(normalizedRun));
  return { executions: runs.length, counts: tally(runs, r => r.verdict),
    evidenceCounts: tally(runs, r => r.propertyVerdict),
    jointCounts: tally(runs, r => r.verdict + '/' + r.propertyVerdict), campaigns: summaries };
}
const historicalSummary = summarize(historical.campaigns);
assert.equal(historicalSummary.executions, 240);
assert.deepEqual(historicalSummary.jointCounts, {
  'compatible/inconclusive': 160, 'mismatch/inconclusive': 64, 'mismatch/counterexample': 16
});
let replay = null;
if (current) {
  assert.equal(current.reports.length, historical.campaigns.length);
  for (const [i, c] of current.reports.entries()) {
    const previous = historical.campaigns[i];
    assert.equal(c.sutName, previous.sutName);
    assert.equal(c.intention, previous.intention);
    assert.deepEqual(c.runs.map(normalizedRun), previous.runs.map(normalizedRun));
  }
  const summary = summarize(current.reports);
  assert.deepEqual(summary, historicalSummary);
  replay = { generatedAt: current.generatedAt, all240RunIdentitiesAndVerdictsMatch: true,
    note: 'Comparison excludes timings; historical data retains full step evidence only for representative mismatches.',
    semanticRunsSha256: sha256(JSON.stringify(current.reports.map(c => ({
      intention: c.intention, sut: c.sutName,
      runs: c.runs.map(r => ({ ...normalizedRun(r), calls: r.calls,
        observations: r.events.map(e => ({ stimulation: e.stimulation, response: e.response })) }))
    })))), summary };
}

// Independent finite LTS definitions. Accepted calls consume the choice; every
// disabled call is an explicit, state-preserving refusal. All traces are finite.
const calls = ['open', 'left', 'right'];
const value = { open: 0, left: 1, right: 2 };
const model = choices => ({ idle: { open: choices },
  both: { left: ['done'], right: ['done'] }, left: { left: ['done'] },
  right: { right: ['done'] }, done: {} });
const plus = model(['both', 'left', 'right']);
const minus = model(['left', 'right']);
const originalReference = model(['both', 'left']);
function edges(m, state, call) {
  const next = m[state][call];
  return next ? next.map(to => ({ to, call, status: 'accepted', output: value[call] }))
    : [{ to: state, call, status: 'refused', output: null }];
}
const label = e => JSON.stringify([e.call, e.status, e.output]);
const alphabet = calls.flatMap(c => [JSON.stringify([c, 'accepted', value[c]]), JSON.stringify([c, 'refused', null])]);
function step(m, states, a) {
  return [...new Set(states.flatMap(s => calls.flatMap(c => edges(m, s, c)))
    .filter(e => label(e) === a).map(e => e.to))].sort();
}
// Exhaustive reachable subset-product exploration decides finite trace-language
// equality for these finite NFAs, including explicit refusals (no depth cutoff).
function compareLanguages(a, b) {
  const queue = [[['idle'], ['idle'], []]], seen = new Set();
  for (let i = 0; i < queue.length; i++) {
    const [left, right, witness] = queue[i], key = JSON.stringify([left, right]);
    if (seen.has(key)) continue;
    seen.add(key);
    if (!!left.length !== !!right.length) return { equal: false, statesVisited: seen.size, distinguishingHistory: witness };
    for (const symbol of alphabet) queue.push([step(a, left, symbol), step(b, right, symbol), [...witness, JSON.parse(symbol)]]);
  }
  return { equal: true, statesVisited: seen.size, depthBound: null };
}
const diamond = (method, child = { op: 'true' }) => ({ op: 'diamond',
  stimulation: { method, arguments: {} }, observation: { outputs: { reply: [value[method]] } }, child });
const shared = diamond('open', { op: 'and', children: [diamond('left'), diamond('right')] });
// This tiny exact evaluator is deliberately independent of APN successor code.
function truth(m, state, f) {
  if (f.op === 'true' || f.op === 'false') return f.op === 'true';
  if (f.op === 'not') return !truth(m, state, f.child);
  if (f.children) return f.op === 'and' ? f.children.every(c => truth(m, state, c)) : f.children.some(c => truth(m, state, c));
  const matching = edges(m, state, f.stimulation.method).filter(e => e.status === 'accepted'
    && (!f.observation || e.output === f.observation.outputs.reply[0]));
  return f.op === 'diamond' ? matching.some(e => truth(m, e.to, f.child)) : matching.every(e => truth(m, e.to, f.child));
}
const io = { outputs: ['reply'] };
const event = e => ({ stimulation: { method: e.call, arguments: {} },
  response: { status: e.status, outputs: { reply: e.status === 'accepted' ? [e.output] : [] } } });
const formulas = [shared, diamond('open'), diamond('open', diamond('left')),
  { ...diamond('open'), op: 'box', child: { op: 'false' } },
  { op: 'not', child: shared },
  { op: 'not', child: diamond('open', diamond('right')) },
  { ...diamond('open'), op: 'box', child: diamond('left') },
  { op: 'or', children: [shared, diamond('open', diamond('left'))] }];
let historiesChecked = 0, evidenceChecks = 0, definiteChecks = 0;
const sharedEvidence = { witnessed: 0, counterexample: 0, inconclusive: 0 };
for (const m of [plus, minus]) {
  const histories = [{ state: 'idle', events: [] }];
  for (let i = 0; i < histories.length; i++) {
    const h = histories[i]; historiesChecked++;
    for (const f of formulas) {
      const exact = truth(m, 'idle', f);
      for (const expectedTruth of [true, false]) {
        const evidence = traceEvidence(f, h.events, io, expectedTruth); evidenceChecks++;
        if (evidence.value !== null) {
          definiteChecks++; assert.equal(evidence.value, exact);
          assert.equal(evidence.verdict, exact === expectedTruth ? 'witnessed' : 'counterexample');
        } else assert.equal(evidence.verdict, 'inconclusive');
      }
    }
    sharedEvidence[traceEvidence(shared, h.events, io).verdict]++;
    if (h.events.length < 3) for (const c of calls) for (const e of edges(m, h.state, c)) {
      histories.push({ state: e.to, events: [...h.events, event(e)] });
    }
  }
}
const equality = compareLanguages(plus, minus);
const original = compareLanguages(originalReference, minus);
assert.equal(equality.equal, true);
assert.equal(original.equal, false);
assert.equal(truth(plus, 'idle', shared), true);
assert.equal(truth(minus, 'idle', shared), false);
assert.equal(sharedEvidence.witnessed + sharedEvidence.counterexample, 0);
const sourcePaths = [historicalPath, 'petri-net-app/src/satel/blackbox/Campaign.js',
  'petri-net-app/src/satel/blackbox/Experiments.js', 'petri-net-app/src/satel/blackbox/DemoSystems.js',
  'petri-net-app/src/domain/apn/PublicMethods.js', 'petri-net-app/src/satel/core/HmlEvaluator.js',
  'petri-net-app/src/satel/core/Observations.js', 'petri-net-app/tools/node/run-satel-black-box.js',
  'petri-net-app/tools/node/audit-satel-black-box-evidence.js'];
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(),
  inspectedCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  scope: 'Historical arithmetic audit, optional fresh replay comparison, and synthetic finite-LTS observability check. No thesis-correspondence or general implementation proof.',
  historical: historicalSummary, freshReplay: replay,
  synthetic: { definitions: { plus: plus.idle.open, minus: minus.idle.open },
    refusalTraceLanguageEquality: equality, originalChoiceDistinguishedByRefusals: original,
    sharedBranchingTruth: { plus: true, minus: false },
    evidenceChecks: { maxCalls: 3, formulaCount: formulas.length, polarities: 2,
      historiesChecked, evidenceChecks, definiteChecks, disagreements: 0, sharedEvidence },
    caveat: 'Language equality is exhaustive for these finite models; traceEvidence checking is bounded to the listed formulas and histories. No probabilistic or seed-control equivalence is asserted.' },
  sourceSha256: Object.fromEntries(sourcePaths.map(p => [p, sha256(fs.readFileSync(path.join(root, p)))])) };
const output = JSON.stringify(report, null, 2) + '\n';
if (process.argv[3]) fs.writeFileSync(process.argv[3], output); else process.stdout.write(output);
