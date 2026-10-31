import { intention, cases } from '../exercises/builder.js';

export const hrWorkLogSource = `constructor End(): WorkLog
constructor Entry(Nat, Nat, WorkLog): WorkLog
operation reviews(WorkLog): Nat
rule reviews.end(): reviews(End()) = 0
rule reviews.standard(k: Nat, m: Nat, rest: WorkLog): reviews(Entry(k, m, rest)) = reviews(rest) if k == 0 and m >= 15 and m <= 720
rule reviews.trip(k: Nat, m: Nat, rest: WorkLog): reviews(Entry(k, m, rest)) = 1 + reviews(rest) if k == 1 and m >= 15 and m <= 720
rule reviews.home(k: Nat, m: Nat, rest: WorkLog): reviews(Entry(k, m, rest)) = 1 + reviews(rest) if k == 2 and m >= 15 and m <= 720
rule reviews.training(k: Nat, m: Nat, rest: WorkLog): reviews(Entry(k, m, rest)) = 1 + reviews(rest) if k == 3 and m >= 15 and m <= 720
rule reviews.oncall(k: Nat, m: Nat, rest: WorkLog): reviews(Entry(k, m, rest)) = 1 + reviews(rest) if k == 4 and m >= 15 and m <= 720`;
export const timeId = (employee, slot=0) => 9000000+employee*10+slot+1;
export const vacationId = (employee, slot=0) => 19000000+employee*10+slot+1;
export function hrIntentions(){
 const e=1001,t=[timeId(e),timeId(e,1)],v=[vacationId(e),vacationId(e,1)], ack='ack(true)';
 const call=(m,args,out)=>`pair ${m}(${Object.entries(args).map(([k,v])=>`${k}=${v}`).join(', ')}) => ${out}`;
 const base=(actor,record)=>({actor,employee:e,...(record?{record}:{})});
 const protocols=[];
 for(let k0=0;k0<5;k0++)for(let k1=0;k1<5;k1++){
  const ks=[k0,k1], lines=[];let count=0;
  for(let i=0;i<2;i++){
   lines.push(call('logTime',{...base(e,t[i]),kind:ks[i],minutes:`m${i}`},ack));count++;
   lines.push(call('readTime',base(e,t[i]),`timeRecord((${ks[i]}, (m${i}, ${ks[i]===0?2:1})))`));
  }
  // This total is taken before managers decide, exposing premature inclusion.
  lines.push(call('totals',base(e),`approvedMinutes(${k0===0?'m0':'0'} + ${k1===0?'m1':'0'})`));
  for(let i=0;i<2;i++)if(ks[i]!==0){
   lines.push(call('decideTime',{...base(101,t[i]),approve:ks[i]!==3},ack));count++;
   lines.push(call('readTime',base(e,t[i]),`timeRecord((${ks[i]}, (m${i}, ${ks[i]===3?3:2})))`));
  }
  lines.push(call('correctTime',{...base(11,t[0]),kind:0,minutes:60,status:2},ack));count++;
  lines.push(call('readTime',base(e,t[0]),'timeRecord((0, (60, 2)))'));
  lines.push(call('totals',base(e),`approvedMinutes(60 + ${k1===3?'0':'m1'})`));
  lines.push(call('auditCount',base(11),`changes(${count})`));
  protocols.push(cases('m0: Nat, m1: Nat',`Entry(${k0}, m0, Entry(${k1}, m1, End()))`,String(Number(k0!==0)+Number(k1!==0)),lines,`work_${k0}_${k1}`));
 }
 const work=intention('hr-work-log','Two-entry work-log ADT: all five work types',hrWorkLogSource,'k0: Nat, m0: Nat, k1: Nat, m1: Nat','Entry(k0, m0, Entry(k1, m1, End()))','reviews','',protocols.join('\n'),3);
 const out=[work];
 const daySource=`operation band(Nat): Nat\nrule short(d: Nat): band(d) = 1 if d >= 1 and d <= 5\nrule medium(d: Nat): band(d) = 2 if d >= 6 and d <= 20\nrule long(d: Nat): band(d) = 3 if d >= 21 and d <= 30`;
 for(const scenario of ['approved','declined','take-pending','balance-exhaustion']){
  const lines=[call('requestVacation',{...base(e,v[0]),days:'d'},ack)];
  if(scenario==='take-pending')lines.push(call('takeVacation',base(e,v[0]),'refused'));
  else if(scenario==='declined')lines.push(call('decideVacation',{...base(101,v[0]),approve:false},ack),call('balance',base(e),'remaining(30)'),call('readVacation',base(e,v[0]),'vacationRecord((d, 3))'));
  else {
   lines.push(call('decideVacation',{...base(101,v[0]),approve:true},ack),call('balance',base(e),'remaining(30 - d)'));
   if(scenario==='balance-exhaustion')lines.push(call('requestVacation',{...base(e,v[1]),days:30},ack),call('decideVacation',{...base(101,v[1]),approve:true},'refused'));
   else lines.push(call('takeVacation',base(e,v[0]),ack),call('balance',base(e),'remaining(30 - d)'),call('correctVacation',{...base(11,v[0]),days:1,status:4},ack),call('balance',base(e),'remaining(29)'),call('readVacation',base(e,v[0]),'vacationRecord((1, 4))'),call('auditCount',base(11),'changes(4)'));
  }
  out.push(intention(`hr-vacation-${scenario}`,`Vacation: ${scenario}`,daySource,'d: Nat','d','band','',cases('d: Nat, band: Nat','d','band',lines),2));
 }
 // Role partitions are defining equations, then independently checked by APN admission.
 for(const action of ['correctTime','decideTime','decideVacation']){
  const allowed=action==='correctTime'?11:101, actors=[1001,101,102,11,21];
  const src='operation permission(Nat): Bool\n'+actors.map(a=>`rule actor${a}(a: Nat): permission(a) = ${a===allowed} if a == ${a}`).join('\n');
  const time=action.endsWith('Time'),record=time?t[0]:v[0];
  const prefix=call(time?'logTime':'requestVacation',{...base(e,record),...(time?{kind:2,minutes:60}:{days:5})},ack);
  const args={...base('actor',record),...(action==='correctTime'?{kind:0,minutes:120,status:2}:{approve:true})};
  const protocol=[true,false].map(ok=>cases('actor: Nat','actor',String(ok),[prefix,call(action,args,ok?ack:'refused')],`permission_${ok}`)).join('\n');
  out.push(intention(`hr-role-${action}`,`Roles and company scope: ${action}`,src,'actor: Nat','actor','permission','',protocol,2));
 }
 return out;
}
export function rosterIntention(employees) {
 const source='operation hrFor(Nat): Nat\n'+employees.map(e=>`rule employee${e}(e: Nat): hrFor(e) = ${e>=2000?21:11} if e == ${e}`).join('\n');
 const record='9000000 + e * 10 + 1';
 return intention('hr-roster','Employee roster across departments and companies',source,'e: Nat','e','hrFor','',cases('e: Nat, hr: Nat','e','hr',[
  `pair logTime(actor=e, employee=e, record=${record}, kind=2, minutes=120) => ack(true)`,
  `pair correctTime(actor=hr, employee=e, record=${record}, kind=0, minutes=180, status=2) => ack(true)`,
  `pair readTime(actor=e, employee=e, record=${record}) => timeRecord((0, (180, 2)))`,
  'pair auditCount(actor=hr, employee=e) => changes(2)'
 ]),2);
}
