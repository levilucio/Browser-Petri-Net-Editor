import {editorImport} from './runtime.mjs';
const {createHrExample,timeId,vacationId}=await editorImport('src/satel/examples/hr/editor.js');
const pair=(fst,snd)=>({__pair__:true,fst,snd}), outputs=(gate,value)=>({outputs:{[gate]:[value]}});
export const negativeMutants=['manager-scope','cross-tenant-hr','take-pending','repeat-decision','employee-correction'];
export const browserTargets=[
 'negative-seed-time:1:decideTime:actor102',
 'negative-seed-time:1:correctTime:actor1001',
 'negative-seed-time:1:correctTime:actor21',
 'negative-seed-time:3:decideTime:actor101',
 'negative-seed-vacation:1:takeVacation:actor1001',
 'negative-seed-vacation:3:decideVacation:actor101',
 'negative-seed-vacation:5:takeVacation:actor1001',
 'negative-seed-vacation:8:decideVacation:actor101'
];
export function negativeFixture(){
 const net=createHrExample(),employee=1001,time=timeId(employee),vacation=vacationId(employee),actors=[1001,101,102,11,21];
 const call=(method,actor,record,args,gate='ack',value=true)=>({stimulation:{method,arguments:{actor,employee,record,...args}},observation:outputs(gate,value)});
 const seeds=[
  {id:'negative-seed-time',name:'Time submission, approval and correction',testType:'positive',variables:[],pairs:[
   call('logTime',employee,time,{kind:2,minutes:60}),call('readTime',employee,time,{},'timeRecord',pair(2,pair(60,1))),
   call('decideTime',101,time,{approve:true}),call('readTime',employee,time,{},'timeRecord',pair(2,pair(60,2))),
   call('correctTime',11,time,{kind:0,minutes:120,status:2}),call('readTime',employee,time,{},'timeRecord',pair(0,pair(120,2)))
  ]},
  {id:'negative-seed-vacation',name:'Vacation pending, approved, taken and corrected',testType:'positive',variables:[],pairs:[
   call('requestVacation',employee,vacation,{days:5}),call('readVacation',employee,vacation,{},'vacationRecord',pair(5,1)),
   call('decideVacation',101,vacation,{approve:true}),call('readVacation',employee,vacation,{},'vacationRecord',pair(5,2)),
   call('takeVacation',employee,vacation,{}),call('readVacation',employee,vacation,{},'vacationRecord',pair(5,4)),
   call('correctVacation',11,vacation,{days:3,status:3}),call('readVacation',employee,vacation,{},'vacationRecord',pair(3,3))
  ]}
 ];
 const targets=[];
 for(const [seed,prefixes,methods,record] of [[seeds[0],[1,3,6],{logTime:{kind:[0,2],minutes:[60,120]},decideTime:{approve:[false,true]},correctTime:{kind:[0,2],minutes:[60,120],status:[1,2,3]},readTime:{}},time],[seeds[1],[1,3,5,8],{requestVacation:{days:[3,5]},decideVacation:{approve:[false,true]},takeVacation:{},correctVacation:{days:[3,5],status:[1,2,3,4]},readVacation:{}},vacation]]){
  for(const prefixLength of prefixes)for(const [method,parameters] of Object.entries(methods))for(const actor of actors)targets.push({seedId:seed.id,prefixLength,method,parameterDomains:{actor:[actor],employee:[employee],record:[record],...parameters},label:`${seed.id}:${prefixLength}:${method}:actor${actor}`});
 }
 return {net,seeds,targets};
}
