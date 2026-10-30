/** @jest-environment node */
import { createHrExample, createExpandedHrExample, hrPeople, timeId, vacationId } from '../../satel/examples/hr/editor.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { serializeMethodGateSource, parseMethodGateSource } from '../../domain/apn/MethodGateSyntax.js';
import { compilePublicNet, enumerateMethodSuccessors, markingKey } from '../../domain/apn/PublicMethods.js';
jest.setTimeout(120000);
test('large HR source round-trips the complete method/gate model',()=>{
 const net=createHrExample();expect(net.transitions).toHaveLength(21);expect(net.places).toHaveLength(4);
 const restored=parseMethodGateSource(serializeMethodGateSource(net),net);
 const semantics = n => Object.fromEntries(Object.entries(compilePublicNet(n).plans).map(([name, plans]) => [name, plans.map(p => ({
   id:p.id, guard:p.guard, ins:p.ins.map(({place,variable})=>({place,variable})), outs:p.outs,
   gates:p.gates.map(({gate,ast,args,declaration})=>({gate,ast,args,sorts:declaration.parameters.map(x=>x.sort)}))
 }))]));
 expect(semantics(restored)).toEqual(semantics(net));
 expect(restored.places.map(p=>[p.id,p.valueTokens])).toEqual(net.places.map(p=>[p.id,p.valueTokens]));
});
test('ground-guard pruning preserves selected role tests and refusal obligations',async()=>{
 const net=createHrExample({employees:[1001],people:hrPeople().filter(p=>[1001,101,102,11,21].includes(p.id))});
 for(const index of [1,5,6]){
  const fast=await generateIntention(net.testIntentions[index],net);
  const slow=await generateIntention(net.testIntentions[index],net,{pruneGroundMethodGuards:false,maxSequenceBranches:100000});
  expect(fast.suite.selectedTests.map(t=>t.pairs)).toEqual(slow.suite.selectedTests.map(t=>t.pairs));
 }
});
test('two-entry recursive work-log classes are all executable on the large model with the default branch bound',async()=>{
 const net=createHrExample();const {suite,report}=await generateIntention(net.testIntentions[0],net,{maxTimeMs:60000,maxSequenceTimeMs:120000,maxBranches:2048});
 expect(suite.selectedTests).toHaveLength(25);
 expect(report.execution.unresolved).toEqual([]);expect(report.decomposition.unresolved).toEqual([]);expect(report.decomposition.overlaps).toEqual([]);
 expect(report.execution.visited).toBeLessThan(10000);
 const kinds=suite.selectedTests.map(t=>t.pairs.filter(p=>p.stimulation.method==='logTime').map(p=>p.stimulation.arguments.kind).join(','));
 expect(new Set(kinds).size).toBe(25);
});

test('roster size, identities and slot count change only the initial marking',()=>{
 const small=createHrExample({employees:[1001],slots:1});
 const large=createHrExample({employees:hrPeople().map(p=>p.id),slots:8});
 expect(large.transitions).toEqual(small.transitions);expect(large.arcs).toEqual(small.arcs);
 expect(large.places.map(p=>[p.id,p.sort])).toEqual(small.places.map(p=>[p.id,p.sort]));
 expect(large.places.find(p=>p.id==='employees').tokens).toBe(256);
 expect(large.places.find(p=>p.id==='timeEntries').tokens).toBe(2048);
 const custom=createHrExample({employees:[777],people:[{id:777,company:9,manager:888,role:1},{id:888,company:9,manager:0,role:2},{id:999,company:9,manager:0,role:3}]});
 expect(custom.transitions).toEqual(small.transitions);
 expect(enumerateMethodSuccessors(custom,'logTime',{actor:777,employee:777,record:timeId(777),kind:2,minutes:60}).successors).toHaveLength(1);
 expect(createExpandedHrExample().transitions).toHaveLength(432);
});

test('generic and expanded references agree across interleaved employees, corrections and refusals',()=>{
 const ids=[1001,1002,101,2001];let generic=createHrExample({employees:ids}),expanded=createExpandedHrExample({employees:ids});let steps=0;
 const call=(method,args)=>{
  const g=enumerateMethodSuccessors(generic,method,args),x=enumerateMethodSuccessors(expanded,method,args);
  expect(g.complete&&x.complete).toBe(true);expect(g.successors.length).toBe(x.successors.length);expect(g.successors.length).toBeLessThanOrEqual(1);
  if(g.successors.length){expect(Object.fromEntries(generic.gates.map(p=>[p.name,g.successors[0].produced[p.name]]))).toEqual(Object.fromEntries(expanded.gates.map(p=>[p.name,x.successors[0].produced[p.name]])));generic=g.successors[0].next;expanded=x.successors[0].next;}
  steps++;
 };
 const p=(employee,actor,record)=>({actor,employee,...(record?{record}:{})});
 for(const e of ids)call('logTime',{...p(e,e,timeId(e)),kind:2,minutes:100});
 for(const e of ids)call('logTime',{...p(e,e,timeId(e,1)),kind:0,minutes:60});
 call('readTime',p(1002,1002,timeId(1001)));
 call('correctTime',{...p(1001,21,timeId(1001)),kind:0,minutes:20,status:2});
 call('decideTime',{...p(101,101,timeId(101)),approve:true});
 for(const e of [1001,1002,2001])call('decideTime',{...p(e,e===2001?201:101,timeId(e)),approve:e!==1002});
 for(const e of ids)for(const status of [1,2,3,2,2,1]){
  call('correctTime',{...p(e,e===2001?21:11,timeId(e)),kind:3,minutes:75,status});
  for(const other of ids)call('totals',p(other,other));
 }
 for(const e of ids){
  const hr=e===2001?21:11,record=vacationId(e);
  call('requestVacation',{...p(e,e,record),days:20});call('takeVacation',p(e,e,record));
  for(const status of [2,4,1,3,2,4]){call('correctVacation',{...p(e,hr,record),days:10,status});for(const other of ids)call('balance',p(other,other));}
  call('requestVacation',{...p(e,e,vacationId(e,1)),days:30});
  call('correctVacation',{...p(e,hr,vacationId(e,1)),days:30,status:2});
  call('auditCount',p(e,hr));call('readVacation',p(e,e,record));call('readTime',p(e,e,timeId(e)));
 }
 expect(steps).toBeGreaterThan(250);
});

test('concrete partial-guard pruning preserves all successors',()=>{
 let n=createHrExample({employees:[1001,1002],people:hrPeople().filter(p=>[1001,1002,101,11,21].includes(p.id))});
 const calls=[['logTime',{actor:1001,employee:1001,record:timeId(1001),kind:2,minutes:60}],['decideTime',{actor:101,employee:1001,record:timeId(1001),approve:true}],['correctTime',{actor:21,employee:1001,record:timeId(1001),kind:0,minutes:20,status:2}],['totals',{actor:1002,employee:1002}]];
 for(const [method,args]of calls){
  const fast=enumerateMethodSuccessors(n,method,args),slow=enumerateMethodSuccessors(n,method,args,{pruneBoundGuards:false,maxBindings:100000});
  const outcomes=r=>r.successors.map(s=>[s.produced,markingKey(s.next)]);
  expect(fast.complete&&slow.complete).toBe(true);expect(outcomes(fast)).toEqual(outcomes(slow));
  if(fast.successors.length)n=fast.successors[0].next;
 }
});
