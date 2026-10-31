import assert from 'node:assert/strict';import {writeFileSync,readFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {root,editorImport,editorRoot} from './runtime.mjs';import {negativeFixture,negativeMutants,browserTargets} from './negative-fixture.mjs';
const {generateIntention}=await editorImport('src/satel/core/IntentionPipeline.js');
const {selectNegativeCompanions}=await editorImport('src/satel/core/NegativeSelection.js');
const {validateOracleCandidates}=await editorImport('src/satel/core/ValidatedSubuniformity.js');
const {enumerateMethodSuccessors}=await editorImport('src/domain/apn/PublicMethods.js');
const {publicInterface}=await editorImport('src/satel/core/TestCase.js');
const {net,seeds,targets}=negativeFixture(),io=publicInterface(net),positive=[];
for(const seed of seeds){const {suite}=await generateIntention(seed,net);positive.push({...suite.selectedTests[0],id:seed.id});}
const suite={referenceNet:net,interface:io,selectedTests:positive};
const start=performance.now();
const report=await selectNegativeCompanions(suite,{negativeTargets:targets,negativeLimits:{maxTests:200,maxAttempts:200,maxTimeMs:120000,maxBindings:1000000}});
const generationMs=performance.now()-start;
assert.equal(report.unresolved.length,0);assert.equal(report.unvisitedTargets,0);assert(!report.truncated);
const audit=[];
for(const [i,target] of targets.entries()){
 const seed=positive.find(p=>p.id===target.seedId),marking=seed.referenceMarkings[target.prefixLength];
 const state={...net,places:net.places.map(p=>({...p,valueTokens:marking[p.id],tokens:marking[p.id].length}))};
 let valuations=0,refused=0;const entries=Object.entries(target.parameterDomains);
 function visit(index,args={}){if(index<entries.length){const [name,values]=entries[index];for(const value of values)visit(index+1,{...args,[name]:value});return;}
  const result=enumerateMethodSuccessors(state,target.method,args,{maxBindings:10000});assert(result.complete);valuations++;if(!result.successors.length)refused++;
 }
 visit(0);const attempt=report.attempts[i];assert.equal(attempt.status,refused?'selected':'no-refusal');
 audit.push({label:target.label,valuations,refused,status:attempt.status});
}
const validated=await validateOracleCandidates({referenceNet:net,io,candidates:report.candidates});
for(const t of validated)assert.deepEqual(t.referenceMarkings.at(-1),t.referenceMarkings.at(-2));
const compact=t=>({id:t.id,pairs:t.pairs,browser:!t.negativeSelection||browserTargets.includes(t.negativeSelection.label),...(t.negativeSelection?{target:t.negativeSelection.label,kind:'negative'}:{kind:'positive-control'})});
const frozen={referenceNet:net,interface:io,tests:[...positive,...validated].map(compact)};
const raw=JSON.stringify(frozen);writeFileSync(resolve(root,'results/negative-suite.json'),raw);
const bounds=await selectNegativeCompanions(suite,{negativeTargets:targets,negativeLimits:{maxAttempts:1,maxTests:200,maxTimeMs:10000,maxBindings:100000}});
assert(bounds.truncated&&bounds.unvisitedTargets===targets.length-1);
const manifest={schemaVersion:1,frozenAt:new Date().toISOString(),mutants:negativeMutants,browserTargets,fixtureSha256:createHash('sha256').update(readFileSync(resolve(root,'experiments/negative-fixture.mjs'))).digest('hex'),engineSha256:createHash('sha256').update(readFileSync(resolve(editorRoot,'src/satel/core/NegativeSelection.js'))).digest('hex'),suiteSha256:createHash('sha256').update(raw).digest('hex'),generationMs,totalMs:performance.now()-start,rss:process.memoryUsage().rss,targets,tests:frozen.tests,report:{...report,candidates:undefined},finiteConcreteAudit:audit,boundedProbe:{attempts:bounds.attempts.length,unvisited:bounds.unvisitedTargets,truncated:bounds.truncated}};
writeFileSync(resolve(root,'results/negative-manifest.json'),JSON.stringify(manifest));
console.log(JSON.stringify({targets:targets.length,positive:positive.length,negative:validated.length,statuses:report.attempts.reduce((a,x)=>(a[x.status]=(a[x.status]||0)+1,a),{}),auditedValuations:audit.reduce((n,x)=>n+x.valuations,0),generationMs}));process.exit();
