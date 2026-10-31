import {readFileSync,writeFileSync,mkdtempSync,renameSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawn,spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {root,editorImport,playwright} from './runtime.mjs';import {apiAdapter,browserAdapter} from './adapters.mjs';
const {runBlackBoxCampaign,runBlackBoxExperiment}=await editorImport('src/satel/blackbox/Campaign.js');
const net=JSON.parse(readFileSync(resolve(root,'specification/warehouse.apn.json'))),saved=JSON.parse(readFileSync(resolve(root,'results/suites.json')));
const args=process.argv.slice(2),opt=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const transport=opt('--transport','api'),port=Number(opt('--port','8881')),base=`http://127.0.0.1:${port}`,label=opt('--out','baseline-'+transport);
const dir=mkdtempSync(resolve(tmpdir(),'warehouse-baseline-')),db=resolve(dir,'sut.sqlite3');
const reportPath=resolve(root,`results/${label}.json`),reports=[];const hash=x=>createHash('sha256').update(x).digest('hex');
const sourceFiles=['backend/app.py','frontend/index.html','frontend/app.js','frontend/style.css','experiments/adapters.mjs','experiments/campaign.mjs','experiments/generate.mjs','specification/warehouse.apn.json','results/suites.json'];
const sourceHashes=Object.fromEntries(sourceFiles.map(p=>[p,hash(readFileSync(resolve(root,p)))]));
const snapshot=()=>{writeFileSync(reportPath+'.tmp',JSON.stringify({transport,seed:1,sourceHashes,suiteHash:hash(readFileSync(resolve(root,'results/suites.json'))),netHash:hash(readFileSync(resolve(root,'specification/warehouse.apn.json'))),runtime:{node:process.version,platform:process.platform,arch:process.arch,browser:browser?.version()},reports},null,2));renameSync(reportPath+'.tmp',reportPath)};
const checkDb=()=>{const r=spawnSync(process.env.PYTHON||'python',['-c',`import importlib.util,json; s=importlib.util.spec_from_file_location('sut',${JSON.stringify(resolve(root,'backend/app.py'))}); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); c=m.connect(${JSON.stringify(db)}); print(json.dumps(m.invariant_report(c))); c.close()`],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr);return JSON.parse(r.stdout)};
const server=spawn(process.env.PYTHON||'python',[resolve(root,'backend/app.py'),'--port',String(port),'--db',db,'--test-mode','--test-key',process.env.WAREHOUSE_TEST_KEY||'local-experiment'],{stdio:['ignore','pipe','pipe']});let stderr='',ready=false;server.stdout.on('data',d=>{if(d.toString().includes('Warehouse SUT http'))ready=true});server.stderr.on('data',d=>stderr+=d);
let browser=null,page=null;
try{
 for(let i=0;!ready&&i<100;i++)await new Promise(r=>setTimeout(r,100));if(!ready)throw Error('Server failed '+stderr);
 if(transport==='ui'){const pw=await playwright();browser=await pw.chromium.launch({headless:true,...process.env.SATEL_CHROMIUM?{executablePath:process.env.SATEL_CHROMIUM}:{},args:['--no-sandbox','--disable-dev-shm-usage']});page=await browser.newPage({viewport:{width:1500,height:1050}})}
 const createSut=()=>transport==='api'?apiAdapter(base):browserAdapter(base,page);
 const options={callTimeoutMs:15000,maxTimeMs:180000,maxBindings:50000,maxTotalBindings:2000000};
 for(const entry of saved.suites){
  if(opt('--only','')&&!entry.id.includes(opt('--only','')))continue;
  for(const test of entry.selectedTests){
   if(!args.includes('--probes-only')){
   const report=await runBlackBoxCampaign({suite:{referenceNet:net,interface:saved.interface,selectedTests:[test]},createSut,repetitions:1,sutName:`Warehouse baseline ${transport}`},options);
   const integrity=checkDb();reports.push({intention:entry.id,testId:test.id,kind:'canonical',...report,integrity});snapshot();
   console.log(JSON.stringify({transport,kind:'canonical',intention:entry.id,test:test.id,counts:report.counts,first:report.runs.find(r=>r.verdict!=='compatible')?.reason}));
   if(report.runs.some(r=>r.verdict!=='compatible')||integrity.integrity!=='ok'||integrity.foreign_keys.length||integrity.stock_failures.length)throw Error('Baseline discrepancy. Preserve results/source before editing: '+reportPath);
   }
   if(!args.includes('--canonical-only')&&test.pairs.at(-1).assertion==='blocked'){
    const calls=[...test.pairs.map(p=>p.stimulation),{method:'readOrder',arguments:{actor:4,order:1001}},{method:'auditCount',arguments:{actor:4,order:1001}},{method:'readStock',arguments:{actor:4,product:101,warehouse:11}}];
    const run=await runBlackBoxExperiment({referenceNet:net,io:saved.interface,calls,createSut,seed:1},options);const integrity=checkDb();reports.push({intention:entry.id,testId:test.id,kind:'post-refusal',calls,run,integrity});snapshot();
    if(run.verdict!=='compatible'||integrity.integrity!=='ok'||integrity.foreign_keys.length||integrity.stock_failures.length)throw Error('Post-refusal discrepancy. Preserve results/source before editing: '+reportPath);
   }
  }
  if(page)await page.screenshot({path:resolve(root,`results/${label}-frontend.png`),fullPage:true});
 }
 console.log(JSON.stringify({completed:reports.length,report:reportPath}));
}catch(error){snapshot();writeFileSync(resolve(root,`results/${label}-stderr.txt`),stderr);throw error}
finally{await browser?.close();if(server.exitCode===null){server.kill();await new Promise(r=>server.once('close',r))}}
