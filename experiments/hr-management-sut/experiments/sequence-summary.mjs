import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root } from './runtime.mjs';
import { sequenceLengths, sequenceMutants } from './sequence-fixture.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
const read = name => JSON.parse(readFileSync(resolve(root, `results/${name}.json`)));
const manifest = read('sequence-manifest');
for (const [path, digest] of Object.entries(manifest.sourceHashes)) assert.equal(hash(readFileSync(resolve(root, path))), digest, path);
const suites = sequenceLengths.map(n => { const raw = readFileSync(resolve(root, `results/sequence-suite-${n}.json`)); assert.equal(hash(raw), manifest.suites.find(s => s.length === n).sha256); return JSON.parse(raw); });
const stat = values => { values = [...values].sort((a, b) => a - b); return { min: values[0], median: values[Math.floor(values.length / 2)], max: values.at(-1) }; };
const summary = { schemaVersion: 1, manifestSha256: hash(JSON.stringify(manifest)), generation: [], variants: [], counterexamples: [], invariants: manifest.invariantChecks };
for (const length of sequenceLengths) {
  const rows = manifest.trials.filter(r => r.config.length === length); assert.equal(rows.length, 3);
  for (const row of rows) {
    assert(row.complete); assert.equal(row.algebra.regions, 25); assert.equal(row.algebra.coverage, 'not-proved');
    assert.equal(row.algebra.unresolved.length + row.algebra.overlaps.length + row.selection.unresolved.length + row.selection.blocked.length, 0);
    assert.equal(row.validation.referencePassed, 25); assert(row.finiteAudit.partitionAndWitnessChecksPass && row.finiteAudit.finiteCoverageComplete);
    assert.equal(row.goalSha256, manifest.trials[0].goalSha256); assert.equal(row.markingSha256, manifest.trials[0].markingSha256);
    assert.equal(row.algebra.signatureSha256, manifest.trials[0].algebra.signatureSha256);
    assert.deepEqual(row.tests.map(t => [t.kinds, t.minutes]), manifest.trials[0].tests.map(t => [t.kinds, t.minutes]));
  }
  const probes = rows.find(r => r.config.trial === 1);
  assert.deepEqual(probes.searchBudgetProbe, { selected: 0, blocked: 0, unresolved: 25, codes: ['resource-limit'] });
  if (length > 32) assert.deepEqual(probes.defaultLengthProbe, { selected: 0, blocked: 0, unresolved: 25, codes: ['sequence-length-limit'] });
  assert.equal(probes.explicitHmlValidation.status, length > 64 ? 'rejected' : 'accepted');
  summary.generation.push({ length, trials: 3, regions: 25, model: rows[0].model,
    phasesMs: Object.fromEntries(Object.keys(rows[0].phases).map(phase => [phase, stat(rows.map(r => r.phases[phase]))])),
    peakRss: stat(rows.map(r => r.peakRss)), searchVisits: rows.map(r => r.selection.visited),
    prefixSolverMs: stat(rows.map(r => r.selection.profile.prefixSolverMs)),
    finiteAudit: rows[0].finiteAudit, defaultLengthProbe: probes.defaultLengthProbe, searchBudgetProbe: probes.searchBudgetProbe, explicitHmlValidation: probes.explicitHmlValidation });
}
for (let i = 1; i < suites.length; i++) for (const test of suites[i].tests) {
  const previous = suites[i - 1].tests.find(t => JSON.stringify(t.kinds) === JSON.stringify(test.kinds));
  assert.deepEqual(test.pairs.slice(0, previous.pairs.length), previous.pairs);
}
for (const mutant of ['none', ...sequenceMutants]) {
  const api = read(`sequence-${mutant}-api`), ui = read(`sequence-${mutant}-ui`), traces = {};
  for (const report of [api, ui]) {
    assert(report.complete); assert.equal(report.manifestSha256, summary.manifestSha256); assert.deepEqual(report.databaseIntegrity, [['ok']]);
    assert.equal(report.backendSha256, hash(readFileSync(resolve(root, 'backend/app.py'))));
    for (const [path, digest] of Object.entries(report.executionSourceHashes)) assert.equal(hash(readFileSync(resolve(root, path))), digest, path);
    const tests = suites.flatMap(s => s.tests).filter(t => report.transport === 'api' || t.browser);
    assert.deepEqual(report.runs.map(r => r.testId).sort(), tests.map(t => t.id).sort());
    traces[report.transport] = readFileSync(resolve(root, `results/sequence-${mutant}-${report.transport}.jsonl`), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(traces[report.transport].length, report.runs.length);
    for (const run of report.runs) {
      const trace = traces[report.transport].find(t => t.testId === run.testId), test = tests.find(t => t.id === run.testId);
      assert.equal(hash(JSON.stringify(trace.events)), run.eventSha256);
      const mismatch = mutant !== 'none' && run.length === 100;
      assert.equal(run.verdict, mismatch ? 'mismatch' : 'compatible');
      assert.equal(run.propertyEvidence.verdict, mismatch ? 'inconclusive' : 'witnessed');
      if (mismatch) { assert.equal(run.reasonCode ?? trace.reasonCode, 'unexpected-output'); assert.equal(run.step, test.kinds[0] === 0 ? 53 : 58); }
      else assert.equal(run.eventCount, run.length);
      if (run.length > 25) {
        const shorter = traces[report.transport].find(t => t.length === (run.length === 100 ? 50 : 25) && JSON.stringify(t.kinds) === JSON.stringify(run.kinds));
        assert.deepEqual(trace.events.slice(0, shorter.events.length), shorter.events);
      }
    }
  }
  for (const u of ui.runs) { const a = api.runs.find(r => r.testId === u.testId); assert.equal(a.verdict, u.verdict); assert.equal(a.eventSha256, u.eventSha256); assert.deepEqual(a.propertyEvidence, u.propertyEvidence); }
  const groups = report => sequenceLengths.map(length => { const runs = report.runs.filter(r => r.length === length); return { length, tests: runs.length,
    compatible: runs.filter(r => r.verdict === 'compatible').length, mismatches: runs.filter(r => r.verdict === 'mismatch').length,
    executedPairs: runs.reduce((n, r) => n + r.eventCount, 0), executionMs: runs.reduce((n, r) => n + r.durationMs, 0),
    mismatchSteps: [...new Set(runs.filter(r => r.verdict === 'mismatch').map(r => r.step))].sort() }; });
  summary.variants.push({ mutant, api: groups(api), ui: groups(ui), apiMs: api.elapsedMs, uiMs: ui.elapsedMs, apiRss: api.rss, uiRss: ui.rss, runtime: { api: api.runtime, ui: ui.runtime },
    matchedTransportRuns: ui.runs.length, identicalEventsAndVerdicts: true,
    propertyEvidence: api.runs.reduce((a, r) => (a[r.propertyEvidence.verdict] = (a[r.propertyEvidence.verdict] || 0) + 1, a), {}) });
  for (const step of [53, 58]) { const run = api.runs.find(r => r.verdict === 'mismatch' && r.step === step); if (run) summary.counterexamples.push({ mutant, counterexampleKind: 'trace-conformance', ...run }); }
}
summary.scope = 'Fixed two-entry ADT goal, 25 computed regions, fixed 87-token initial marking, nested 25/50/100-pair protocols; three serial generation trials. No arbitrary branching, concurrency, uniformity or thesis correspondence claim. Browser runs a predeclared two-region subset per length.';
writeFileSync(resolve(root, 'results/sequence-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary));
