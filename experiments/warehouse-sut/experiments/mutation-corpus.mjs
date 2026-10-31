import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';import {root} from './runtime.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),read=p=>JSON.parse(readFileSync(resolve(root,p)));
const net=read('specification/warehouse.apn.json'),original=read('results/suites.json'),models={baseline:net},tests=[];
const baselineBrowser=(id,test)=>id==='exercise-warehouse-basket'||id==='exercise-warehouse-lifecycle'&&['s1','s3','s6'].includes(test.id)||id==='exercise-warehouse-role-readOrder'&&test.id==='a11'||id==='exercise-warehouse-negative'&&['n5','n8'].includes(test.id);
for(const entry of original.suites)for(const test of entry.selectedTests)tests.push({key:entry.id+'/'+test.id,model:'baseline',kind:'baseline',browser:baselineBrowser(entry.id,test),...test});
const manifest=read('results/stress-manifest.json');
for(const id of ['history-25','history-50','history-100']){
 const row=manifest.rows.find(r=>r.config.id===id&&r.config.trial===1);assert.equal(row?.status,'complete','No admitted suite for '+id);
 const suite=read(`results/stress-suite-${id}.json`);models[id]=suite.referenceNet;
 for(const test of suite.tests){const kinds=test.entries.map(e=>e[0]);tests.push({key:id+'/'+test.id,model:id,kind:'history',length:test.pairs.length,browser:JSON.stringify(kinds)==='[101,101]'||JSON.stringify(kinds)==='[101,102]',id:test.id,pairs:test.pairs,entries:test.entries})}
}
assert.equal(tests.length,74);assert.equal(tests.filter(t=>t.browser).length,24);
const sourceFiles=['results/suites.json','specification/warehouse.apn.json','results/stress-manifest.json','experiments/mutation-corpus.mjs'];const result={schemaVersion:1,interface:original.interface,models,tests,sourceHashes:Object.fromEntries(sourceFiles.map(p=>[p,hash(readFileSync(resolve(root,p)))])),selection:'REST: all 62 frozen baseline tests plus all 12 admitted history witnesses. Browser: predeclared 18 baseline tests plus six history witnesses. No target outcome used to select the subset.'};
writeFileSync(resolve(root,'results/mutation-corpus.json'),JSON.stringify(result));console.log(JSON.stringify({tests:tests.length,browser:tests.filter(t=>t.browser).length,sha256:hash(JSON.stringify(result))}));
