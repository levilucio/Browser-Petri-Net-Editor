// Re-derive without replacing the frozen evidence used by the campaigns.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,editorImport} from './runtime.mjs';
const {createHrExample}=await editorImport('src/satel/examples/hr/editor.js');
const {generateIntention}=await editorImport('src/satel/core/IntentionPipeline.js');
const {getContext}=await editorImport('src/utils/z3/context.js');
const frozen=JSON.parse(readFileSync(resolve(root,'results/suites.json')));
const net=createHrExample(),rows=[];
await getContext();
for(const intention of net.testIntentions){
 const start=performance.now();
 const {report,suite}=await generateIntention(intention,net,{profileUnfolding:true,maxBranches:2048,maxTimeMs:60000,maxSequenceTimeMs:120000});
 const previous=frozen.suites.find(s=>s.id===intention.id);
 const samePairs=JSON.stringify(suite.selectedTests.map(t=>t.pairs))===JSON.stringify(previous.selectedTests.map(t=>t.pairs));
 const d=report.decomposition,e=report.execution;
 const row={id:intention.id,tests:suite.selectedTests.length,samePairs,elapsedMs:performance.now()-start,domains:d.domains.length,unresolved:d.unresolved.length,overlaps:d.overlaps.length,profile:d.unfoldingProfile,execution:{visited:e.visited,pruned:e.pruned,prefixChecks:e.prefixChecks,selected:e.selected.length,unresolved:e.unresolved.length,blocked:e.blocked.length}};
 rows.push(row);console.log(JSON.stringify({id:row.id,tests:row.tests,samePairs,execution:row.execution}));
 writeFileSync(resolve(root,'results/generation-verification.json'),JSON.stringify(rows,null,2));
}
process.exit(rows.some(r=>!r.samePairs||r.unresolved||r.overlaps||r.execution.unresolved)?1:0);
