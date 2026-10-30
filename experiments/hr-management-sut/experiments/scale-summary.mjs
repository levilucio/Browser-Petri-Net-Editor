import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {root,editorRoot} from './runtime.mjs';

const read=name=>JSON.parse(readFileSync(resolve(root,'results',name+'.json')));
const run=read('scale-benchmark'),audit=read('scale-audit'),verification=read('scale-verification');
for(const [path,hash] of Object.entries(run.sourceSha256))
 assert.equal(createHash('sha256').update(readFileSync(resolve(editorRoot,path))).digest('hex'),hash,path);
assert.equal(run.results.length,6);
assert.equal(new Set(run.results.map(x=>x.config.label)).size,6);
assert(run.results.every(x=>x.exitCode===0&&!x.hardTimeout));
assert.equal(new Set(run.results.map(x=>x.markingSha256)).size,1);
assert(run.results.every(x=>x.tokens===159&&x.places===4&&x.transitions===21));
const logical=ds=>ds.map(d=>Object.fromEntries(['id','rules','patterns','conditions','resultPattern','goalBindings'].map(k=>[k,d[k]])));
const comparisons=[];
for(const [left,right] of [['scale-full-3','scale-compact-3'],['scale-compact-3','scale-fast-3'],['scale-control-4','scale-fast-4']]){
 const a=read('depth-domains-'+left).decomposition.domains,b=read('depth-domains-'+right).decomposition.domains;
 assert.deepEqual(logical(a),logical(b));
 comparisons.push({left,right,logicalRegionsIdentical:true,witnessesIdentical:JSON.stringify(a.map(d=>d.witnessArgs))===JSON.stringify(b.map(d=>d.witnessArgs))});
}
assert(audit.allPartitionAndWitnessChecksPass);
assert.equal(audit.results.length,run.results.length);
for(const x of run.results){
 const a=audit.results.find(a=>a.label===x.config.label);assert(a);
 assert.equal(a.domainFileSha256,createHash('sha256').update(readFileSync(resolve(root,`results/depth-domains-${x.config.label}.json`))).digest('hex'));
 assert.equal(a.classes,x.classes);assert.equal(a.frontierUnresolved,x.unresolved);
 if(!x.unresolved){assert.equal(x.classes,5**x.config.length);assert(a.audit.finiteCoverageComplete);}
 if(x.config.execute){
  assert.equal(x.stage,'replay-complete');
  assert.equal(x.execution.selected,x.classes);assert.equal(x.execution.unresolved,0);assert.equal(x.execution.blocked,0);
  assert.equal(x.replay.passed,x.classes);assert(!x.replay.error);
  assert.equal(x.suiteAdmissible,!x.unresolved&&!x.overlaps);
  assert.equal(x.admission.status,x.suiteAdmissible?'admitted':'rejected');
 }
}
assert.equal(verification.results.length,9);assert(verification.results.every(x=>x.sameFrozenPairs));
const summary={fixedMarkingAcrossConfigurations:true,markingSha256:run.results[0].markingSha256,comparisons,
 allFinitePartitionAndWitnessChecksPass:true,unchangedFrozenTests:verification.results.reduce((n,x)=>n+x.tests,0),
 execution:run.results.filter(x=>x.config.execute).map(x=>({label:x.config.label,classes:x.classes,selected:x.execution.selected,replayed:x.replay.passed,admission:x.admission.status})),
 finiteCoverage:audit.results.map(x=>({label:x.label,classes:x.classes,...Object.fromEntries(['inputs','definedInputs','missingInputs','multiplyCoveredInputs','undefinedCoveredInputs','witnessFailures','finiteCoverageComplete'].map(k=>[k,x.audit[k]]))})),
 scope:'Finite enumerated inputs only; engine coverage remains not-proved. APN admission does not establish conformance of the external HR SUT for these new sequences.'};
writeFileSync(resolve(root,'results/scale-summary.json'),JSON.stringify(summary,null,2));
console.log('Scale summary: all assertions passed.');
