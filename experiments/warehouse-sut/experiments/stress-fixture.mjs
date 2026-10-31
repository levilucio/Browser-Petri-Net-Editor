import {createWarehouseExample} from '../../../petri-net-app/src/satel/examples/warehouse/editor.js';
import {intention,cases} from '../../../petri-net-app/src/satel/examples/exercises/builder.js';
export const selectionOptions={profileSelection:true,maxSequenceTimeMs:180000,maxSequenceBranches:500000,maxSequencePairs:128};
export const derivationOptions={profileUnfolding:true,maxBranches:4096,maxTimeMs:60000};
export const configurations=[{id:'data-2',items:2,population:3,cycles:0},{id:'data-3',items:3,population:3,cycles:0},{id:'data-4',items:4,population:3,cycles:0},{id:'population-30',items:2,population:30,cycles:0},{id:'population-120',items:2,population:120,cycles:0},{id:'history-25',items:2,population:3,cycles:3},{id:'history-50',items:2,population:3,cycles:8},{id:'history-100',items:2,population:3,cycles:18}];
export const source=`constructor End(): Basket
constructor Item(Nat, Nat, Basket): Basket
operation firstFailure(Basket, Nat, Nat): Nat
operation advance(Nat): Nat
rule advance.zero(n: Nat): advance(n) = 0 if n == 0
rule advance.positive(n: Nat): advance(n) = n + 1 if n > 0
rule empty(x: Nat, y: Nat): firstFailure(End(), x, y) = 0
rule first.ok(q: Nat, rest: Basket, x: Nat, y: Nat): firstFailure(Item(101, q, rest), x, y) = advance(firstFailure(rest, x - q, y)) if q >= 1 and q <= 100 and q <= x
rule first.no(q: Nat, rest: Basket, x: Nat, y: Nat): firstFailure(Item(101, q, rest), x, y) = 1 if q >= 1 and q <= 100 and q > x
rule second.ok(q: Nat, rest: Basket, x: Nat, y: Nat): firstFailure(Item(102, q, rest), x, y) = advance(firstFailure(rest, x, y - q)) if q >= 1 and q <= 100 and q <= y
rule second.no(q: Nat, rest: Basket, x: Nat, y: Nat): firstFailure(Item(102, q, rest), x, y) = 1 if q >= 1 and q <= 100 and q > y`;
const tuple=(...xs)=>xs.length===2?`(${xs[0]}, ${xs[1]})`:`(${xs[0]}, ${tuple(...xs.slice(1))})`;
const call=(m,args,out='ack(true)')=>`pair ${m}(${Object.entries(args).map(([k,v])=>`${k}=${v}`).join(', ')}) => ${out}`;
export function stressFixture(config){
 const {items,population,cycles}=config;const orderIds=[1001,1002,2001,...Array.from({length:population-3},(_,i)=>1003+i)];const net=createWarehouseExample({orderIds,slots:4});net.testIntentions=[];
 const variables=Array.from({length:items},(_,i)=>`p${i}: Nat, q${i}: Nat`).join(', ');let basket='End()';for(let i=items-1;i>=0;i--)basket=`Item(p${i}, q${i}, ${basket})`;
 const input=`${basket}, 10, 8`;const condition=Array.from({length:items},(_,i)=>`(p${i} == 101 or p${i} == 102) and q${i} >= 1 and q${i} <= ${cycles?2:12}`).join(' and ');
 const prefix=[call('openOrder',{actor:1,order:1001}),...Array.from({length:items},(_,i)=>call('addLine',{actor:1,order:1001,line:10011+i,product:`p${i}`,warehouse:11,quantity:`q${i}`})),call('submitOrder',{actor:1,order:1001}),call('approveOrder',{actor:2,order:1001})];
 const protocols=[];
 if(cycles){
  // Four cases give exact stock expressions for each product combination.
  for(const p0 of [101,102])for(const p1 of [101,102]){
   const lines=[...prefix.map(s=>s.replaceAll('p0',String(p0)).replaceAll('p1',String(p1))),call('reservePair',{actor:3,order:1001,line:10011,line2:10012,warehouse:11,quantity:'q0',quantity2:'q1'}),call('readLine',{actor:4,order:1001,line:10011},`lineRecord(${tuple(p0,11,'q0','q0',0,0,1)})`),call('readLine',{actor:4,order:1001,line:10012},`lineRecord(${tuple(p1,11,'q1','q1',0,0,1)})`),call('readOrder',{actor:4,order:1001},`orderRecord(${tuple(3,2,'q0 + q1','q0 + q1',0,0)})`),call('auditCount',{actor:4,order:1001},'changes(6)')];
   for(let i=0;i<cycles;i++)lines.push(call('releaseLine',{actor:3,order:1001,line:10011,quantity:1}),call('readStock',{actor:4,product:p0,warehouse:11},`stockRecord(${tuple(p0===101?10:8,p0===p1?'q0 + q1 - 1':'q0 - 1')})`),call('reserveLine',{actor:3,order:1001,line:10011,quantity:1}),call('readOrder',{actor:4,order:1001},`orderRecord(${tuple(3,2,'q0 + q1','q0 + q1',0,0)})`),call('auditCount',{actor:4,order:1001},`changes(${8+2*i})`));
   protocols.push(cases('q0: Nat, q1: Nat',`Item(${p0}, q0, Item(${p1}, q1, End())), 10, 8`,'0',lines,`history_${p0}_${p1}`));
  }
 }else for(let failed=0;failed<=items;failed++){
  const lines=[...prefix];for(let i=0;i<(failed||items);i++)lines.push(call('reserveLine',{actor:3,order:1001,line:10011+i,quantity:`q${i}`},failed===i+1?'refused':'ack(true)'));
  if(!failed){for(let i=0;i<items;i++)lines.push(call('readLine',{actor:4,order:1001,line:10011+i},`lineRecord(${tuple(`p${i}`,11,`q${i}`,`q${i}`,0,0,1)})`));const sum=Array.from({length:items},(_,i)=>`q${i}`).join(' + ');lines.push(call('readOrder',{actor:4,order:1001},`orderRecord(${tuple(3,items,sum,sum,0,0)})`),call('auditCount',{actor:4,order:1001},`changes(${2*items+3})`))}
  protocols.push(cases(variables,input,String(failed),lines,`first_failure_${failed}`));
 }
 const spec=intention('warehouse-stress-'+config.id,'Warehouse stress '+config.id,source,variables,input,'firstFailure',condition,protocols.join('\n'),12);
 return {net,intention:spec};
}
export function entries(term){const a=[];while(term.ctor==='Item'){a.push(term.args.slice(0,2));term=term.args[2]}if(term.ctor!=='End')throw Error('Malformed basket');return a}
