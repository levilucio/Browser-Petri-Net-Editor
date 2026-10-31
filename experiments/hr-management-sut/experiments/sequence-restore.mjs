import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, editorImport } from './runtime.mjs';
import { sequenceFixture } from './sequence-fixture.mjs';
const { compileSymbolicIntention, encodeProtocolWitness } = await editorImport('src/satel/core/SymbolicSource.js');
const { publicInterface, normalizeTest } = await editorImport('src/satel/core/TestCase.js');
const hash = x => createHash('sha256').update(x).digest('hex');
const manifest = JSON.parse(readFileSync(resolve(root, 'results/sequence-manifest.json')));
for (const [path, digest] of Object.entries(manifest.sourceHashes)) assert.equal(hash(readFileSync(resolve(root, path))), digest, path);
for (const saved of manifest.suites) {
  const { net, intention } = sequenceFixture(saved.length), io = publicInterface(net);
  const { goal, protocol } = compileSymbolicIntention(intention);
  const tests = saved.tests.map(t => {
    const encoded = encodeProtocolWitness(protocol, t.witnessArgs, t.witnessResult, io, goal.algebra);
    const pairs = normalizeTest({ ...encoded, id: t.id }, io).pairs;
    assert.equal(hash(JSON.stringify(pairs)), t.pairsSha256);
    return { id: t.id, region: t.region, kinds: t.kinds, minutes: t.minutes, witnessArgs: t.witnessArgs, witnessResult: t.witnessResult,
      pairs, pairsSha256: t.pairsSha256, browser: t.browser };
  });
  const raw = JSON.stringify({ length: saved.length, referenceNet: net, interface: io, intention, tests });
  assert.equal(hash(raw), saved.sha256);
  const path = resolve(root, `results/sequence-suite-${saved.length}.json`);
  if (existsSync(path)) assert.equal(hash(readFileSync(path)), saved.sha256); else writeFileSync(path, raw);
  console.log(`Verified/restored ${tests.length} tests of ${saved.length} pairs byte for byte.`);
}
