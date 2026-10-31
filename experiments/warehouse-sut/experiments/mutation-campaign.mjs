import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdtempSync,renameSync,existsSync} from 'node:fs';import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawn,spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {root,editorImport,playwright} from './runtime.mjs';import {apiAdapter,browserAdapter} from './adapters.mjs';
const {runBlackBoxExperiment}=await editorImport('src/satel/blackbox/Campaign.js');
const {experimentsForTest,traceEvidence}=await editorImport('src/satel/blackbox/Experiments.js');
const args=process.argv.slice(2),opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;const variants=opt('--variants','none').split(','),transports=opt('--transport','api,ui').split(',');
const hash=x=>createHash('sha256').update(x).digest('hex'),corpus=JSON.parse(readFileSync(resolve(root,'results/mutation-corpus.json'))),corpusHash=hash(readFileSync(resolve(root,'results/mutation-corpus.json')));
const sources=['backend/app.py','backend/mutations.py','backend/mutation_server.py','frontend/index.html','frontend/app.js','frontend/style.css','experiments/adapters.mjs','experiments/mutation-campaign.mjs','experiments/mutation-corpus.mjs'];const sourceHashes=Object.fromEntries(sources.map(p=>[p,hash(readFileSync(resolve(root,p)))]));
const baselineReady=()=>{for(const t of ['api','ui']){const p=resolve(root,`results/mutation-none-${t}.json`);assert(existsSync(p),'Run both baselines before mutation variants');const d=JSON.parse(readFileSync(p));assert(d.complete&&d.corpusHash===corpusHash);assert.deepEqual(d.sourceHashes,sourceHashes);assert(d.runs.every(r=>r.verdict==='compatible'&&r.integrity.integrity==='ok'&&!r.integrity.foreign_keys.length&&!r.integrity.stock_failures.length))}};
for(const variant of variants){if(variant!=='none')baselineReady();for(const transport of transports){
 const reportPath=resolve(root,`results/mutation-${variant}-${transport}.json`);if(args.includes('--resume')&&existsSync(reportPath)){const old=JSON.parse(readFileSync(reportPath));if(old.complete&&old.corpusHash===corpusHash&&JSON.stringify(old.sourceHashes)===JSON.stringify(sourceHashes)){console.log('Already complete',variant,transport);continue}}
 const dir=mkdtempSync(resolve(tmpdir(),'warehouse-mutation-')),db=resolve(dir,'sut.sqlite3'),port=Number(opt('--port','8884')),base=`http://127.0.0.1:${port}`;
 const report={variant,transport,complete:false,corpusHash,sourceHashes,runtime:{node:process.version,platform:process.platform,arch:process.arch},runs:[]};
 const save=()=>{writeFileSync(reportPath+'.tmp',JSON.stringify(report));renameSync(reportPath+'.tmp',reportPath)};
 const server=spawn(process.env.PYTHON||'python',[resolve(root,'backend/mutation_server.py'),'--port',String(port),'--db',db,'--test-mode','--mutant',variant],{stdio:['ignore','pipe','pipe']});let ready=false,stderr='';server.stdout.on('data',d=>{if(d.toString().includes('Warehouse mutation '))ready=true});server.stderr.on('data',d=>stderr+=d);
 let browser=null;
 const integrity=()=>{const r=spawnSync(process.env.PYTHON||'python',['-c',`import importlib.util,json; s=importlib.util.spec_from_file_location('sut',${JSON.stringify(resolve(root,'backend/app.py'))}); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); c=m.connect(${JSON.stringify(db)}); print(json.dumps(m.invariant_report(c))); c.close()`],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return JSON.parse(r.stdout)};
 const record=(run,key,kind)=>{const check=integrity();report.runs.push({...run,key,kind,integrity:check});save();if(variant==='none'&&(run.verdict!=='compatible'||check.integrity!=='ok'||check.foreign_keys.length||check.stock_failures.length))throw Error('Unseeded baseline discrepancy; preserve source, corpus and report before repair: '+reportPath)};
 try{
  for(let i=0;!ready&&i<100;i++)await new Promise(r=>setTimeout(r,100));if(!ready)throw Error('Server did not start '+stderr);const health=await(await fetch(base+'/api/health')).json();assert.equal(health.mutant,variant);
  if(transport==='ui'){const pw=await playwright();browser=await pw.chromium.launch({headless:true,...process.env.SATEL_CHROMIUM?{executablePath:process.env.SATEL_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage']});report.runtime.browser=browser.version()}
  const page=browser?await browser.newPage({viewport:{width:1500,height:1050}}):null;const createSut=()=>transport==='api'?apiAdapter(base):browserAdapter(base,page);const options={callTimeoutMs:15000,maxTimeMs:180000,maxBindings:50000,maxTotalBindings:2000000};
  for(const test of corpus.tests.filter(t=>transport==='api'||t.browser)){
   const net=corpus.models[test.model];const plan=experimentsForTest({id:test.key,pairs:test.pairs},corpus.interface),r={counts:{compatible:0,mismatch:0,inconclusive:0,error:0}};
   for(const [pathIndex,calls]of plan.paths.entries()){
    const run=await runBlackBoxExperiment({referenceNet:net,io:corpus.interface,calls,createSut,seed:1},options);const propertyEvidence=traceEvidence(plan.formula,run.events,corpus.interface,plan.test.expectedTruth??true);
    if(run.verdict==='error')Object.assign(propertyEvidence,{value:null,verdict:'inconclusive',reason:'Adapter/reference error; no property verdict is available.'});
    r.counts[run.verdict]++;record({...run,calls,testId:test.key,pathIndex,propertyEvidence},test.key+'/path-'+pathIndex,test.kind);
   }
   if(test.pairs.at(-1).assertion==='blocked'){
    const calls=[...test.pairs.map(p=>p.stimulation),{method:'readOrder',arguments:{actor:4,order:1001}},{method:'auditCount',arguments:{actor:4,order:1001}},{method:'readStock',arguments:{actor:4,product:101,warehouse:11}}];
    const run=await runBlackBoxExperiment({referenceNet:net,io:corpus.interface,calls,createSut,seed:1},options);record({...run,calls},test.key+'/post-refusal','post-refusal');
   }
   console.log(JSON.stringify({variant,transport,test:test.key,counts:r.counts,finishedRuns:report.runs.length}));
  }
  report.complete=true;save();console.log(JSON.stringify({variant,transport,complete:true,runs:report.runs.length}));
 }catch(error){report.error=error.message;report.stderr=stderr;save();throw error}
 finally{await browser?.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('close',r))}}
}}
