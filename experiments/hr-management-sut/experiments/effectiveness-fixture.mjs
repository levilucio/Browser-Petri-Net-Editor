import {editorImport} from './runtime.mjs';
const {createHrExample,hrWorkLogSource,timeId}=await editorImport('src/satel/examples/hr/editor.js');
export const lengths=[1,2,3];
export const mutantNames=['overwrite-earlier','approval-double-count','correction-adds-old','cross-employee-correction','cap-long-duration','wrong-total'];
export const browserKinds={1:[1],2:[1,3],3:[1,3,0]};
export function workLog(kinds,minutes){return kinds.reduceRight((tail,k,i)=>({ctor:'Entry',args:[k,minutes[i],tail]}),{ctor:'End',args:[]});}
export function entries(log){const out=[];while(log.ctor==='Entry'){out.push(log.args.slice(0,2));log=log.args[2];}if(log.ctor!=='End')throw Error('Malformed WorkLog');return out;}
export function effectivenessFixture(length){
 if(!lengths.includes(length))throw Error('Effectiveness lengths are 1–3');
 const vars=Array.from({length},(_,i)=>`k${i}: Nat, m${i}: Nat`).join(', ');
 const log=ks=>ks.reduceRight((tail,k,i)=>`Entry(${k}, m${i}, ${tail})`,'End()');
 const cases=[];
 function add(ks){
  const lines=[],call=(method,actor,record,args,out)=>lines.push(`pair ${method}(actor=${actor}, employee=${actor===1002?1002:1001}${record===null?'':`, record=${record}`}${args?`, ${args}`:''}) => ${out}`);
  const read=(i,status,minutes=`m${i}`,kind=ks[i])=>call('readTime',1001,timeId(1001,i),'',`timeRecord((${kind}, (${minutes}, ${status})))`);
  const total=terms=>call('totals',1001,null,'',`approvedMinutes(${terms.length?terms.join(' + '):'0'})`);
  call('logTime',1002,timeId(1002),'kind=0, minutes=45','ack(true)');
  for(let i=0;i<length;i++)call('logTime',1001,timeId(1001,i),`kind=${ks[i]}, minutes=m${i}`,'ack(true)');
  for(let i=0;i<length;i++)read(i,ks[i]===0?2:1);
  total(ks.flatMap((k,i)=>k===0?[`m${i}`]:[]));
  let changes=length;
  for(let i=0;i<length;i++)if(ks[i]!==0){call('decideTime',101,timeId(1001,i),`approve=${ks[i]!==3}`,'ack(true)');changes++;read(i,ks[i]===3?3:2);}
  total(ks.flatMap((k,i)=>k!==3?[`m${i}`]:[]));
  const last=length-1;
  for(const minutes of [60,120]){
   call('correctTime',11,timeId(1001,last),`kind=0, minutes=${minutes}, status=2`,'ack(true)');changes++;
   read(last,2,String(minutes),0);
   total([...ks.slice(0,last).flatMap((k,i)=>k!==3?[`m${i}`]:[]),String(minutes)]);
  }
  call('readTime',1002,timeId(1002),'','timeRecord((0, (45, 2)))');
  call('totals',1002,null,'','approvedMinutes(45)');
  call('auditCount',11,null,'',`changes(${changes})`);
  cases.push(`case kinds_${ks.join('_')}(${ks.map((_,i)=>`m${i}: Nat`).join(', ')}):\ninputs ${log(ks)}\nresult ${ks.filter(k=>k!==0).length}\n${lines.join('\n')}`);
 }
 function enumerate(ks=[]){if(ks.length===length)return add(ks);for(let k=0;k<5;k++)enumerate([...ks,k]);}enumerate();
 const intention={id:`hr-effectiveness-${length}`,name:`Observed HR workflow with ${length} work entries`,kind:'symbolic',symbolic:{source:hrWorkLogSource,variablesText:vars,argsText:log(Array.from({length},(_,i)=>`k${i}`)),operation:'reviews',maxDepth:length+1,protocolSource:cases.join('\n')}};
 return {net:createHrExample({slots:5}),intention};
}
