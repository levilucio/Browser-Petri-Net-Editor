import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { root,editorImport } from './runtime.mjs';
const {createHrExample}=await editorImport('src/satel/examples/hr/editor.js');
const {generateIntention}=await editorImport('src/satel/core/IntentionPipeline.js');
const {publicInterface}=await editorImport('src/satel/core/TestCase.js');
const syntax=await editorImport('src/domain/apn/MethodGateSyntax.js');
const net=createHrExample(), results=[], suites=[];
mkdirSync(resolve(root,'specification'),{recursive:true});
writeFileSync(resolve(root,'specification/hr.apn.json'),JSON.stringify(net,null,2));
writeFileSync(resolve(root,'specification/hr.copn'),syntax.serializeMethodGateSource(net));
for(const intention of net.testIntentions){
 const start=performance.now();console.log('Generating',intention.name);
 try{
 const {report,suite}=await generateIntention(intention,net,{profileUnfolding:true,maxBranches:2048,maxTimeMs:60000,maxSequenceTimeMs:120000});
 const d=report.decomposition;
 suites.push({id:intention.id,name:intention.name,selectedTests:suite.selectedTests});
 results.push({id:intention.id,name:intention.name,status:'admitted',tests:suite.selectedTests.length,elapsedMs:performance.now()-start,domains:d.domains.length,unresolved:d.unresolved,overlaps:d.overlaps,profile:d.unfoldingProfile,execution:{visited:report.execution.visited,pruned:report.execution.pruned,prefixChecks:report.execution.prefixChecks,selected:report.execution.selected.length,unresolved:report.execution.unresolved,blocked:report.execution.blocked}});
 console.log(JSON.stringify(results.at(-1)));
 }catch(e){results.push({id:intention.id,status:'error',error:e.message,elapsedMs:performance.now()-start});console.error(e.stack);}
 writeFileSync(resolve(root,'results/generation.json'),JSON.stringify(results,null,2));
 writeFileSync(resolve(root,'results/suites.json'),JSON.stringify({interface:publicInterface(net),suites},null,2));
}
process.exit(results.some(r=>r.status==='error')?1:0);
