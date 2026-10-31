// Reconstruct frozen histories from recorded witnesses, with no new SMT selection.
import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';import {root,editorImport} from './runtime.mjs';import {stressFixture} from './stress-fixture.mjs';
const {compileSymbolicIntention,encodeProtocolWitness}=await editorImport('src/satel/core/SymbolicSource.js');const {normalizeTest,publicInterface}=await editorImport('src/satel/core/TestCase.js');
const manifest=JSON.parse(readFileSync(resolve(root,'results/stress-manifest.json'))),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(const row of manifest.rows.filter(r=>r.config.trial===1&&r.status==='complete')){
 const {net,intention}=stressFixture(row.config),io=publicInterface(net),{goal,protocol}=compileSymbolicIntention(intention);
 const tests=row.tests.map(t=>{const pairs=normalizeTest({...encodeProtocolWitness(protocol,t.witnessArgs,t.witnessResult,io,goal.algebra),id:t.id},io).pairs;assert.equal(hash(pairs),t.pairsHash);return {id:t.id,pairs,witnessArgs:t.witnessArgs,witnessResult:t.witnessResult,entries:t.entries}});
 assert.equal(hash({config:{...row.config,trial:0},net,tests}),row.suiteHash);const data={config:row.config,referenceNet:net,interface:io,intention,tests};writeFileSync(resolve(root,`results/stress-suite-${row.config.id}.json`),JSON.stringify(data));console.log(row.config.id,tests.length,'restored');
}
