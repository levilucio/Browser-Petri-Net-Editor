import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {root,editorImport,playwright} from './runtime.mjs';
import {apiAdapter,browserAdapter} from './adapters.mjs';
const {runBlackBoxCampaign}=await editorImport('src/satel/blackbox/Campaign.js');
const {checkInterface}=await editorImport('src/satel/core/SequenceRunner.js');
const net=JSON.parse(readFileSync(resolve(root,'specification/hr.apn.json'))), saved=JSON.parse(readFileSync(resolve(root,'results/suites.json')));
const args=process.argv.slice(2), option=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const variants=option('--mutants','none').split(','), transports=option('--transport','api,ui').split(',');
const reportPath=resolve(root,`results/${option('--out','campaign')}.json`);
const reports=args.includes('--resume')?JSON.parse(readFileSync(reportPath)):[];
const runId=`${Date.now()}-${process.pid}`;
const port=option('--port','8877');
const base=`http://127.0.0.1:${port}`, pw=transports.includes('ui')?await playwright():null;
for(const mutant of variants){
 if(transports.every(transport=>saved.suites.filter(e=>!option('--only','')||e.id.includes(option('--only',''))).every(e=>reports.some(r=>r.mutant===mutant&&r.transport===transport&&r.intention===e.id))))continue;
 const server=spawn(process.env.PYTHON||'python',[resolve(root,'backend/app.py'),'--port',port,'--db',resolve(root,`data/runs/${runId}/${mutant}.sqlite3`),'--test-mode','--test-key',process.env.HR_TEST_KEY||'local-experiment','--mutant',mutant],{stdio:['ignore','pipe','pipe']});
 let listening=false;server.stdout.on('data',d=>{if(d.toString().includes(`HR SUT http://127.0.0.1:${port}`))listening=true});
 let stderr='';server.stderr.on('data',d=>stderr+=d.toString());
 try{
  let ready=false;for(let i=0;i<100;i++){try{if(server.exitCode!==null)throw Error('Backend exited');if(listening){const r=await fetch(base+'/api/health');const h=await r.json();if(r.ok&&h.mutant===mutant){ready=true;break}}}catch{}await new Promise(r=>setTimeout(r,100));}if(!ready)throw Error('Backend failed: '+stderr);
  for(const transport of transports){
   const browser=transport==='ui'?await pw.chromium.launch({headless:true,...(process.env.SATEL_CHROMIUM?{executablePath:process.env.SATEL_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage']}):null;
   const page=browser?await browser.newPage({viewport:{width:1440,height:1100}}):null;
   try{for(const entry of saved.suites){
    if(option('--only','')&&!entry.id.includes(option('--only','')))continue;
    if(reports.some(r=>r.mutant===mutant&&r.transport===transport&&r.intention===entry.id))continue;
    console.log(`${mutant} ${transport} ${entry.id}: starting`);
    const createSut=()=>transport==='api'?apiAdapter(base):browserAdapter(base,page);checkInterface(net,createSut().interface);
    const report=await runBlackBoxCampaign({suite:{referenceNet:net,interface:saved.interface,selectedTests:entry.selectedTests},createSut,repetitions:1,sutName:`HR ${mutant} (${transport})`},{callTimeoutMs:10000,maxTimeMs:180000,maxBindings:10000,maxTotalBindings:1000000});
    reports.push({mutant,transport,intention:entry.id,...report});console.log(JSON.stringify({mutant,transport,intention:entry.id,counts:report.counts,first:report.runs.find(r=>r.verdict!=='compatible')?.reason}));
    writeFileSync(reportPath,JSON.stringify(reports,null,2));
    if(page&&mutant==='none'&&entry===saved.suites[0])await page.screenshot({path:resolve(root,'results/hr-frontend.png'),fullPage:true});
   }}finally{await browser?.close()}
  }
 }finally{if(server.exitCode===null){server.kill();await new Promise(resolve=>server.once('close',resolve));}}
}
process.exit(reports.some(r=>r.counts.error||r.counts.inconclusive||r.mutant==='none'&&r.counts.mismatch)?1:0);
