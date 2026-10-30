import { builder, pairValue } from '../exercises/builder.js';
import { convertOutputPlacesToGates } from '../../../domain/apn/GateMigration.js';
import { hrIntentions, rosterIntention, timeId, vacationId } from './intentions.js';
export { hrIntentions, hrWorkLogSource, timeId, vacationId } from './intentions.js';

export { createExpandedHrExample } from './expanded.js';

export const defaultEmployees = [1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,101,2001];
// Fixture facts only. No employee identity or record ID is embedded in a rule.
export function hrPeople() {
  const people=[];
  for (const company of [1,2]) {
    for (let department=1;department<=6;department++) {
      const manager=company*100+department;
      people.push({id:manager,company,manager:0,role:2});
      for(let n=1;n<=20;n++) people.push({id:company*1000+(department-1)*20+n,company,manager,role:1});
    }
    for(const n of [1,2])people.push({id:company*10+n,company,manager:0,role:3});
  }
  return people;
}
const tuple = (...xs) => xs.length===2 ? pairValue(...xs) : pairValue(xs[0],tuple(...xs.slice(1)));
const expression = (...xs) => xs.length===2 ? `(${xs[0]}, ${xs[1]})` : `(${xs[0]}, ${expression(...xs.slice(1))})`;
function field(variable,index,length) {
  let term=variable;
  for(let i=0;i<Math.min(index,length-2);i++)term=`asPair(snd(${term}))`;
  return `asInt(${index===length-1?'snd':'fst'}(${term}))`;
}
const fields=(v,n)=>Array.from({length:n},(_,i)=>field(v,i,n));

/** Generic rules over shared multisets. Roster and slot bounds affect only M0.
 * employees: (id, company, manager, balance, auditCount, approvedMinutes)
 * principals: (id, company, role); timeEntries: (id, owner, kind, minutes, status)
 * vacations: (id, owner, days, status). Tuples are right-nested built-in Pairs.
 * Approved totals are an incrementally maintained derived value, checked against
 * the expanded reference's independent summation in differential tests.
 */
export function createHrExample({employees=defaultEmployees,slots=2,people=hrPeople()}={}) {
  if(!Number.isInteger(slots)||slots<1||slots>8)throw Error('Use 1–8 reserved record slots per employee');
  if(new Set(employees).size!==employees.length)throw Error('Duplicate modeled employee');
  const roster=employees.map(id=>{const p=people.find(p=>p.id===id);if(!p)throw Error(`Missing employee facts: ${id}`);return p});
  const principals=people.filter(p=>employees.includes(p.id)||p.role!==1);
  const b=builder();
  b.place('employees','Pair',roster.map(p=>tuple(p.id,p.company,p.manager,30,0,0)));
  b.place('principals','Pair',principals.map(p=>tuple(p.id,p.company,p.role)));
  b.place('timeEntries','Pair',roster.flatMap(p=>Array.from({length:slots},(_,s)=>tuple(timeId(p.id,s),p.id,0,0,0))));
  b.place('vacations','Pair',roster.flatMap(p=>Array.from({length:slots},(_,s)=>tuple(vacationId(p.id,s),p.id,0,0))));
  for(const [name,sort] of [['ack','Bool'],['timeRecord','Pair'],['vacationRecord','Pair'],['remaining','Nat'],['approvedMinutes','Nat'],['changes','Nat']])b.place(name,sort,[],true);
  const [eid,company,manager,balance,audit,total]=fields('e',6),[aid,acompany,role]=fields('a',3);
  const [tid,owner,kind,minutes,status]=fields('t',5),[vid,vowner,days,vstatus]=fields('v',4);
  const identity=`employee == ${eid} and actor == ${aid}`;
  const own='actor == employee',hr=`${role} == 3 and ${acompany} == ${company}`;
  const boss=`${role} == 2 and actor == ${manager} and actor != employee and ${acompany} == ${company}`;
  const readable=`(${own} or (${boss}) or (${hr}))`;
  const time=`record == ${tid} and employee == ${owner}`,vacation=`record == ${vid} and employee == ${vowner}`;
  const state=(bal=balance,count=audit,sum=total)=>expression(eid,company,manager,bal,count,sum);
  const parameters={actor:'Nat',employee:'Nat',record:'Nat'};
  const rule=(id,method,params,guard,inputs,outputs,next='e')=>b.rule(id,method,params,`${identity} and (${guard})`,[['employees','e'],['principals','a'],...inputs],[['employees',next],['principals','a'],...outputs]);
  const write=(id,method,params,guard,inputs,outputs,bal=balance,sum=total)=>rule(id,method,params,guard,inputs,[...outputs,['ack','true']],state(bal,`${audit} + 1`,sum));
  for(const standard of [true,false])write(`log_${standard?'standard':'special'}`,'logTime',{...parameters,kind:'Nat',minutes:'Nat'},`${own} and ${time} and ${status} == 0 and ${standard?'kind == 0':'kind >= 1 and kind <= 4'} and minutes >= 15 and minutes <= 720`,[['timeEntries','t']],[['timeEntries',expression(tid,owner,'kind','minutes',standard?2:1)]],balance,standard?`${total} + minutes`:total);
  for(const approve of [true,false])write(`decide_time_${approve}`,'decideTime',{...parameters,approve:'Bool'},`${boss} and ${time} and ${status} == 1 and approve == ${approve}`,[['timeEntries','t']],[['timeEntries',expression(tid,owner,kind,minutes,approve?2:3)]],balance,approve?`${total} + ${minutes}`:total);
  for(const oldApproved of [true,false])for(const newApproved of [true,false])write(`correct_time_${oldApproved}_${newApproved}`,'correctTime',{...parameters,kind:'Nat',minutes:'Nat',status:'Nat'},`${hr} and ${time} and ${status} >= 1 and ${status} ${oldApproved?'==':'!='} 2 and status ${newApproved?'==':'!='} 2 and kind <= 4 and minutes >= 15 and minutes <= 720 and status >= 1 and status <= 3`,[['timeEntries','t']],[['timeEntries',expression(tid,owner,'kind','minutes','status')]],balance,`${total} - ${oldApproved?minutes:'0'} + ${newApproved?'minutes':'0'}`);
  rule('read_time','readTime',parameters,`${readable} and ${time} and ${status} >= 1`,[['timeEntries','t']],[['timeEntries','t'],['timeRecord',expression(kind,minutes,status)]]);
  write('request_vacation','requestVacation',{...parameters,days:'Nat'},`${own} and ${vacation} and ${vstatus} == 0 and days >= 1 and days <= 30`,[['vacations','v']],[['vacations',expression(vid,vowner,'days',1)]]);
  for(const approve of [true,false])write(`decide_vacation_${approve}`,'decideVacation',{...parameters,approve:'Bool'},`${boss} and ${vacation} and ${vstatus} == 1 and approve == ${approve}${approve?` and ${balance} >= ${days}`:''}`,[['vacations','v']],[['vacations',expression(vid,vowner,days,approve?2:3)]],approve?`${balance} - ${days}`:balance);
  write('take_vacation','takeVacation',parameters,`${own} and ${vacation} and ${vstatus} == 2`,[['vacations','v']],[['vacations',expression(vid,vowner,days,4)]]);
  for(const oldCharge of [true,false])for(const newCharge of [true,false]) {
    const old=oldCharge?days:'0',next=newCharge?'days':'0';
    write(`correct_vacation_${oldCharge}_${newCharge}`,'correctVacation',{...parameters,days:'Nat',status:'Nat'},`${hr} and ${vacation} and ${vstatus} >= 1 and days >= 1 and days <= 30 and status >= 1 and status <= 4 and ${oldCharge?'':'not '}(${vstatus} == 2 or ${vstatus} == 4) and ${newCharge?'':'not '}(status == 2 or status == 4) and ${balance} + ${old} >= ${next}`,[['vacations','v']],[['vacations',expression(vid,vowner,'days','status')]],`${balance} + ${old} - ${next}`);
  }
  rule('read_vacation','readVacation',parameters,`${readable} and ${vacation} and ${vstatus} >= 1`,[['vacations','v']],[['vacations','v'],['vacationRecord',expression(days,vstatus)]]);
  for(const [method,gate,value]of [['balance','remaining',balance],['auditCount','changes',audit],['totals','approvedMinutes',total]])rule(`read_${method}`,method,{actor:'Nat',employee:'Nat'},readable,[],[[gate,value]]);
  b.net.testIntentions=[...hrIntentions(),rosterIntention(employees)];
  b.net.satelExample={id:'hr-management-reference',name:'HR management — Reference',role:'reference',description:'Generic employee and record bindings over shared places; roster size changes only the initial marking.'};
  const net=convertOutputPlacesToGates(b.net);net.apnClass='HRManagement';
  net.places.forEach((p,i)=>{p.x=180+i*400;p.y=180});
  net.transitions.forEach((t,i)=>{t.x=200+(i%5)*300;t.y=500+Math.floor(i/5)*250});
  return net;
}
export const hrExamples=[
 {filename:'hr-management-reference',displayName:'HR management — Reference',description:'Generic employee and record tokens in four shared places; work, vacation, roles and corrections.'},
 {filename:'hr-management-expanded-reference',displayName:'HR management — Expanded benchmark',description:'Previous 432-transition employee/slot expansion, retained for comparison.'}
];
