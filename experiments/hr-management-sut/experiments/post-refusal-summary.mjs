import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './runtime.mjs';
import { postRefusalMutants } from './post-refusal-fixture.mjs';

const hash = x => createHash('sha256').update(x).digest('hex');
const read = name => JSON.parse(readFileSync(resolve(root, `results/${name}.json`)));
const manifest = read('post-refusal-manifest'), suite = read('post-refusal-suite');
assert.equal(hash(readFileSync(resolve(root, 'results/post-refusal-suite.json'))), manifest.suiteSha256);
assert.equal(hash(readFileSync(resolve(root, 'results/negative-suite.json'))), manifest.baseSuiteSha256);
for (const [path, digest] of Object.entries(manifest.sourceHashes)) assert.equal(hash(readFileSync(resolve(root, path))), digest, path);
const probes = suite.tests.filter(t => t.kind === 'post-refusal-probe');
const summary = {
  schemaVersion: 1, manifestSha256: hash(JSON.stringify(manifest)),
  sourceNegativeTests: manifest.plans.length, probeExperiments: probes.length,
  rejectedProbes: manifest.plans.reduce((n, p) => n + p.rejected.length, 0),
  positiveControls: suite.tests.filter(t => t.kind === 'positive-control').length,
  terminalControls: suite.tests.filter(t => t.kind === 'terminal-refusal').length,
  probeLengthRange: [Math.min(...probes.map(t => t.calls.length)), Math.max(...probes.map(t => t.calls.length))],
  generationMs: manifest.generationMs, generationRss: manifest.rss,
  boundedProbe: manifest.boundedProbe, variants: [], counterexamples: []
};
const byKind = report => Object.fromEntries(['positive-control', 'terminal-refusal', 'post-refusal-probe'].map(kind => {
  const runs = report.runs.filter(r => r.kind === kind);
  return [kind, { runs: runs.length, compatible: runs.filter(r => r.verdict === 'compatible').length, mismatches: runs.filter(r => r.verdict === 'mismatch').length }];
}));
for (const mutant of ['none', ...postRefusalMutants]) {
  const api = read(`post-refusal-${mutant}-api`), ui = read(`post-refusal-${mutant}-ui`);
  for (const report of [api, ui]) {
    assert(report.complete); assert.equal(report.manifestSha256, summary.manifestSha256);
    assert.equal(report.backendSha256, hash(readFileSync(resolve(root, 'backend/app.py'))));
    for (const [path, digest] of Object.entries(report.executionSourceHashes)) assert.equal(hash(readFileSync(resolve(root, path))), digest, path);
    assert.deepEqual(report.databaseIntegrity, [['ok']]);
    const expected = suite.tests.filter(t => report.transport === 'api' || t.browser);
    assert.deepEqual(report.runs.map(r => r.testId).sort(), expected.map(t => t.id).sort());
    const traces = readFileSync(resolve(root, `results/post-refusal-${mutant}-${report.transport}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(traces.length, report.runs.length);
    for (const run of report.runs) {
      const test = suite.tests.find(t => t.id === run.testId), trace = traces.find(t => t.testId === run.testId);
      assert.equal(hash(JSON.stringify(trace.events)), run.eventSha256);
      assert(['compatible', 'mismatch'].includes(run.verdict));
      if (mutant === 'none' || run.kind !== 'post-refusal-probe') assert.equal(run.verdict, 'compatible');
      if (test.refusalStep) {
        assert.equal(run.refusalEvent.response.status, 'refused'); assert(run.refusalEvent.compatibleAfter > 0);
        assert.equal(run.propertyEvidence.verdict, 'inconclusive');
        assert.equal(run.propertyEvidenceScope, 'original-terminal-refusal-property');
      }
      if (test.kind === 'post-refusal-probe') {
        assert.equal(run.eventCount, test.calls.length);
        assert.deepEqual(trace.events.at(-1).expected, test.expectedProbe);
        const terminal = report.runs.find(r => r.sourceTestId === test.sourceTestId && r.kind === 'terminal-refusal');
        assert.equal(terminal.verdict, 'compatible');
      }
      if (run.verdict === 'mismatch') {
        assert.equal(run.kind, 'post-refusal-probe'); assert.equal(run.step, test.refusalStep + 1);
        assert.equal(run.reasonCode, 'unexpected-output');
      }
    }
    if (mutant !== 'none') assert(report.runs.some(r => r.verdict === 'mismatch'), `No detection for ${mutant}/${report.transport}`);
  }
  for (const u of ui.runs) {
    const a = api.runs.find(r => r.testId === u.testId);
    assert.equal(a.verdict, u.verdict); assert.equal(a.eventSha256, u.eventSha256); assert.deepEqual(a.propertyEvidence, u.propertyEvidence);
  }
  const byProbe = Object.fromEntries(['readTime', 'totals', 'readVacation', 'balance', 'auditCount'].map(probe => [probe,
    Object.fromEntries([['api', api], ['ui', ui]].map(([name, report]) => {
      const runs = report.runs.filter(r => r.probe === probe);
      return [name, { runs: runs.length, mismatches: runs.filter(r => r.verdict === 'mismatch').length }];
    }))]));
  summary.variants.push({ mutant, api: byKind(api), ui: byKind(ui), byProbe,
    apiMs: api.elapsedMs, uiMs: ui.elapsedMs, apiRss: api.rss, uiRss: ui.rss,
    matchedTransportRuns: ui.runs.length, identicalEventsAndVerdicts: true,
    propertyEvidence: api.runs.reduce((a, r) => (a[r.propertyEvidence.verdict] = (a[r.propertyEvidence.verdict] || 0) + 1, a), {}) });
  for (const probe of Object.keys(byProbe)) {
    const run = api.runs.find(r => r.probe === probe && r.verdict === 'mismatch');
    if (run) summary.counterexamples.push({ mutant, counterexampleKind: 'trace-conformance-after-refusal', ...run });
  }
}
summary.scope = 'Finite supplied probe calls with APN-derived outcomes and all-compatible-state admission. Separate trace experiments, not extended HML sequences or complete side-effect coverage. Each probe uses a fresh reset; no hidden states are merged across runs.';
writeFileSync(resolve(root, 'results/post-refusal-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, variants: summary.variants.map(v => ({ mutant: v.mutant, api: v.api, ui: v.ui, byProbe: v.byProbe })), counterexamples: summary.counterexamples.length }));
