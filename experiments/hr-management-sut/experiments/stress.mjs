import {spawn,execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve}from'node:path';import{cpus}from'node:os';import{createHash}from'node:crypto';
import {root,editorRoot} from './runtime.mjs';
const configs=[...Array.from({length:5},(_,i)=>({length:i+1,depth:i+2})),...[2,3,4,6,8].map(depth=>({depth}))];
const result={recordedAt:new Date().toISOString(),node:process.version,cpu:cpus()[0]?.model,logicalCpus:cpus().length,methodology:'Sequential isolated child per case, two measured trials after separate Z3 initialization. 5-second soft budget and 2048 branch alternatives; 35-second process limit. No other experiment jobs run concurrently. Partial is not infeasible or complete coverage. Independent procedural evaluation of every emitted witness.',sourceSha256:Object.fromEntries(['src/satel/examples/hr/editor.js','src/satel/core/GenericSubuniformity.js','src/satel/core/ExecutableSequence.js'].map(p=>[p,createHash('sha256').update(readFileSync(resolve(editorRoot,p))).digest('hex')])),results:[]};
for(const config of configs){
 const row={config,samples:[]};await new Promise(done=>{
 const child=spawn(process.execPath,[resolve(root,'experiments/stress-worker.mjs'),JSON.stringify(config)],{stdio:['ignore','pipe','pipe']});let pending='',stderr='';
 const timer=setTimeout(()=>{row.hardTimeout=true;child.kill('SIGKILL')},35000);
 child.stdout.on('data',d=>{pending+=d;let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+1);try{const e=JSON.parse(line);if(e.type==='sample')row.samples.push(e.row);if(e.type==='done')row.initMs=e.initMs}catch{}}});child.stderr.on('data',d=>stderr=(stderr+d).slice(-1000));child.on('close',(code,signal)=>{clearTimeout(timer);row.exitCode=code;row.signal=signal;if(code)row.stderr=stderr;done()});
 });result.results.push(row);writeFileSync(resolve(root,'results/stress.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({config,samples:row.samples.map(s=>({classes:s.classes,unresolved:s.unresolved,ms:Math.round(s.elapsedMs),status:s.status})),hardTimeout:row.hardTimeout}));
}
