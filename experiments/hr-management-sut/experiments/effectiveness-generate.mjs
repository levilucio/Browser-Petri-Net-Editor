import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {root,editorImport} from './runtime.mjs';
import {effectivenessFixture,entries,workLog,browserKinds} from './effectiveness-fixture.mjs';
import {auditDomains} from './depth-audit.mjs';
const {generateIntention}=await editorImport('src/satel/core/IntentionPipeline.js');
const {compileSymbolicIntention,encodeProtocolWitness}=await editorImport('src/satel/core/SymbolicSource.js');
const {validateOracleCandidates}=await editorImport('src/satel/core/ValidatedSubuniformity.js');
const length=Number(process.argv[2]),{net,intention}=effectivenessFixture(length),start=performance.now();
const {report,suite}=await generateIntention(intention,net,{maxBranches:8192,maxTimeMs:60000,maxSequenceTimeMs:180000,maxSequenceBranches:200000,profileUnfolding:true,profileSelection:true});
assert.equal(suite.selectedTests.length,5**length);
const {goal,protocol}=compileSymbolicIntention(intention),tests=[],domains=report.decomposition.domains;
const compact=t=>({id:t.id,pairs:t.pairs,...(t.formula?{formula:t.formula}:{})});
for(const test of suite.selectedTests){
 const domain=test.symbolicDomain,es=entries(domain.witnessArgs[0]),kinds=es.map(e=>e[0]);
 tests.push({...compact(test),region:domain.id,policy:'selected',kinds,browser:kinds.join()===browserKinds[length].join(),minutes:es.map(e=>e[1])});
}
const selectedMs=performance.now()-start;
for(const [policy,minutes] of [['interior',60],['upper',720]]){
 const candidates=domains.map(d=>{const es=entries(d.witnessArgs[0]),args=[workLog(es.map(e=>e[0]),es.map(()=>minutes))];
  const audit=auditDomains([{...d,witnessArgs:args}],length,{boundary:false});assert.equal(audit.witnessFailures,0);assert.equal(audit.unsupported,0);
  return {...encodeProtocolWitness(protocol,args,d.witnessResult,suite.interface,goal.algebra),id:`${d.id}-${policy}`,region:d.id,kinds:es.map(e=>e[0]),minutes:es.map(()=>minutes)};
 });
 // Additional representatives belong to existing regions; replay validates each
 // explicit candidate. This does not claim a new decomposition or new admission.
 for(const candidate of candidates){const [valid]=await validateOracleCandidates({referenceNet:net,io:suite.interface,candidates:[candidate]});tests.push({...compact(valid),region:candidate.region,policy,kinds:candidate.kinds,minutes:candidate.minutes,browser:policy==='upper'&&candidate.kinds.join()===browserKinds[length].join()});}
}
const finiteAudit=auditDomains(domains,length);assert(finiteAudit.partitionAndWitnessChecksPass&&finiteAudit.finiteCoverageComplete);
const frozen={length,referenceNet:net,interface:suite.interface,intention,tests};
const raw=JSON.stringify(frozen);writeFileSync(resolve(root,`results/effectiveness-suite-${length}.json`),raw);
const evidence={length,regions:domains.length,tests:tests.length,browserTests:tests.filter(t=>t.browser).length,selectedMs,totalMs:performance.now()-start,rss:process.memoryUsage().rss,sha256:createHash('sha256').update(raw).digest('hex'),finiteAudit,selectedMinutes:[...new Set(tests.filter(t=>t.policy==='selected').flatMap(t=>t.minutes))],decomposition:{unresolved:report.decomposition.unresolved.length,overlaps:report.decomposition.overlaps.length},execution:{selected:report.execution.selected.length,unresolved:report.execution.unresolved.length,blocked:report.execution.blocked.length},validation:suite.validation};
writeFileSync(resolve(root,`results/effectiveness-generation-${length}.json`),JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));process.exit();
