import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {root} from './runtime.mjs';import {lengths,mutantNames} from './effectiveness-fixture.mjs';
const read=name=>JSON.parse(readFileSync(resolve(root,`results/${name}.json`)));
const manifest=read('effectiveness-manifest'),manifestHash=createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
const backendHash=createHash('sha256').update(readFileSync(resolve(root,'backend/app.py'))).digest('hex');
const matrix=[],contrasts=[],examples=[],transport=[];
for(const mutant of ['none',...mutantNames]){
 const api=read(`effectiveness-${mutant}-api`),ui=read(`effectiveness-${mutant}-ui`);
 for(const r of [api,ui]){
  assert(r.complete);assert.deepEqual(r.databaseIntegrity,[['ok']]);assert.equal(r.manifestSha256,manifestHash);assert.equal(r.backendSha256,backendHash);
  assert.equal(r.runs.length,r.transport==='api'?465:6);
  assert(r.runs.every(x=>['compatible','mismatch'].includes(x.verdict)));
  if(mutant==='none')assert(r.runs.every(x=>x.verdict==='compatible'));
  const expected=manifest.suites.flatMap(s=>s.witnesses.filter(w=>r.transport==='api'||w.browser).map(w=>`${s.length}:${w.id}`));
  assert.deepEqual(r.runs.map(x=>`${x.length}:${x.testId}`).sort(),expected.sort());
 }
 for(const u of ui.runs){const a=api.runs.find(a=>a.length===u.length&&a.testId===u.testId);assert.equal(a.verdict,u.verdict);assert.equal(a.eventSha256,u.eventSha256);}
 transport.push({mutant,compared:ui.runs.length,allEventsAndVerdictsIdentical:true,apiSeconds:api.elapsedMs/1000,uiSeconds:ui.elapsedMs/1000,apiRss:api.rss,uiRss:ui.rss});
 for(const length of lengths)for(const policy of ['selected','interior','upper','union']){
  const runs=api.runs.filter(r=>r.length===length&&(policy==='union'||r.policy===policy));
  matrix.push({mutant,length,policy,tests:runs.length,mismatches:runs.filter(r=>r.verdict==='mismatch').length,executedCalls:runs.reduce((n,r)=>n+r.eventCount,0),runSeconds:runs.reduce((n,r)=>n+r.durationMs/1000,0),status:runs.some(r=>r.verdict==='mismatch')?'detected':'survived'});
 }
 for(const a of api.runs.filter(r=>r.policy==='selected'&&r.verdict==='compatible')){
  for(const b of api.runs.filter(b=>b.length===a.length&&b.region===a.region&&b.policy!=='selected'&&b.verdict==='mismatch')){
   contrasts.push({mutant,length:a.length,region:a.region,selectedTest:a.testId,selectedMinutes:a.minutes,additionalTest:b.testId,additionalPolicy:b.policy,additionalMinutes:b.minutes});
  }
 }
 const first=api.runs.find(r=>r.verdict==='mismatch');if(first)examples.push({mutant,...first});
}
const baseline=read('effectiveness-none-api');
const policyTotals=['selected','interior','upper','union'].map(policy=>({policy,testsPerVariant:matrix.filter(x=>x.mutant==='none'&&x.policy===policy).reduce((n,x)=>n+x.tests,0),detectedMutants:mutantNames.filter(m=>matrix.some(x=>x.mutant===m&&x.policy===policy&&x.status==='detected'))}));
const summary={manifestSha256:manifestHash,baseline:{apiTests:baseline.runs.length,uiTests:6,allCompatible:true},generation:manifest.suites.map(({witnesses,...rest})=>rest),policyTotals,matrix,transport,withinRegionContrasts:contrasts,firstCounterexamples:examples,scope:'Complete finite kind regions at lengths 1–3; three concrete members per region, not all durations. UI is a predeclared six-test subset. Mutation score is descriptive for deliberately seeded faults, not an unbiased estimate of real fault detection. Compatible does not mean correct; survived means no mismatch in these runs.'};
writeFileSync(resolve(root,'results/effectiveness-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({baseline:summary.baseline,policyTotals,contrasts:contrasts.length,matchedTransportRuns:transport.reduce((n,x)=>n+x.compared,0)}));
