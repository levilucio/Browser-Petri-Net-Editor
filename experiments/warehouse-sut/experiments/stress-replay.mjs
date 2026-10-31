import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdtempSync,renameSync} from 'node:fs';import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawn,spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';import {root,editorImport,playwright} from './runtime.mjs';import {apiAdapter,browserAdapter} from './adapters.mjs';
const {runBlackBoxExperiment}=await editorImport('src/satel/blackbox/Campaign.js');const hash=b=>createHash('sha256').update(b).digest('hex');const sources=['backend/app.py','frontend/app.js','frontend/index.html','frontend/style.css','experiments/adapters.mjs','experiments/stress-replay.mjs','results/stress-manifest.json'];
const manifest=JSON.parse(readFileSync(resolve(root,'results/stress-manifest.json'))),report={complete:false,sourceHashes:Object.fromEntries(sources.map(p=>[p,hash(readFileSync(resolve(root,p)))])),runs:[]};const file=resolve(root,'results/stress-replay-raw.json');const save=()=>{writeFileSync(file+'.tmp',JSON.stringify(report));renameSync(file+'.tmp',file)};
const dir=mkdtempSync(resolve(tmpdir(),'warehouse-stress-replay-')),db=resolve(dir,'sut.sqlite3'),port=8885,base=`http://127.0.0.1:${port}`;
const server=spawn(process.env.PYTHON||'python',[resolve(root,'backend/app.py'),'--port',String(port),'--db',db,'--test-mode'],{stdio:['ignore','pipe','inherit']});let ready=false;server.stdout.on('data',d=>{if(d.toString().includes('Warehouse SUT http'))ready=true});let browser=null;
const check=()=>{const r=spawnSync(process.env.PYTHON||'python',['-c',`import importlib.util,json; s=importlib.util.spec_from_file_location('sut',${JSON.stringify(resolve(root,'backend/app.py'))}); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); c=m.connect(${JSON.stringify(db)}); print(json.dumps(m.invariant_report(c)));c.close()`],{encoding:'utf8'});assert.equal(r.status,0);return JSON.parse(r.stdout)};
try{
 for(let i=0;!ready&&i<100;i++)await new Promise(r=>setTimeout(r,100));assert(ready);
 for(const transport of ['api','ui']){
  if(transport==='ui'){const pw=await playwright();browser=await pw.chromium.launch({headless:true,...process.env.SATEL_CHROMIUM?{executablePath:process.env.SATEL_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage']});report.browser=browser.version()}
  const page=browser?await browser.newPage():null;
  for(const row of manifest.rows.filter(r=>r.config.trial===1&&!r.config.cycles&&r.status==='complete')){
   if(transport==='ui'&&row.config.id.startsWith('population'))continue;
   const suite=JSON.parse(readFileSync(resolve(root,`results/stress-suite-${row.config.id}.json`)));const tests=transport==='api'?suite.tests:[suite.tests.find(t=>t.witnessResult===0),suite.tests.find(t=>t.witnessResult!==0)].filter(Boolean);
   for(const test of tests){const calls=test.pairs.map(p=>p.stimulation);const run=await runBlackBoxExperiment({referenceNet:suite.referenceNet,io:suite.interface,calls,createSut:()=>transport==='api'?apiAdapter(base):browserAdapter(base,page),seed:1},{callTimeoutMs:15000,maxTimeMs:180000,maxBindings:50000,maxTotalBindings:2000000});const integrity=check();report.runs.push({transport,configuration:row.config.id,testId:test.id,calls,...run,integrity});save();
    if(run.verdict!=='compatible'||integrity.integrity!=='ok'||integrity.foreign_keys.length||integrity.stock_failures.length)throw Error('Preserve unseeded stress replay failure before edits: '+file);
   }console.log(JSON.stringify({transport,configuration:row.config.id,tests:tests.length}));
  }
 }
 report.complete=true;save();console.log(JSON.stringify({complete:true,runs:report.runs.length}));
}catch(e){report.error=e.message;save();throw e}finally{await browser?.close();server.kill();await new Promise(r=>server.once('close',r))}
