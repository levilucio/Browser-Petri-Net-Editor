// Reproduce the retained Nat-contract error independently of campaign verdicts.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,playwright} from './runtime.mjs';
import {apiAdapter,browserAdapter} from './adapters.mjs';
const base='http://127.0.0.1:8884',e=1001,record=19010011;
const child=spawn(process.env.PYTHON||'python',[resolve(root,'backend/app.py'),'--port','8884','--db',resolve(root,`data/runs/probe-${Date.now()}/db.sqlite3`),'--test-mode','--test-key',process.env.HR_TEST_KEY||'local-experiment','--mutant','double-charge'],{stdio:['ignore','pipe','pipe']});
const evidence=[];let browser;
try{
 await new Promise((ok,no)=>{const timer=setTimeout(()=>no(Error('Startup timeout')),10000);child.stdout.on('data',d=>{if(d.toString().includes(base)){clearTimeout(timer);ok()}});child.once('error',no)});
 const pw=await playwright();browser=await pw.chromium.launch({headless:true,...(process.env.SATEL_CHROMIUM?{executablePath:process.env.SATEL_CHROMIUM}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const transport of ['api','ui']){
  const adapter=transport==='api'?apiAdapter(base):browserAdapter(base,await browser.newPage());await adapter.reset();
  const calls=[['requestVacation',e,{days:21}],['decideVacation',101,{approve:true}],['balance',e,{}],['takeVacation',e,{}],['balance',e,{}]];
  const steps=[];
  for(const[method,actor,extra]of calls){const call={method,arguments:{actor,employee:e,...(method==='balance'?{}:{record}),...extra}};steps.push({call,response:await adapter.invoke(call)})}
  evidence.push({transport,steps});
 }
 writeFileSync(resolve(root,'results/type-error-probe.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence.map(x=>({transport:x.transport,last:x.steps.at(-1).response}))));
}finally{await browser?.close();if(child.exitCode===null){child.kill();await new Promise(r=>child.once('close',r))}}
