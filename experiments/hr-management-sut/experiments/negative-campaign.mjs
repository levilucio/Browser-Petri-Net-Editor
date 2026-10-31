import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,renameSync,copyFileSync} from 'node:fs';import {resolve} from 'node:path';import {spawn,spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {tmpdir} from 'node:os';
import {root,editorImport,playwright} from './runtime.mjs';import {apiAdapter,browserAdapter} from './adapters.mjs';
import {negativeMutants as mutantNames} from './negative-fixture.mjs';
const {runBlackBoxCampaign}=await editorImport('src/satel/blackbox/Campaign.js');
const args=process.argv.slice(2),get=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const variants=get('--variants','none').split(','),transport=get('--transport','api');assert(['api','ui'].includes(transport));assert(variants.every(v=>v==='none'||mutantNames.includes(v)));
const hash=x=>createHash('sha256').update(x).digest('hex');
const manifest=JSON.parse(readFileSync(resolve(root,'results/negative-manifest.json')));
const raw=readFileSync(resolve(root,'results/negative-suite.json'));assert.equal(hash(raw),manifest.suiteSha256);const saved=[JSON.parse(raw)];
if(variants.some(v=>v!=='none'))for(const t of ['api','ui']){
 const baseline=JSON.parse(readFileSync(resolve(root,`results/negative-none-${t}.json`)));
 assert.equal(baseline.manifestSha256,hash(JSON.stringify(manifest)));assert.deepEqual(baseline.databaseIntegrity,[['ok']]);assert(baseline.complete&&baseline.runs.every(r=>r.verdict==='compatible'),'Both unmutated transports must pass before mutations');
}
const port=get('--port','8879'),base=`http://127.0.0.1:${port}`,pw=transport==='ui'?await playwright():null;
for(const mutant of variants){
 const runId=`${Date.now()}-${process.pid}`,out=resolve(root,`results/negative-${mutant}-${transport}.json`),traceOut=resolve(root,`results/negative-${mutant}-${transport}.jsonl`);
 const localDir=resolve(tmpdir(),'hr-negative',runId);mkdirSync(localDir,{recursive:true});const trace=resolve(localDir,'events.jsonl');
 const dbPath=resolve(get('--db-root',resolve(tmpdir(),'hr-negative')),`${runId}/${mutant}.sqlite3`);
 const server=spawn(process.env.PYTHON||'python',[resolve(root,'backend/app.py'),'--port',port,'--db',dbPath,'--test-mode','--test-key','local-experiment','--mutant',mutant],{stdio:['ignore','pipe','pipe']});
 let listening=false,stderr='';server.stdout.on('data',d=>{if(d.toString().includes(base))listening=true});server.stderr.on('data',d=>stderr=(stderr+d).slice(-4000));
 let browser;
 const report={mutant,transport,manifestSha256:hash(JSON.stringify(manifest)),backendSha256:hash(readFileSync(resolve(root,'backend/app.py'))),runs:[],complete:false,startedAt:new Date().toISOString()};
 const start=performance.now();writeFileSync(trace,'');
 writeFileSync(out+'.pending',JSON.stringify(report,null,2));renameSync(out+'.pending',out);
 try{
  let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Backend exited: '+stderr);if(listening){try{const r=await fetch(base+'/api/health');if((await r.json()).mutant===mutant){ready=true;break}}catch{}}await new Promise(r=>setTimeout(r,100));}assert(ready,'Backend not ready: '+stderr);
  browser=transport==='ui'?await pw.chromium.launch({headless:true,...(process.env.SATEL_CHROMIUM?{executablePath:process.env.SATEL_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage']}):null;
  const page=browser?await browser.newPage():null;
  for(const s of saved)for(const test of s.tests.filter(t=>transport==='api'||t.browser)){
   const campaign=await runBlackBoxCampaign({suite:{referenceNet:s.referenceNet,interface:s.interface,selectedTests:[test]},createSut:()=>transport==='api'?apiAdapter(base):browserAdapter(base,page),repetitions:1},{callTimeoutMs:15000,maxTimeMs:180000,maxBindings:10000,maxTotalBindings:1000000});
   for(const r of campaign.runs){
   const key={testId:test.id,target:test.target,kind:test.kind,browser:test.browser,pathIndex:r.pathIndex,phase:test.kind==='negative'?(r.calls.length===test.pairs.length?'refusal':'positive-prefix'):'positive-control'};
   appendFileSync(trace,JSON.stringify({...key,...r})+'\n');
   report.runs.push({...key,verdict:r.verdict,reason:r.reason,step:r.step,durationMs:r.stats.durationMs,eventCount:r.events.length,eventSha256:hash(JSON.stringify(r.events)),propertyEvidence:r.propertyEvidence,reasonCode:r.reasonCode,...(r.verdict!=='compatible'?{lastEvent:r.events.at(-1)}:{})});
   if(report.runs.length%25===0)console.log(JSON.stringify({mutant,transport,finished:report.runs.length,seconds:(performance.now()-start)/1000}));
   }
  }
  const integrity=spawnSync(process.env.PYTHON||'python',['-c',"import sqlite3,json,sys; c=sqlite3.connect(sys.argv[1]); print(json.dumps(c.execute('PRAGMA quick_check').fetchall())); c.close()",dbPath],{encoding:'utf8'});
  report.databaseIntegrity=integrity.status===0?JSON.parse(integrity.stdout):{error:integrity.stderr};
  report.complete=true;report.elapsedMs=performance.now()-start;report.rss=process.memoryUsage().rss;report.counts=report.runs.reduce((a,r)=>(a[r.verdict]=(a[r.verdict]||0)+1,a),{});writeFileSync(out+'.pending',JSON.stringify(report,null,2));renameSync(out+'.pending',out);copyFileSync(trace,traceOut);console.log(JSON.stringify({mutant,transport,counts:report.counts,seconds:report.elapsedMs/1000}));
 }finally{await browser?.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('close',r));}}
 assert.deepEqual(report.databaseIntegrity,[['ok']],'Database integrity failed');
 assert(!report.runs.some(r=>['error','inconclusive'].includes(r.verdict)),'Unresolved/error runs must be investigated');
 if(mutant==='none')assert(report.runs.every(r=>r.verdict==='compatible'),'Unmutated SUT mismatch');
}
process.exit();
