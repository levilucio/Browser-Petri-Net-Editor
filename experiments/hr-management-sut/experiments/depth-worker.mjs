import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';import {resolve} from 'node:path';
import {root,editorImport} from './runtime.mjs';import {depthFixture} from './depth-fixture.mjs';
const config=JSON.parse(process.argv[2]);
const {compileSymbolicIntention,encodeProtocolWitness}=await editorImport('src/satel/core/SymbolicSource.js');
const {deriveGenericSubdomains}=await editorImport('src/satel/core/GenericSubuniformity.js');
const {selectExecutableRepresentatives}=await editorImport('src/satel/core/ExecutableSequence.js');
const {publicInterface}=await editorImport('src/satel/core/TestCase.js');
const {admitIntention}=await editorImport('src/satel/core/Admission.js');
const {validateOracleCandidates}=await editorImport('src/satel/core/ValidatedSubuniformity.js');
const {getContext}=await editorImport('src/utils/z3/context.js');
const startInit=performance.now();await getContext();const initMs=performance.now()-startInit;
const {net,intention}=depthFixture(config.length),compileStart=performance.now();
const {goal,protocol}=compileSymbolicIntention(intention),compileMs=performance.now()-compileStart;
const start=performance.now();
const d=await deriveGenericSubdomains(goal,{profileUnfolding:true,maxBranches:config.branchBudget??2048,simpleScalarChecks:config.scalarChecks??true,compactDomainVariables:config.compactVariables??true,maxTimeMs:config.timeMs??10000,literalDisjointness:config.optimized??false,deferExpiredOverlapQueries:config.optimized??false});
const row={config,stage:'derivation-complete',initMs,compileMs,markingSha256:createHash('sha256').update(JSON.stringify(net.places.map(p=>[p.id,p.valueTokens]))).digest('hex'),places:net.places.length,transitions:net.transitions.length,tokens:net.places.reduce((n,p)=>n+p.tokens,0),derivationMs:performance.now()-start,classes:d.domains.length,expectedKindCombinations:5**config.length,unresolved:d.unresolved.length,unresolvedReasons:d.unresolved.reduce((r,x)=>(r[x.reason]=(r[x.reason]||0)+1,r),{}),overlaps:d.overlaps.length,unknownOverlaps:d.overlaps.filter(x=>x.status==='unknown').length,profile:d.unfoldingProfile,rss:process.memoryUsage().rss};
writeFileSync(resolve(root,`results/depth-domains-${config.label}.json`),JSON.stringify({goal,decomposition:d}));
console.log('DEPTH_STAGE '+JSON.stringify(row));
if(config.execute){
 const io=publicInterface(net),t=performance.now();const e=await selectExecutableRepresentatives(goal,protocol,d,net,io,{profileSelection:true,maxSequenceTimeMs:config.selectionTimeMs??30000,maxSequenceBranches:config.sequenceBranches??10000});
 row.selectionMs=performance.now()-t;row.execution={selected:e.selected.length,blocked:e.blocked.length,unresolved:e.unresolved.length,reasons:e.unresolved.reduce((r,x)=>(r[x.reason]=(r[x.reason]||0)+1,r),{}),visited:e.visited,profile:e.profile};
 row.stage='selection-complete';console.log('DEPTH_STAGE '+JSON.stringify(row));
 // Candidate replay remains useful on a partial decomposition, but is explicitly
 // not suite admission or a claim that the omitted obligations are discharged.
 const candidates=e.selected.map(x=>({...encodeProtocolWitness(protocol,x.witnessArgs,x.witnessResult,io,goal.algebra),id:x.id,symbolicDomain:x}));
 const a=performance.now();
 try{const suite=await admitIntention({symbolicGoal:goal,intention,interface:io,decomposition:d,execution:e,candidates},net);row.admission={status:'admitted',tests:suite.selectedTests.length,ms:performance.now()-a};row.replay={passed:suite.selectedTests.length,ms:row.admission.ms};}
 catch(error){row.admission={status:'rejected',reason:error.message,ms:performance.now()-a};const t=performance.now();try{const accepted=await validateOracleCandidates({referenceNet:net,io,candidates});row.replay={passed:accepted.length,ms:performance.now()-t,scope:'partial candidates only; no suite admitted'};}catch(error){row.replay={error:error.message,ms:performance.now()-t};}}
 row.finalRss=process.memoryUsage().rss;row.stage='replay-complete';
 row.suiteAdmissible=row.admission.status==='admitted';
}
console.log('DEPTH_RESULT '+JSON.stringify(row));process.exit();
