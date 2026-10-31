import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root} from './runtime.mjs';
const read=name=>JSON.parse(readFileSync(resolve(root,'results',name+'.json')));
const current=[...read('index-baseline'),...read('index-mutants-api'),...read('index-mutants-ui-a'),...read('index-mutants-ui-b'),...read('index-mutants-ui-c')];
const previous=[...read('generic-baseline'),...read('generic-mutants')];
const signature=r=>JSON.stringify(r.runs.map(x=>({testId:x.testId,pathIndex:x.pathIndex,repetition:x.repetition,verdict:x.verdict,calls:x.calls,events:x.events})));
const failures=[],counts={};let runs=0;
for(const r of current){
 const key=[r.mutant,r.transport,r.intention].join('/');
 const old=previous.find(p=>p.mutant===r.mutant&&p.transport===r.transport&&p.intention===r.intention);
 if(!old||signature(old)!==signature(r))failures.push(key+' differs from frozen pre-index replay');
 const other=current.find(p=>p.mutant===r.mutant&&p.transport!==r.transport&&p.intention===r.intention);
 if(!other||signature(other)!==signature(r))failures.push(key+' differs across transports');
 counts[r.mutant] ||= {};
 const c=counts[r.mutant][r.transport] ||= {compatible:0,mismatch:0,error:0,inconclusive:0};
 for(const k of Object.keys(c))c[k]+=r.counts[k];runs+=r.runs.length;
}
if(current.length!==144||new Set(current.map(r=>[r.mutant,r.transport,r.intention].join('/'))).size!==144)failures.push('Expected 144 unique intention/variant/transport reports');
const result={reports:current.length,runs,counts,failures,sameFrozenEventsAndVerdicts:!failures.length,apiUiEventsAndVerdictsAgree:!failures.length};
writeFileSync(resolve(root,'results/index-summary.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));process.exit(failures.length?1:0);
