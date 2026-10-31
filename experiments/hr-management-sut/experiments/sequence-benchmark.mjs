import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { root } from './runtime.mjs';
import { sequenceLengths, selectionOptions, derivationOptions } from './sequence-fixture.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
const trials = [];
for (let trial = 1; trial <= 3; trial++) for (const length of sequenceLengths) {
  const config = { length, trial };
  const child = spawn(process.execPath, [resolve(root, 'experiments/sequence-worker.mjs'), JSON.stringify(config)], { stdio: 'inherit' });
  const timer = setTimeout(() => child.kill('SIGKILL'), 360000);
  const code = await new Promise(resolve => child.once('close', resolve)); clearTimeout(timer);
  assert.equal(code, 0, `Worker failed or reached wall-time limit: ${JSON.stringify(config)}`);
  const row = JSON.parse(readFileSync(resolve(root, `results/sequence-trial-${length}-${trial}.json`))); assert(row.complete); trials.push(row);
}
const first = trials[0];
for (const row of trials) {
  assert.equal(row.goalSha256, first.goalSha256); assert.equal(row.markingSha256, first.markingSha256); assert.equal(row.algebra.signatureSha256, first.algebra.signatureSha256);
  assert.deepEqual(row.tests.map(t => [t.kinds, t.minutes]), first.tests.map(t => [t.kinds, t.minutes]));
  const repeat = trials.find(r => r.config.length === row.config.length); assert.equal(row.suiteSha256, repeat.suiteSha256);
}
const suites = sequenceLengths.map(length => JSON.parse(readFileSync(resolve(root, `results/sequence-suite-${length}-trial-1.json`))));
for (let i = 1; i < suites.length; i++) for (const test of suites[i].tests) {
  const previous = suites[i - 1].tests.find(t => JSON.stringify(t.kinds) === JSON.stringify(test.kinds));
  assert.deepEqual(test.pairs.slice(0, previous.pairs.length), previous.pairs);
}
const sourceFiles = ['experiments/sequence-fixture.mjs', 'experiments/sequence-worker.mjs', 'experiments/sequence-benchmark.mjs',
  '../../petri-net-app/src/satel/core/ExecutableSequence.js', '../../petri-net-app/src/satel/examples/hr/editor.js'];
const manifest = { schemaVersion: 1, frozenAt: new Date().toISOString(), selectionOptions, derivationOptions,
  sourceHashes: Object.fromEntries(sourceFiles.map(path => [path, hash(readFileSync(resolve(root, path)))])),
  trials, invariantChecks: { sameGoal: true, sameInitialMarking: true, sameRegions: true, sameWitnesses: true, identicalRepeatedSuites: true, nestedPrefixes: true },
  suites: suites.map(s => ({ length: s.length, tests: trials.find(r => r.config.length === s.length).tests, sha256: hash(JSON.stringify(s)) })) };
writeFileSync(resolve(root, 'results/sequence-manifest.json'), JSON.stringify(manifest));
for (const s of suites) writeFileSync(resolve(root, `results/sequence-suite-${s.length}.json`), JSON.stringify(s));
console.log(JSON.stringify({ completed: trials.length, testsPerLength: 25, lengths: sequenceLengths, invariants: manifest.invariantChecks }));
