import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, editorRoot, editorImport } from './runtime.mjs';
import { probeCalls, freezeProbeSuite, postRefusalMutants } from './post-refusal-fixture.mjs';
const { derivePostRefusalProbes } = await editorImport('src/satel/blackbox/PostRefusalProbes.js');
const hash = x => createHash('sha256').update(x).digest('hex');
const baseRaw = readFileSync(resolve(root, 'results/negative-suite.json'));
const original = JSON.parse(readFileSync(resolve(root, 'results/negative-manifest.json')));
assert.equal(hash(baseRaw), original.suiteSha256);
const base = JSON.parse(baseRaw), plans = [], start = performance.now();
const limits = { maxStates: 512, maxBindings: 10000, maxTotalBindings: 1000000, maxProbes: 3, maxTimeMs: 30000 };
for (const test of base.tests.filter(t => t.kind === 'negative')) {
  const plan = derivePostRefusalProbes({ referenceNet: base.referenceNet, io: base.interface, test, probeCalls: probeCalls(test) }, limits);
  assert(plan.complete); assert.equal(plan.rejected.length, 0); assert.equal(plan.probes.length, 3);
  plans.push(plan);
}
const first = base.tests.find(t => t.kind === 'negative');
assert.throws(() => derivePostRefusalProbes({ referenceNet: base.referenceNet, io: base.interface, test: first, probeCalls: probeCalls(first) }, { ...limits, maxTotalBindings: 1 }), { code: 'resource-limit' });
const frozen = freezeProbeSuite(base, plans), raw = JSON.stringify(frozen);
const sourceFiles = ['experiments/post-refusal-fixture.mjs', 'experiments/post-refusal-generate.mjs', '../../petri-net-app/src/satel/blackbox/PostRefusalProbes.js', '../../petri-net-app/src/satel/blackbox/Campaign.js'];
const manifest = { schemaVersion: 1, frozenAt: new Date().toISOString(), baseSuiteSha256: hash(baseRaw), suiteSha256: hash(raw),
  sourceHashes: Object.fromEntries(sourceFiles.map(p => [p, hash(readFileSync(resolve(root, p)))])),
  limits, mutants: postRefusalMutants, plans, boundedProbe: { maxTotalBindings: 1, outcome: 'resource-limit', partialPlansPublished: false },
  generationMs: performance.now() - start, rss: process.memoryUsage().rss };
writeFileSync(resolve(root, 'results/post-refusal-manifest.json'), JSON.stringify(manifest));
writeFileSync(resolve(root, 'results/post-refusal-suite.json'), raw);
console.log(JSON.stringify({ negatives: plans.length, probes: plans.reduce((n, p) => n + p.probes.length, 0), apiExperiments: frozen.tests.length,
  uiExperiments: frozen.tests.filter(t => t.browser).length, generationMs: manifest.generationMs, rss: manifest.rss }));
