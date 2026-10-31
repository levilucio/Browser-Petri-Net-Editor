import assert from 'node:assert/strict';import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {root,editorImport} from './runtime.mjs';import {negativeFixture} from './negative-fixture.mjs';
const {publicInterface}=await editorImport('src/satel/core/TestCase.js');
const hash=x=>createHash('sha256').update(x).digest('hex');
const manifest=JSON.parse(readFileSync(resolve(root,'results/negative-manifest.json')));
assert.equal(hash(readFileSync(resolve(root,'experiments/negative-fixture.mjs'))),manifest.fixtureSha256);
const {net}=negativeFixture(),raw=JSON.stringify({referenceNet:net,interface:publicInterface(net),tests:manifest.tests});assert.equal(hash(raw),manifest.suiteSha256);
const path=resolve(root,'results/negative-suite.json');if(existsSync(path))assert.equal(hash(readFileSync(path)),manifest.suiteSha256);else writeFileSync(path,raw);
console.log('Verified/restored',manifest.tests.length,'frozen tests byte for byte.');
