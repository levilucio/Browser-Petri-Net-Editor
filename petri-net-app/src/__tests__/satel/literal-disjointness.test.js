/** @jest-environment node */
import { literalRegionFields, literalFieldsDisjoint } from '../../satel/core/LiteralDisjointness.js';
import { deriveGenericSubdomains,prepareAlgebra } from '../../satel/core/GenericSubuniformity.js';
import { createSymbolicSolver } from '../../satel/core/SymbolicZ3.js';
import { parseSymbolicSource,compileSymbolicIntention } from '../../satel/core/SymbolicSource.js';
const v=varName=>({var:varName}),eq=(left,right)=>({op:'==',left,right}),c=(ctor,...args)=>({ctor,args});
const algebra=prepareAlgebra(parseSymbolicSource('constructor Box(Int, Int): T\nconstructor Other(Int, Int): T'));
const region=(patterns,conditions=[])=>({patterns,conditions});
const disjoint=(a,b)=>literalFieldsDisjoint(literalRegionFields(a,algebra),literalRegionFields(b,algebra));
jest.setTimeout(60000);
test('only known scalar requirements at the same input field prove disjointness',()=>{
 expect(disjoint(region([c('Box',v('x'),0)],[eq(v('x'),1)]),region([c('Box',v('z'),0)],[eq(2,v('z'))]))).toBe(true);
 expect(disjoint(region([1]),region([2]))).toBe(true);
 expect(disjoint(region([v('x')],[eq(v('hidden'),1)]),region([v('x')],[eq(v('hidden'),2)]))).toBe(false);
 expect(disjoint(region([c('Box',v('x'),v('y'))],[eq(v('x'),1)]),region([c('Box',v('y'),v('x'))],[eq(v('x'),2)]))).toBe(false);
 expect(disjoint(region([c('Box',v('x'),0)],[eq(v('x'),1)]),region([c('Other',v('x'),0)],[eq(v('x'),2)]))).toBe(false);
});
test('disjunctions, non-injective expressions, result values and unknown constructors are opaque',()=>{
 const square={op:'*',left:v('x'),right:v('x')};
 expect(disjoint(region([square],[eq(v('x'),1)]),region([square],[eq(v('x'),-1)]))).toBe(false);
 expect(disjoint(region([v('x')],[{op:'or',left:eq(v('x'),1),right:eq(v('x'),2)}]),region([v('x')],[eq(v('x'),2)]))).toBe(false);
 expect(disjoint({...region([v('x')]),resultPattern:1},{...region([v('x')]),resultPattern:2})).toBe(false);
 expect(disjoint(region([c('unknown',1)]),region([c('unknown',2)]))).toBe(false);
 expect(disjoint(region([c('toString',1)]),region([c('toString',2)]))).toBe(false);
 expect(disjoint(region([c('Box',1)]),region([c('Box',2)]))).toBe(false);
});
test('each certificate in a finite corpus is independently UNSAT in the SMT solver',async()=>{
 const solve=await createSymbolicSolver(algebra);let proved=0;
 for(const left of [region([c('Box',v('x'),v('y'))],[eq(v('x'),1)]),region([c('Box',v('x'),v('y'))],[eq(v('y'),2)]),region([c('Box',0,0)])])
 for(const right of [region([c('Box',v('a'),v('b'))],[eq(v('a'),2)]),region([c('Box',v('a'),v('b'))],[eq(v('b'),1)]),region([c('Box',1,1)])])if(disjoint(left,right)){
  const answer=await solve({terms:[left.patterns,right.patterns],conditions:[...left.conditions,...right.conditions,eq(left.patterns[0],right.patterns[0])],variables:{x:'Int',y:'Int',a:'Int',b:'Int'},witness:false});
  expect(answer.status).toBe('unsat');proved++;
 }
 expect(proved).toBeGreaterThan(3);
});
const intention={id:'literal',name:'literal',symbolic:{source:'operation classify(Int): Int\nrule zero(x: Int): classify(x) = 0 if x == 0\nrule one(x: Int): classify(x) = 1 if x == 1',operation:'classify',variablesText:'n: Int',argsText:'n',maxDepth:1}};
test('enabled and disabled certificates preserve regions, representatives and overlap obligations',async()=>{
 const {goal}=compileSymbolicIntention(intention),solve=await createSymbolicSolver(goal.algebra);
 const slow=await deriveGenericSubdomains(goal,{solve,literalDisjointness:false,profileUnfolding:true});
 const fast=await deriveGenericSubdomains(goal,{solve,profileUnfolding:true});
 expect(fast.domains).toEqual(slow.domains);expect(fast.overlaps).toEqual(slow.overlaps);expect(fast.unresolved).toEqual(slow.unresolved);
 expect(fast.unfoldingProfile.literalDisjointPairs).toBe(1);expect(fast.unfoldingProfile.overlapQueries).toBe(0);expect(slow.unfoldingProfile.overlapQueries).toBe(1);
});
test('expired overlap obligations remain explicit unknowns without solver query construction',async()=>{
 const {goal}=compileSymbolicIntention(intention),backend=await createSymbolicSolver(goal.algebra);let leaves=0,now=0;
 const clock=jest.spyOn(Date,'now').mockImplementation(()=>now);
 try{
  const result=await deriveGenericSubdomains(goal,{maxTimeMs:100,profileUnfolding:true,solve:async q=>{const r=await backend(q);if(q.witness&&++leaves===2)now=1000;return r;}});
  expect(result.domains).toHaveLength(2);expect(result.overlaps).toEqual([{left:'one',right:'zero',status:'unknown',reason:'Total derivation time budget exhausted'}]);
  expect(result.disjoint).toBe(false);expect(result.unfoldingProfile.deadlineOverlapPairs).toBe(1);expect(result.unfoldingProfile.overlapQueries).toBe(0);
 }finally{clock.mockRestore();}
});
