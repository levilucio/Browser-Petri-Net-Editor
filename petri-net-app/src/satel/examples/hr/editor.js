import { builder, pairValue, intention, cases } from '../exercises/builder.js';
import { convertOutputPlacesToGates } from '../../../domain/apn/GateMigration.js';

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
const fields = { k:'asInt(fst(t))', m:'asInt(fst(asPair(snd(t))))', s:'asInt(snd(asPair(snd(t))))', d:'asInt(fst(v))', vs:'asInt(snd(v))' };
export function createHrExample({ employees = [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,101,2001] } = {}) {
  const b=builder();
  for(const [name,sort] of [['ack','Bool'],['timeRecord','Pair'],['vacationRecord','Pair'],['remaining','Nat'],['approvedMinutes','Nat'],['changes','Nat']])b.place(name,sort,[],true);
  const write=(id,name,parameters,guard,inputs,outputs,eid)=>b.rule(id,name,parameters,guard,[...inputs,[`audit_${eid}`,'a']],[...outputs,[`audit_${eid}`,'a + 1'],['ack','true']]);
  for(const eid of employees){
    const company=eid>=2000?2:1, manager=eid>=1000?(company*100+Math.floor((eid%1000-1)/20)+1):0;
    const hr=company===1?'(actor == 11 or actor == 12)':'(actor == 21 or actor == 22)';
    const own=`actor == ${eid}`, boss=manager?`actor == ${manager}`:'false', read=`(${own} or ${boss} or ${hr})`;
    b.place(`balance_${eid}`,'Nat',[30]);b.place(`audit_${eid}`,'Nat',[0]);
    for(let slot=0;slot<2;slot++){
      const tp=`time_${eid}_${slot}`, vp=`vacation_${eid}_${slot}`, tr=timeId(eid,slot),vr=vacationId(eid,slot), p={actor:'Nat',employee:'Nat',record:'Nat'};
      b.place(tp,'Pair',[pairValue(0,pairValue(0,0))]);b.place(vp,'Pair',[pairValue(0,0)]);
      const tg=`employee == ${eid} and record == ${tr}`, vg=`employee == ${eid} and record == ${vr}`;
      for(const [suffix,kindGuard,state]of [['standard','kind == 0',2],['special','kind >= 1 and kind <= 4',1]])
        write(`${tp}_log_${suffix}`,'logTime',{...p,kind:'Nat',minutes:'Nat'},`${tg} and ${own} and ${fields.s} == 0 and ${kindGuard} and minutes >= 15 and minutes <= 720`,[[tp,'t']],[[tp,`(kind, (minutes, ${state}))`]],eid);
      for(const approve of [true,false])write(`${tp}_decide_${approve}`,'decideTime',{...p,approve:'Bool'},`${tg} and ${boss} and ${fields.s} == 1 and approve == ${approve}`,[[tp,'t']],[[tp,`(${fields.k}, (${fields.m}, ${approve?2:3}))`]],eid);
      write(`${tp}_correct`,'correctTime',{...p,kind:'Nat',minutes:'Nat',status:'Nat'},`${tg} and ${hr} and ${fields.s} >= 1 and kind <= 4 and minutes >= 15 and minutes <= 720 and status >= 1 and status <= 3`,[[tp,'t']],[[tp,'(kind, (minutes, status))']],eid);
      b.rule(`${tp}_read`,'readTime',p,`${tg} and ${read} and ${fields.s} >= 1`,[[tp,'t']],[[tp,'t'],['timeRecord','t']]);
      write(`${vp}_request`,'requestVacation',{...p,days:'Nat'},`${vg} and ${own} and ${fields.vs} == 0 and days >= 1 and days <= 30`,[[vp,'v']],[[vp,'(days, 1)']],eid);
      for(const approve of [true,false])write(`${vp}_decide_${approve}`,'decideVacation',{...p,approve:'Bool'},`${vg} and ${boss} and ${fields.vs} == 1 and approve == ${approve}${approve?` and balance >= ${fields.d}`:''}`,[[vp,'v'],[`balance_${eid}`,'balance']],[[vp,`(${fields.d}, ${approve?2:3})`],[`balance_${eid}`,approve?`balance - ${fields.d}`:'balance']],eid);
      write(`${vp}_take`,'takeVacation',p,`${vg} and ${own} and ${fields.vs} == 2`,[[vp,'v']],[[vp,`(${fields.d}, 4)`]],eid);
      for(const oldCharge of [true,false])for(const newCharge of [true,false]){
        const old=oldCharge?fields.d:'0', next=newCharge?'days':'0';
        write(`${vp}_correct_${oldCharge}_${newCharge}`,'correctVacation',{...p,days:'Nat',status:'Nat'},`${vg} and ${hr} and ${fields.vs} >= 1 and days >= 1 and days <= 30 and status >= 1 and status <= 4 and ${oldCharge?'':'not '}(${fields.vs} == 2 or ${fields.vs} == 4) and ${newCharge?'':'not '}(status == 2 or status == 4) and balance + ${old} >= ${next}`,[[vp,'v'],[`balance_${eid}`,'balance']],[[vp,'(days, status)'],[`balance_${eid}`,`balance + ${old} - ${next}`]],eid);
      }
      b.rule(`${vp}_read`,'readVacation',p,`${vg} and ${read} and ${fields.vs} >= 1`,[[vp,'v']],[[vp,'v'],['vacationRecord','v']]);
    }
    for(const [name,place,out]of [['balance',`balance_${eid}`,'remaining'],['auditCount',`audit_${eid}`,'changes']])b.rule(`read_${name}_${eid}`,name,{actor:'Nat',employee:'Nat'},`employee == ${eid} and ${read}`,[[place,'n']],[[place,'n'],[out,'n']]);
    for(const a of [true,false])for(const z of [true,false])b.rule(`totals_${eid}_${a}_${z}`,'totals',{actor:'Nat',employee:'Nat'},`employee == ${eid} and ${read} and asInt(snd(asPair(snd(x)))) ${a?'==':'!='} 2 and asInt(snd(asPair(snd(y)))) ${z?'==':'!='} 2`,[[`time_${eid}_0`,'x'],[`time_${eid}_1`,'y']],[[`time_${eid}_0`,'x'],[`time_${eid}_1`,'y'],['approvedMinutes',`${a?'asInt(fst(asPair(snd(x))))':'0'} + ${z?'asInt(fst(asPair(snd(y))))':'0'}`]]);
  }
  b.net.testIntentions=[...hrIntentions(), rosterIntention(employees)];b.net.satelExample={id:'hr-management-reference',name:'HR management — Reference',role:'reference',description:'Two companies; scoped employees, two work entries and two vacation requests per employee; role and approval workflows.'};
  const net=convertOutputPlacesToGates(b.net);net.apnClass='HRManagement';
  // Spread the larger model by employee, retaining the standard graphical renderer.
  net.places.forEach((p,i)=>{p.x=120+(i%6)*260;p.y=100+Math.floor(i/6)*200});
  net.transitions.forEach((t,i)=>{t.x=1900+(i%12)*180;t.y=100+Math.floor(i/12)*150});
  return net;
}
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
export const hrExamples=[{filename:'hr-management-reference',displayName:'HR management — Reference',description:'Work types, vacation approvals, HR corrections, and audit history across company boundaries.'}];

function rosterIntention(employees) {
 const source='operation hrFor(Nat): Nat\n'+employees.map(e=>`rule employee${e}(e: Nat): hrFor(e) = ${e>=2000?21:11} if e == ${e}`).join('\n');
 const record='9000000 + e * 10 + 1';
 return intention('hr-roster','Employee roster across departments and companies',source,'e: Nat','e','hrFor','',cases('e: Nat, hr: Nat','e','hr',[
  `pair logTime(actor=e, employee=e, record=${record}, kind=2, minutes=120) => ack(true)`,
  `pair correctTime(actor=hr, employee=e, record=${record}, kind=0, minutes=180, status=2) => ack(true)`,
  `pair readTime(actor=e, employee=e, record=${record}) => timeRecord((0, (180, 2)))`,
  'pair auditCount(actor=hr, employee=e) => changes(2)'
 ]),2);
}
