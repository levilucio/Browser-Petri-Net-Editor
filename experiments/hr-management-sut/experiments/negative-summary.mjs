import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {root,editorRoot,editorImport} from './runtime.mjs';import {negativeMutants} from './negative-fixture.mjs';
const {experimentsForTest}=await editorImport('src/satel/blackbox/Experiments.js');
const read=n=>JSON.parse(readFileSync(resolve(root,`results/${n}.json`))),hash=x=>createHash('sha256').update(x).digest('hex');
const m=read('negative-manifest'),suite=read('negative-suite');assert.equal(hash(readFileSync(resolve(root,'results/negative-suite.json'))),m.suiteSha256);
assert.equal(hash(readFileSync(resolve(editorRoot,'src/satel/core/NegativeSelection.js'))),m.engineSha256);
const summary={manifestSha256:hash(JSON.stringify(m)),targets:m.targets.length,generationMs:m.generationMs,negativeTests:m.tests.filter(t=>t.kind==='negative').length,positiveControls:m.tests.filter(t=>t.kind==='positive-control').length,noRefusal:m.report.attempts.filter(t=>t.status==='no-refusal').length,unresolved:m.report.unresolved.length,unvisited:m.report.unvisitedTargets,duplicates:m.report.skippedDuplicates+m.report.skippedCandidateDuplicates,concreteValuations:m.finiteConcreteAudit.reduce((n,x)=>n+x.valuations,0),boundedProbe:m.boundedProbe,variants:[],counterexamples:[]};
assert(!summary.unresolved&&!summary.unvisited&&!m.report.truncated);assert.equal(summary.negativeTests+summary.noRefusal,summary.targets);
for(const mutant of ['none',...negativeMutants]){
 const api=read(`negative-${mutant}-api`),ui=read(`negative-${mutant}-ui`);
 for(const r of [api,ui]){
  assert(r.complete);assert.equal(r.manifestSha256,summary.manifestSha256);assert.equal(r.backendSha256,hash(readFileSync(resolve(root,'backend/app.py'))));assert.deepEqual(r.databaseIntegrity,[['ok']]);
  const expected=suite.tests.filter(t=>r.transport==='api'||t.browser).flatMap(t=>experimentsForTest(t,suite.interface).paths.map((_,i)=>`${t.id}:${i}`)).sort();
  assert.deepEqual(r.runs.map(x=>`${x.testId}:${x.pathIndex}`).sort(),expected);
  assert(r.runs.every(x=>['compatible','mismatch'].includes(x.verdict)));if(mutant==='none')assert(r.runs.every(x=>x.verdict==='compatible'));
  assert(r.runs.filter(x=>x.phase!=='refusal').every(x=>x.verdict==='compatible'),'Positive controls/prefixes must remain compatible');
  for(const x of r.runs.filter(x=>x.verdict==='mismatch')){assert.equal(x.phase,'refusal');assert.equal(x.reasonCode,'unexpected-acceptance');assert.equal(x.step,suite.tests.find(t=>t.id===x.testId).pairs.length);assert.equal(x.propertyEvidence.verdict,'inconclusive');}
 }
 for(const u of ui.runs){const a=api.runs.find(a=>a.testId===u.testId&&a.pathIndex===u.pathIndex);assert.equal(a.verdict,u.verdict);assert.equal(a.eventSha256,u.eventSha256);assert.deepEqual(a.propertyEvidence,u.propertyEvidence);}
 const counts=r=>Object.fromEntries(['positive-control','positive-prefix','refusal'].map(phase=>{const rows=r.runs.filter(x=>x.phase===phase);return [phase,{runs:rows.length,compatible:rows.filter(x=>x.verdict==='compatible').length,mismatch:rows.filter(x=>x.verdict==='mismatch').length}]}));
 summary.variants.push({mutant,api:counts(api),ui:counts(ui),matchedTransportRuns:ui.runs.length,identicalEventsAndVerdicts:true,apiMs:api.elapsedMs,uiMs:ui.elapsedMs,apiRss:api.rss,uiRss:ui.rss,propertyEvidence:api.runs.reduce((a,x)=>(a[x.propertyEvidence.verdict]=(a[x.propertyEvidence.verdict]||0)+1,a),{})});
 const example=api.runs.find(r=>r.verdict==='mismatch');if(example){assert.equal(example.reasonCode,'unexpected-acceptance');summary.counterexamples.push({mutant,counterexampleKind:'trace-conformance',...example});}
}
summary.scope='One refusal per scoped target, not negative subuniformity classes. Completed no-refusal answers apply only within the declared finite domains. Compatible refusal traces do not prove universal black-box disabledness. UI is a fixed subset.';
writeFileSync(resolve(root,'results/negative-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({targets:summary.targets,negative:summary.negativeTests,variants:summary.variants.map(v=>({mutant:v.mutant,api:v.api,ui:v.ui}))}));
