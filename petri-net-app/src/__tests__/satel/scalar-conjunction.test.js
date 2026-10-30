/** @jest-environment node */
import {checkScalarConjunction} from '../../satel/core/ScalarConjunction.js';
import {createSymbolicSolver} from '../../satel/core/SymbolicZ3.js';
import {prepareAlgebra,deriveGenericSubdomains} from '../../satel/core/GenericSubuniformity.js';
import {parseSymbolicSource,compileSymbolicIntention} from '../../satel/core/SymbolicSource.js';
import {variablesIn} from '../../satel/core/SymbolicTerms.js';
const v=varName=>({var:varName}),op=(op,left,right)=>({op,left,right});
const q=(conditions,variables={x:'Int',y:'Nat'})=>({conditions,variables,terms:[],witness:false});
const algebra=prepareAlgebra(parseSymbolicSource(''));
jest.setTimeout(60000);
test('independent intervals, equality, reversed operands and Nat bounds are exact',()=>{
 expect(checkScalarConjunction(q([op('>=',v('x'),0),op('<',v('x'),1)]))).toEqual({status:'sat'});
 expect(checkScalarConjunction(q([op('>',v('x'),0),op('<',v('x'),1)]))).toEqual({status:'unsat'});
 expect(checkScalarConjunction(q([op('>',0,v('y'))]))).toEqual({status:'unsat'});
 expect(checkScalarConjunction(q([op('and',op('==',v('x'),2),op('<=',v('x'),1))]))).toEqual({status:'unsat'});
 expect(checkScalarConjunction(q([op('>',v('x'),Number.MAX_SAFE_INTEGER)]))).toEqual({status:'sat'});
 expect(checkScalarConjunction(q([op('==',v('s'),'\ud800😀'),op('==',v('b'),false)],{s:'String',b:'Bool'}))).toEqual({status:'sat'});
 expect(checkScalarConjunction(q([op('==',v('b'),true),op('==',v('b'),false)],{b:'Bool'}))).toEqual({status:'unsat'});
});
test('witness queries, correlations, invalid types and unsupported terms always fall back',()=>{
 const examples=[op('==',v('x'),v('y')),op('!=',v('x'),0),op('==',v('x'),1.5),op('==',v('x'),true),op('or',true,false),{call:'partial',args:[]},op('>',v('x'),Infinity)];
 for(const term of examples)expect(checkScalarConjunction(q([false,term]))).toBeNull();
 expect(checkScalarConjunction({...q([]),witness:true})).toBeNull();
 expect(checkScalarConjunction(q([op('==',v('z'),1)]))).toBeNull();
 expect(checkScalarConjunction(q([op('==',v('x'),1)],{x:'Any'}))).toBeNull();
});
test('all supported cases in a finite corpus agree with Z3 and exhaustive integer enumeration',async()=>{
 const solve=await createSymbolicSolver(algebra,{simpleScalarChecks:false});let cases=0;
 for(const sort of ['Int','Nat'])for(const lower of [-2,0,2])for(const upper of [-2,0,2])for(const lo of ['>','>='])for(const hi of ['<','<=']){
  const query=q([op(lo,v('x'),lower),op(hi,v('x'),upper)],{x:sort});
  const finite=Array.from({length:9},(_,i)=>i-4).some(n=>(sort==='Int'||n>=0)&&(lo==='>'?n>lower:n>=lower)&&(hi==='<'?n<upper:n<=upper));
  const answer=checkScalarConjunction(query);expect(answer.status).toBe(finite?'sat':'unsat');expect((await solve(query)).status).toBe(answer.status);cases++;
 }
 expect(cases).toBe(72);
});
test('adapter keeps actual witnesses in Z3, fallback and cancellation remain effective',async()=>{
 const controller=new AbortController(),solve=await createSymbolicSolver(algebra,{signal:controller.signal,simpleScalarChecks:true});
 expect((await solve(q([op('==',v('x'),2)]))).status).toBe('sat');expect(solve.scalarCheckStats.sat).toBe(1);
 const witness=await solve({...q([op('==',v('x'),2)]),terms:[v('x')],witness:true});expect(witness.bindings.get('x')).toBe(2);expect(solve.scalarCheckStats.sat).toBe(1);
 expect((await solve(q([op('==',v('x'),v('y'))]))).status).toBe('sat');expect(solve.scalarCheckStats.fallback).toBe(1);
 controller.abort();await expect(solve(q([]))).rejects.toMatchObject({code:'cancelled'});
});
test('compact region sorts preserve every referenced variable and completed regions',async()=>{
 const {goal}=compileSymbolicIntention({id:'g',name:'g',symbolic:{source:'constructor End(): T\nconstructor C(Int,T): T\noperation sum(T): Int\nrule end(): sum(End()) = 0\nrule cons(x: Int,t: T): sum(C(x,t)) = x + sum(t)',variablesText:'a: Int,b: Int',argsText:'C(a,C(b,End()))',operation:'sum',maxDepth:3}});
 const full=await deriveGenericSubdomains(goal,{compactDomainVariables:false,simpleScalarChecks:false,profileUnfolding:true});
 const small=await deriveGenericSubdomains(goal,{profileUnfolding:true});
 const logical=r=>r.domains.map(({variables,...rest})=>rest);
 expect(logical(small)).toEqual(logical(full));expect(small.unresolved).toEqual(full.unresolved);
 for(const d of small.domains){const used=variablesIn([d.patterns,d.conditions,d.resultPattern,d.goalBindings]);expect(Object.keys(d.variables).sort()).toEqual([...used].sort());}
 expect(small.unfoldingProfile.retainedDomainVariableEntries).toBeLessThan(full.unfoldingProfile.retainedDomainVariableEntries);
});
test('larger explicit branch budgets are accepted while invalid budgets and exhausted frontiers stay explicit',async()=>{
 const {goal}=compileSymbolicIntention({id:'g',name:'g',symbolic:{source:'operation f(Int): Int\nrule id(x: Int): f(x) = x',variablesText:'x: Int',argsText:'x',operation:'f',maxDepth:1}});
 expect((await deriveGenericSubdomains(goal,{maxBranches:32768})).domains).toHaveLength(1);
 for(const maxBranches of [0,-1,1.5,65537,Infinity])await expect(deriveGenericSubdomains(goal,{maxBranches})).rejects.toThrow('Branch budget');
 const recursive={...goal,algebra:parseSymbolicSource('operation f(Int): Int\nrule recur(x: Int): f(x) = f(x)')};
 expect((await deriveGenericSubdomains(recursive,{maxBranches:32768})).unresolved).toHaveLength(1);
});

test('scalar checks cannot hide malformed or ill-founded unrelated datatype declarations',async()=>{
 const ill=prepareAlgebra(parseSymbolicSource('constructor Loop(Bad): Bad'));
 const broken=JSON.parse(JSON.stringify(algebra));delete broken.constructors._AnyBool;
 for(const source of [ill,broken]){const solve=await createSymbolicSolver(source,{simpleScalarChecks:true});expect((await solve(q([true]))).status).toBe('unknown');expect(solve.scalarCheckStats.sat).toBe(0);}
});
