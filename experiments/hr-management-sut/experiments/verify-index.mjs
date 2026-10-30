import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {root,editorImport} from './runtime.mjs';
const {createHrExample}=await editorImport('src/satel/examples/hr/editor.js');
const {generateIntention}=await editorImport('src/satel/core/IntentionPipeline.js');
const bytes=readFileSync(resolve(root,'results/suites.json'));
const saved=JSON.parse(bytes),net=createHrExample(),results=[];
for(const intention of net.testIntentions){
 const start=performance.now();
 const {report,suite}=await generateIntention(intention,net,{profileSelection:true,maxBranches:2048,maxTimeMs:60000,maxSequenceTimeMs:120000});
 const previous=saved.suites.find(s=>s.id===intention.id);
 const sameFrozenPairs=JSON.stringify(suite.selectedTests.map(t=>t.pairs))===JSON.stringify(previous.selectedTests.map(t=>t.pairs));
 results.push({id:intention.id,tests:suite.selectedTests.length,sameFrozenPairs,elapsedMs:performance.now()-start,validation:suite.validation,algebraUnresolved:report.decomposition.unresolved,overlaps:report.decomposition.overlaps,executionUnresolved:report.execution.unresolved,blocked:report.execution.blocked,profile:report.execution.profile});
 console.log(JSON.stringify({id:intention.id,tests:suite.selectedTests.length,sameFrozenPairs}));
}
writeFileSync(resolve(root,'results/index-verification.json'),JSON.stringify({frozenSuiteSha256:createHash('sha256').update(bytes).digest('hex'),results},null,2));
process.exit(results.some(r=>!r.sameFrozenPairs||r.algebraUnresolved.length||r.overlaps.length||r.executionUnresolved.length||r.blocked.length)?1:0);
