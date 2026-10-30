/** @jest-environment node */
import { createHrExample } from '../../satel/examples/hr/editor.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { serializeMethodGateSource, parseMethodGateSource } from '../../domain/apn/MethodGateSyntax.js';
import { compilePublicNet } from '../../domain/apn/PublicMethods.js';
jest.setTimeout(120000);
test('large HR source round-trips the complete method/gate model',()=>{
 const net=createHrExample();expect(net.transitions).toHaveLength(432);expect(net.places).toHaveLength(72);
 const restored=parseMethodGateSource(serializeMethodGateSource(net),net);
 const semantics = n => Object.fromEntries(Object.entries(compilePublicNet(n).plans).map(([name, plans]) => [name, plans.map(p => ({
   id:p.id, guard:p.guard, ins:p.ins.map(({place,variable})=>({place,variable})), outs:p.outs,
   gates:p.gates.map(({gate,ast,args,declaration})=>({gate,ast,args,sorts:declaration.parameters.map(x=>x.sort)}))
 }))]));
 expect(semantics(restored)).toEqual(semantics(net));
 expect(restored.places.map(p=>[p.id,p.valueTokens])).toEqual(net.places.map(p=>[p.id,p.valueTokens]));
});
test('ground-guard pruning preserves selected role tests and refusal obligations',async()=>{
 const net=createHrExample({employees:[1001]});
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
