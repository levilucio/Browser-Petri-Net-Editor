import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root,editorImport } from './runtime.mjs';
const {createWarehouseExample}=await editorImport('src/satel/examples/warehouse/editor.js');
const {generateIntention}=await editorImport('src/satel/core/IntentionPipeline.js');
const {publicInterface}=await editorImport('src/satel/core/TestCase.js');
const syntax=await editorImport('src/domain/apn/MethodGateSyntax.js');
const net=createWarehouseExample(), results=[], suites=[];
mkdirSync(resolve(root,'specification'),{recursive:true});
writeFileSync(resolve(root,'specification/warehouse.apn.json'),JSON.stringify(net,null,2));
writeFileSync(resolve(root,'specification/warehouse.copn'),syntax.serializeMethodGateSource(net));
for(const intention of net.testIntentions.filter(i=>!process.env.ONLY||i.id.includes(process.env.ONLY))){
 const start=performance.now();console.log('Generating',intention.name);
 try{
 const {report,suite}=await generateIntention(intention,net,{profileUnfolding:true,maxBranches:2048,maxTimeMs:60000,maxSequenceTimeMs:180000,maxSequencePairs:64,maxBindings:50000,maxTotalBindings:2000000});
 const d=report.decomposition;
 writeFileSync(resolve(root,`results/${intention.id}-domains.json`),JSON.stringify(d,null,2));
 suites.push({id:intention.id,name:intention.name,selectedTests:suite.selectedTests.map(t=>({id:t.id,pairs:t.pairs}))});
 results.push({id:intention.id,name:intention.name,status:'admitted',tests:suite.selectedTests.length,elapsedMs:performance.now()-start,domains:d.domains.length,unresolved:d.unresolved,overlaps:d.overlaps,profile:d.unfoldingProfile,execution:{visited:report.execution.visited,pruned:report.execution.pruned,prefixChecks:report.execution.prefixChecks,selected:report.execution.selected.length,unresolved:report.execution.unresolved,blocked:report.execution.blocked}});
 console.log(JSON.stringify(results.at(-1)));
 }catch(e){results.push({id:intention.id,status:'error',error:e.message,elapsedMs:performance.now()-start});console.error(e.stack);}
 writeFileSync(resolve(root,'results/generation.json'),JSON.stringify(results,null,2));
 writeFileSync(resolve(root,'results/suites.json'),JSON.stringify({interface:publicInterface(net),suites},null,2));
}
process.exit(results.some(r=>r.status==='error')?1:0);
