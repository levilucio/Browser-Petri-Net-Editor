import { builder, pairValue } from '../exercises/builder.js';
import { convertOutputPlacesToGates } from '../../../domain/apn/GateMigration.js';
import { hrIntentions, rosterIntention, timeId, vacationId } from './intentions.js';

const fields = { k:'asInt(fst(t))', m:'asInt(fst(asPair(snd(t))))', s:'asInt(snd(asPair(snd(t))))', d:'asInt(fst(v))', vs:'asInt(snd(v))' };
export function createExpandedHrExample({ employees = [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,101,2001] } = {}) {
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
  b.net.testIntentions=[...hrIntentions(), rosterIntention(employees)];b.net.satelExample={id:'hr-management-expanded-reference',name:'HR management — Expanded benchmark',role:'reference',description:'Two companies; scoped employees, two work entries and two vacation requests per employee; role and approval workflows.'};
  const net=convertOutputPlacesToGates(b.net);net.apnClass='HRManagementExpanded';
  // Spread the larger model by employee, retaining the standard graphical renderer.
  net.places.forEach((p,i)=>{p.x=120+(i%6)*260;p.y=100+Math.floor(i/6)*200});
  net.transitions.forEach((t,i)=>{t.x=1900+(i%12)*180;t.y=100+Math.floor(i/12)*150});
  return net;
}
