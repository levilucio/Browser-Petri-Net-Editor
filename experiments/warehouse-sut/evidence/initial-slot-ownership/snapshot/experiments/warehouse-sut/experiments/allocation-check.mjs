// Additional baseline review: IDs are within the modeled finite set, but allocated
// by a different tenant/order than the initial APN slot labels suggested.
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';import {resolve} from 'node:path';import {tmpdir} from 'node:os';import {spawn} from 'node:child_process';
import {root,editorImport} from './runtime.mjs';import {apiAdapter} from './adapters.mjs';
const {runBlackBoxExperiment}=await editorImport('src/satel/blackbox/Campaign.js');
const net=JSON.parse(readFileSync(resolve(root,'specification/warehouse.apn.json'))),dir=mkdtempSync(resolve(tmpdir(),'warehouse-allocation-'));
const server=spawn(process.env.PYTHON||'python',[resolve(root,'backend/app.py'),'--port','8883','--db',resolve(dir,'test.sqlite3'),'--test-mode'],{stdio:['ignore','pipe','inherit']});let ready=false;server.stdout.on('data',d=>{if(d.toString().includes('Warehouse SUT http'))ready=true});
try{for(let n=0;!ready&&n<100;n++)await new Promise(r=>setTimeout(r,100));if(!ready)throw Error('Backend failed');
const cases=[{id:'new-order-tenant-assignment',calls:[{method:'openOrder',arguments:{actor:11,order:1001}}]},{id:'new-line-order-assignment',calls:[{method:'openOrder',arguments:{actor:1,order:1001}},{method:'addLine',arguments:{actor:1,order:1001,line:10021,product:101,warehouse:11,quantity:2}}]}];
const reports=[];for(const test of cases)reports.push({...test,...await runBlackBoxExperiment({referenceNet:net,calls:test.calls,createSut:()=>apiAdapter('http://127.0.0.1:8883')},{callTimeoutMs:10000,maxTimeMs:30000,maxBindings:50000})});
writeFileSync(resolve(root,'results/allocation-check.json'),JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports.map(({id,verdict,reason})=>({id,verdict,reason}))));if(reports.some(r=>r.verdict!=='compatible'))process.exitCode=1;
}finally{server.kill();await new Promise(r=>server.once('close',r))}
