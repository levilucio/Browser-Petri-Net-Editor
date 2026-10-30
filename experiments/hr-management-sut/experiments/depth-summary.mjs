import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {root,editorRoot} from './runtime.mjs';
const read=name=>JSON.parse(readFileSync(resolve(root,'results',name+'.json')));
const run=read('depth-final'),audit=read('depth-audit'),verification=read('depth-verification');
for(const [path,hash] of Object.entries(run.sourceSha256))assert.equal(createHash('sha256').update(readFileSync(resolve(editorRoot,path))).digest('hex'),hash,path);
assert.equal(run.results.length,9);assert.equal(new Set(run.results.map(x=>x.config.label)).size,9);
assert(run.results.every(x=>x.exitCode===0&&!x.hardTimeout));
assert.equal(new Set(run.results.map(x=>x.markingSha256)).size,1);
for(const x of run.results.filter(x=>x.config.execute)){
 assert.equal(x.execution.selected,x.classes);assert.equal(x.execution.unresolved,0);assert.equal(x.execution.blocked,0);assert.equal(x.replay.passed,x.classes);assert(!x.replay.error);
 assert.equal(x.suiteAdmissible,!x.unresolved&&!x.overlaps);assert.equal(x.admission.status,x.suiteAdmissible?'admitted':'rejected');
}
const a=read('depth-domains-control-3').decomposition.domains,b=read('depth-domains-repeat-3').decomposition.domains;
const logical=ds=>ds.map(d=>Object.fromEntries(['id','rules','patterns','conditions','resultPattern'].map(k=>[k,d[k]])));
assert.deepEqual(logical(a),logical(b));assert(audit.allPartitionAndWitnessChecksPass);
assert.equal(verification.results.length,9);assert(verification.results.every(x=>x.sameFrozenPairs));
const summary={fixedMarkingAcrossLengths:true,markingSha256:run.results[0].markingSha256,lengthThreeControlVsOptimizedRegionsIdentical:true,lengthThreeControlVsOptimizedWitnessesIdentical:JSON.stringify(a.map(d=>d.witnessArgs))===JSON.stringify(b.map(d=>d.witnessArgs)),allReturnedCandidatesSelectedAndReplayed:true,incompleteSuitesRejected:true,allFinitePartitionAndWitnessChecksPass:true,unchangedFrozenTests:verification.results.reduce((n,x)=>n+x.tests,0),finiteCoverage:audit.results.map(x=>({label:x.label,classes:x.classes,...Object.fromEntries(['inputs','definedInputs','missingInputs','multiplyCoveredInputs','undefinedCoveredInputs','witnessFailures','finiteCoverageComplete'].map(k=>[k,x.audit[k]]))})),scope:'Finite enumerated inputs only; engine coverage remains not-proved. Fixed-length five-type combination count is not independently a theorem about thesis subuniformity classes.'};
writeFileSync(resolve(root,'results/depth-summary.json'),JSON.stringify(summary,null,2));console.log('Depth summary: all assertions passed.');
