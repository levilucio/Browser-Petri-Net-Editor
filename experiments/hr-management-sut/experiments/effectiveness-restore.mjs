// Reconstruct the exact frozen stimuli from committed concrete witnesses. Does
// not rerun symbolic selection or replace the recorded generation measurements.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync,existsSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {root,editorImport} from './runtime.mjs';import {effectivenessFixture,workLog} from './effectiveness-fixture.mjs';
const {compileSymbolicIntention,encodeProtocolWitness}=await editorImport('src/satel/core/SymbolicSource.js');
const {publicInterface,normalizeTest}=await editorImport('src/satel/core/TestCase.js');
const hash=x=>createHash('sha256').update(x).digest('hex'),manifest=JSON.parse(readFileSync(resolve(root,'results/effectiveness-manifest.json')));
assert.equal(hash(readFileSync(resolve(root,'experiments/effectiveness-fixture.mjs'))),manifest.fixtureSha256);
for(const saved of manifest.suites){
 const {net,intention}=effectivenessFixture(saved.length),io=publicInterface(net),{goal,protocol}=compileSymbolicIntention(intention);
 const tests=saved.witnesses.map(w=>{
  const t=normalizeTest({...encodeProtocolWitness(protocol,[workLog(w.kinds,w.minutes)],w.kinds.filter(k=>k!==0).length,io,goal.algebra),id:w.id},io);
  const base={id:t.id,pairs:t.pairs,...(t.formula?{formula:t.formula}:{})};
  return w.policy==='selected'?{...base,region:w.region,policy:w.policy,kinds:w.kinds,browser:w.browser,minutes:w.minutes}:{...base,region:w.region,policy:w.policy,kinds:w.kinds,minutes:w.minutes,browser:w.browser};
 });
 const raw=JSON.stringify({length:saved.length,referenceNet:net,interface:io,intention,tests});assert.equal(hash(raw),saved.sha256,'Restored suite must exactly match the original frozen bytes');
 const path=resolve(root,`results/effectiveness-suite-${saved.length}.json`);
 if(existsSync(path))assert.equal(hash(readFileSync(path)),saved.sha256,'Do not overwrite a changed suite');else writeFileSync(path,raw);
 console.log(`Restored/verified ${tests.length} exact tests at length ${saved.length}`);
}
