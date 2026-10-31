import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';import {createHash} from 'node:crypto';
import {root,editorImport} from './runtime.mjs';import {stressFixture,selectionOptions,derivationOptions,entries} from './stress-fixture.mjs';import {finiteAudit} from './stress-audit.mjs';
const {compileSymbolicIntention,encodeProtocolWitness}=await editorImport('src/satel/core/SymbolicSource.js');const {deriveGenericSubdomains}=await editorImport('src/satel/core/GenericSubuniformity.js');const {selectExecutableRepresentatives}=await editorImport('src/satel/core/ExecutableSequence.js');const {admitIntention}=await editorImport('src/satel/core/Admission.js');const {publicInterface}=await editorImport('src/satel/core/TestCase.js');const {getContext}=await editorImport('src/utils/z3/context.js');
const config=JSON.parse(process.argv[2]),hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),started=performance.now();
const row={config,status:'running',phases:{},rss:{},runtime:{node:process.version,platform:process.platform,arch:process.arch}};const out=resolve(root,`results/stress-${config.id}-trial-${config.trial}.json`);
const save=()=>writeFileSync(out,JSON.stringify(row,null,2));
const phase=async(name,work)=>{const t=performance.now();try{return await work()}finally{row.phases[name]=performance.now()-t;row.rss[name]=process.memoryUsage().rss;save();console.log(JSON.stringify({id:config.id,trial:config.trial,phase:name,ms:row.phases[name]}))}};
try{
 await phase('initialization',()=>getContext());const {net,intention}=stressFixture(config),io=publicInterface(net);const {goal,protocol}=await phase('compilation',()=>compileSymbolicIntention(intention));row.goalHash=hash(goal);row.markingHash=hash(net.places.map(p=>[p.id,p.valueTokens]));row.model={transitions:net.transitions.length,tokens:net.places.reduce((n,p)=>n+p.tokens,0)};
 const d=await phase('derivation',()=>deriveGenericSubdomains(goal,derivationOptions));row.algebra={regions:d.domains.length,unresolved:d.unresolved,overlaps:d.overlaps,coverage:d.coverage,signatureHash:hash(d.domains.map(x=>({patterns:x.patterns,conditions:x.conditions,result:x.resultPattern,variables:x.variables}))),profile:d.unfoldingProfile};
 if(d.unresolved.length||d.overlaps.length){row.status='incomplete-derivation'}else{
  const e=await phase('selection',()=>selectExecutableRepresentatives(goal,protocol,d,net,io,selectionOptions));row.selection={selected:e.selected.length,unresolved:e.unresolved,blocked:e.blocked,visited:e.visited,profile:e.profile};
  if(e.unresolved.length||e.blocked.length){row.status='incomplete-selection'}else{
   const candidates=await phase('encoding',()=>e.selected.map(x=>({...encodeProtocolWitness(protocol,x.witnessArgs,x.witnessResult,io,goal.algebra),id:x.id,symbolicDomain:x})));
   const suite=await phase('admission',()=>admitIntention({symbolicGoal:goal,intention,interface:io,decomposition:d,execution:e,candidates},net,{maxBindings:50000,maxTotalBindings:2000000,maxTimeMs:180000}));
   row.audit=await phase('finiteAudit',()=>finiteAudit(e.selected,config));assert(row.audit.pass,'Independent finite audit failure');
   const tests=suite.selectedTests.map(t=>({id:t.id,pairs:t.pairs,witnessArgs:t.symbolicDomain.witnessArgs,witnessResult:t.symbolicDomain.witnessResult,entries:entries(t.symbolicDomain.witnessArgs[0])}));
   row.tests=tests.map(({pairs,...t})=>({...t,pairs:pairs.length,pairsHash:hash(pairs)}));row.validation=suite.validation;row.suiteHash=hash({config:{...config,trial:0},net,tests});
   writeFileSync(resolve(root,`results/stress-suite-${config.id}-trial-${config.trial}.json`),JSON.stringify({config,referenceNet:net,interface:io,intention,tests}));
   if(config.trial===1&&config.id==='data-2'){const limited=await selectExecutableRepresentatives(goal,protocol,d,net,io,{...selectionOptions,maxSequenceBranches:1});assert.equal(limited.selected.length,0);assert.equal(limited.blocked.length,0);assert.equal(limited.unresolved.length,d.domains.length);row.budgetProbe={selected:0,blocked:0,unresolved:limited.unresolved.length,codes:[...new Set(limited.unresolved.map(x=>x.diagnostic?.code))]}}
   row.status='complete';
  }
 }
}catch(error){row.status='error';row.error={message:error.message,code:error.code,stack:error.stack};console.error(error.stack)}
row.workerMs=performance.now()-started;row.peakRss=process.resourceUsage().maxRSS*1024;save();console.log(JSON.stringify({id:config.id,trial:config.trial,status:row.status,regions:row.algebra?.regions,selected:row.selection?.selected}));process.exit(row.status==='error'?1:0);
