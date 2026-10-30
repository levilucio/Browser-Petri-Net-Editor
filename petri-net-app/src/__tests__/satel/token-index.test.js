/** @jest-environment node */
import { createTokenIndex } from '../../domain/apn/TokenIndex.js';
import { guardConjuncts, instantiateKnown } from '../../domain/apn/BoundGuards.js';
import { compileMethodTerm } from '../../domain/apn/MethodTerms.js';
import { enumerateMethodSuccessors, compilePublicNet, markingKey } from '../../domain/apn/PublicMethods.js';
import { valueToSymbolic } from '../../utils/builtin-values.js';
import { refusalConstraints } from '../../satel/core/RefusalConstraints.js';
import { foldGroundTerms } from '../../domain/algebra/GroundTerms.js';
import { addBuiltins } from '../../domain/algebra/BuiltinAlgebra.js';
import { createHrExample, hrPeople } from '../../satel/examples/hr/editor.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
const pair = (fst, snd) => ({ __pair__: true, fst, snd });
const algebra = addBuiltins({ constructors: {}, operations: {} });
const guard = text => guardConjuncts(compileMethodTerm(text, {x:'Pair',y:'Pair',key:'Int'}, 'Bool'));
const checks = guard('asInt(fst(x)) == key');
const entries = result => [...result].map(([i]) => i);
function model(repeated = false) {
 const values = [pair(1,10),pair(1,10),pair(1,20),pair(2,30)];
 return {mode:'algebraic',places:[{id:'bag',sort:'Pair',tokens:values.length,valueTokens:values}],
 transitions:[{id:'take',method:{name:'take',parameters:[{name:'key',sort:'Int'}]},guard:`asInt(fst(x)) == key and asInt(fst(${repeated?'x':'y'})) == key`,gates:[{gate:'picked',arguments:['asInt(snd(x))']}]}],
 gates:[{name:'picked',parameters:[{name:'value',sort:'Int'}]}],
 arcs:[{id:'a',source:'bag',target:'take',binding:'x'}, {id:'b',source:'bag',target:'take',binding:repeated?'x':'y'}]};
}
const outcomes = r => r.successors.map(s => [s.produced, markingKey(s.next),s.picks.map(p=>p.tokenIndex)]);
test.each([false,true])('all nondeterministic successors and duplicate occurrences agree (shared variable %s)', repeated => {
 const net=model(repeated),before=JSON.stringify(net);
 for(const key of [1,2,9]) {
  const fast=enumerateMethodSuccessors(net,'take',{key}), slow=enumerateMethodSuccessors(net,'take',{key},{useTokenIndex:false});
  expect(fast.complete&&slow.complete).toBe(true);expect(outcomes(fast)).toEqual(outcomes(slow));
  if(key===1)expect(fast.successors.length).toBe(repeated?1:3);
 }
 expect(JSON.stringify(net)).toBe(before);
});
test('unknown and wrong-cast token fields are retained; symbolic lookup falls back',()=>{
 const tokens=[pair(1,10),pair(2,20),pair('bad',30)].map(valueToSymbolic);
 tokens.push({ctor:'_Pair',args:[{ctor:'_AnyInt',args:[{var:'unknown'}]},{ctor:'_AnyInt',args:[40]}]});
 const index=createTokenIndex({symbolic:true,algebra});
 expect(entries(index(tokens,'x',checks,{key:1}))).toEqual([0,2,3]);
 expect(entries(index(tokens,'x',checks,{key:{var:'k'}}))).toEqual([0,1,2,3]);
 expect(entries(index(tokens,'x',checks,{key:1},false))).toEqual([0,1,2,3]);
});
test('a partial computation in an unselected field cannot be erased by indexing',()=>{
 const tokens=[{ctor:'_Pair',args:[{ctor:'_AnyInt',args:[2]},{ctor:'_AnyInt',args:[{undefined:'partial'}]}]}];
 const index=createTokenIndex({symbolic:true,algebra});
 expect(entries(index(tokens,'x',checks,{key:1}))).toEqual([0]);
});
test('cache follows fresh marking arrays, changed keys and original token order',()=>{
 const index=createTokenIndex(), a=pair(1,10), b=pair(2,20), c=pair(1,30);
 expect(entries(index([a,b,c],'x',checks,{key:1}))).toEqual([0,2]);
 expect(entries(index([b,c,a],'x',checks,{key:1}))).toEqual([1,2]);
 expect(entries(index([pair(2,10),b,c],'x',checks,{key:1}))).toEqual([2]);
});
test('concrete indexing preserves earlier partial-guard errors',()=>{
 const net=model();net.transitions[0].guard='asInt(snd(x)) > 0 and asInt(fst(x)) == key';
 net.places[0].valueTokens[0]=pair(2,'bad');
 for(const useTokenIndex of [true,false])expect(()=>enumerateMethodSuccessors(net,'take',{key:1},{useTokenIndex})).toThrow();
 const index=createTokenIndex();
 expect(entries(index([pair(2,'bad')],'x',guard(net.transitions[0].guard),{key:1}))).toEqual([0]);
});
test('unsupported predicates fall back and typed scalar keys do not collide',()=>{
 const index=createTokenIndex();
 expect(entries(index([pair(1,2),pair(2,3)],'x',guard('asInt(fst(x)) > key'),{key:1}))).toEqual([0,1]);
 const direct=[{term:{op:'==',left:{var:'x'},right:{var:'key'}},variables:['x','key']}];
 expect(entries(index([true,1,'1',false,0],'x',direct,{key:1}))).toEqual([1]);
 expect(entries(index([true,1,'1',false,0],'x',direct,{key:false}))).toEqual([3]);
});
test('index construction checks cancellation, including large initial scans',()=>{
 let checksRun=0;const index=createTokenIndex({check:()=>{if(++checksRun===3)throw Error('cancelled');}});
 expect(()=>index([pair(1,0),pair(2,0),pair(3,0)],'x',checks,{key:1})).toThrow('cancelled');
});
test.each([false,true])('universal refusal matches exhaustive enumeration (shared variable %s)',repeated=>{
 const net=model(repeated), plans=compilePublicNet(net).plans.take;
 const marking={bag:net.places[0].valueTokens.map(valueToSymbolic)};
 for(const argument of [1,2,9,{var:'symbolicKey'}]) {
  const indexed=refusalConstraints(plans,marking,{key:argument},algebra,()=>{});
  const exhaustive=refusalConstraints(plans,marking,{key:argument},algebra,()=>{},{useTokenIndex:false});
  for(const symbolicKey of [1,2,9]) {
   const truth=r=>r.conditions.map(c=>foldGroundTerms(instantiateKnown(c,{symbolicKey}),algebra)).every(c=>c===true);
   expect(truth(indexed)).toBe(truth(exhaustive));
   const key=typeof argument==='number'?argument:symbolicKey;
   expect(truth(indexed)).toBe(enumerateMethodSuccessors(net,'take',{key},{useTokenIndex:false}).successors.length===0);
  }
 }
});
jest.setTimeout(120000);
test('positive and negative HR selections preserve pairs with indexing disabled',async()=>{
 const net=createHrExample({employees:[1001],people:hrPeople().filter(p=>[1001,101,102,11,21].includes(p.id))});
 for(const i of [1,5,6]) {
  const fast=await generateIntention(net.testIntentions[i],net);
  const slow=await generateIntention(net.testIntentions[i],net,{useTokenIndex:false,maxSequenceBranches:100000});
  expect(fast.suite.selectedTests.map(t=>t.pairs)).toEqual(slow.suite.selectedTests.map(t=>t.pairs));
 }
});
