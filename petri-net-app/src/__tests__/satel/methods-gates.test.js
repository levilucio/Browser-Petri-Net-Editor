/** @jest-environment node */
import { parseMethodGateSource, serializeMethodGateSource } from '../../domain/apn/MethodGateSyntax.js';
import { compilePublicNet, enumerateMethodSuccessors, markingKey } from '../../domain/apn/PublicMethods.js';
import { getGates } from '../../domain/apn/Gates.js';
import { convertOutputPlacesToGates } from '../../domain/apn/GateMigration.js';
import { semanticFingerprint } from '../../domain/apn/SemanticNet.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { replayTest } from '../../satel/core/Replay.js';
import { evaluateFormula } from '../../satel/core/HmlEvaluator.js';
import { buildHmlConstraints } from '../../satel/core/HmlConstraints.js';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource.js';
import { evaluateGround } from '../../satel/core/SymbolicTerms.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
import { runBlackBoxExperiment } from '../../satel/blackbox/Campaign.js';
import { createOracleAccountExample } from '../../satel/examples/oracle-account/editor.js';
import { methodGateExamples, createMethodGateExample, originalMethodExample } from '../../satel/examples/methods-gates/editor.js';
import { exerciseScenarios } from '../../satel/examples/exercises/editor.js';
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator.js';
const clone = x => JSON.parse(JSON.stringify(x));
const account = () => createMethodGateExample('gates-oracle-account-reference');
jest.setTimeout(60000);
const source = `Class Store;
Interface
  Methods
    set : Int;
    get : ;
  Gates
    reply : Int Bool;
    done : ;
Body
  Places
    stored : Int;
  Initial
    stored (0);
  Axioms
    write: set n With this.done :: stored old -> stored (n);
    read: get With this.reply (v) (true) // this.done :: stored v -> stored (v);
End Store;
`;
const modality = (outputs, child = {op:'true'}) => ({ op:'diamond', stimulation:{method:'get',arguments:{}}, observation:{outputs}, child });

test('typed gates carry multi/zero arguments and never become state', async () => {
  const net = parseMethodGateSource(source), io = publicInterface(net);
  const sim = new AlgebraicSimulator(); await sim.initialize(net);
  expect((await sim.invokeMethod('set',{n:7})).produced).toMatchObject({ done:[[]],reply:[] });
  const result = await sim.invokeMethod('get',{});
  expect(result.produced).toMatchObject({reply:[[7,true]],done:[[]]});
  expect(result.state.places.map(p=>p.id)).toEqual(['stored']);
  expect(result.state.places[0].valueTokens).toEqual([7]);
  const f=modality({reply:[[0,true]],done:[[]]}, {op:'marking',markings:{stored:{equals:[0]}}});
  expect((await evaluateFormula(f,net,io)).value).toBe(true);
  const c=await buildHmlConstraints(f,net,io,{},{},parseSymbolicSource(''));
  expect(c.conditions.every(evaluateGround)).toBe(true);
  expect(await replayTest({id:'call',pairs:[{stimulation:{method:'get',arguments:{}},observation:{outputs:{reply:[[0,true]],done:[[]]},scope:'public'}}]},net,io)).toMatchObject({verdict:'pass'});
});

test('same marking with different gate outcomes remains nondeterministic', async () => {
  const net=parseMethodGateSource(source);
  net.transitions.push({...clone(net.transitions[1]),id:'readOther',gates:[{gate:'reply',arguments:['v','false']}]});
  net.arcs.push(...net.arcs.filter(a=>a.source==='read'||a.target==='read').map(a=>({...a,id:a.id+'x',source:a.source==='read'?'readOther':a.source,target:a.target==='read'?'readOther':a.target})));
  const result=enumerateMethodSuccessors(net,'get',{});
  expect(result.successors).toHaveLength(2);
  expect(new Set(result.successors.map(e=>markingKey(e.next))).size).toBe(1);
  expect((await evaluateFormula(modality({reply:[[0,false]]}),net,publicInterface(net))).value).toBe(true);
});

test.each([
 ['unknown gate',n=>n.transitions[0].gates[0].gate='absent'],
 ['wrong arity',n=>n.transitions[0].gates[0].arguments=['1']],
 ['unbound variable',n=>n.transitions[1].gates[0].arguments[0]='unknown'],
 ['wrong sort',n=>n.transitions[1].gates[0].arguments[1]='7'],
 ['duplicate declaration',n=>n.gates.push(clone(n.gates[0]))],
 ['place collision',n=>n.gates[0].name='stored'],
 ['autonomous output',n=>delete n.transitions[0].method],
])('%s fails before execution',(_,change)=>{const n=parseMethodGateSource(source);change(n);expect(()=>compilePublicNet(n)).toThrow();});

test('declaration changes invalidate compiled cache and frozen interface', async()=>{
 const n=parseMethodGateSource(source), key=semanticFingerprint(n), io=publicInterface(n);
 compilePublicNet(n);n.gates[0].parameters[1].sort='Int';
 expect(semanticFingerprint(n)).not.toBe(key);expect(()=>compilePublicNet(n)).toThrow();
 expect((await replayTest({id:'x',pairs:[{stimulation:{method:'get',arguments:{}},observation:{outputs:{}}}]},n,io)).verdict).toBe('error');
});

test('refused methods expose empty gates and cannot mutate state',async()=>{
 const n=parseMethodGateSource(source);n.transitions[1].guard='false';
 const r=await replayTest({id:'no',pairs:[{assertion:'blocked',stimulation:{method:'get',arguments:{}},observation:{outputs:{reply:[],done:[]},scope:'public'}}]},n,publicInterface(n));
 expect(r.verdict).toBe('pass');
});

test('gate names cannot be used as marking assertions',async()=>{
 const n=parseMethodGateSource(source);
 await expect(evaluateFormula({op:'marking',markings:{reply:{empty:true}}},n,publicInterface(n))).rejects.toThrow('Unknown observation place');
});

test('syntax rejects unsupported coordination rather than approximating it',()=>{
 for(const replacement of [' .. ', ' ⊕ ']) expect(()=>parseMethodGateSource(source.replace(' // ',replacement))).toThrow();
 expect(()=>parseMethodGateSource(source.replace('End Store;', 'End Other;'))).toThrow();
 expect(()=>parseMethodGateSource(source.replace('stored old ->','stored unknown old ->'))).toThrow();
});

test('strings containing separators survive source roundtrip',()=>{
 const s=source.replace('set : Int','set : String').replace('reply : Int Bool','reply : String Bool').replace('stored : Int','stored : String').replace('stored (0)','stored ("a; -> // :: With, \\\"b\\\"")');
 const n=parseMethodGateSource(s), restored=parseMethodGateSource(serializeMethodGateSource(n));
 expect(restored.places[0].valueTokens).toEqual(n.places[0].valueTokens);
});

test.each(methodGateExamples)('$filename: conversion and concrete syntax preserve executable rule plans', e=>{
 const old=originalMethodExample(e.filename), n=createMethodGateExample(e.filename), restored=parseMethodGateSource(serializeMethodGateSource(n));
 expect(n.places.every(p=>p.io_type!=='output')).toBe(true);
 expect(publicInterface(n).outputs).toEqual(publicInterface(old).outputs);
 expect(publicInterface(restored)).toEqual(publicInterface(n));
 expect(restored.places.map(p=>[p.id,p.sort,p.valueTokens])).toEqual(n.places.map(p=>[p.id,p.sort,p.valueTokens]));
 const plans=x=>Object.fromEntries(Object.entries(compilePublicNet(x).plans).map(([m,ps])=>[m,ps.map(p=>({id:p.id,guard:p.guard,outs:p.outs,gates:p.gates,ins:p.ins.map(i=>({place:i.place,variable:i.variable}))}))]));
 expect(plans(restored)).toEqual(plans(n));
});

test.each(exerciseScenarios)('$id: conversion retains selected tests and mutant verdicts',async s=>{
 const filename=`gates-exercise-${s.id}-reference`, old=originalMethodExample(filename), n=createMethodGateExample(filename);
 const before=await generateIntention(old.testIntentions[0],old), after=await generateIntention(n.testIntentions[0],n);
 expect(after.suite.validation).toEqual(before.suite.validation);
 // Solver witnesses can differ. Compare both frozen selections on both models.
 expect((await evaluateOracleSuite(before.suite.selectedTests,n,after.suite.interface)).counts.fail).toBe(0);
 expect((await evaluateOracleSuite(after.suite.selectedTests,old,before.suite.interface)).counts.fail).toBe(0);
 for(const m of s.mutants){
   const id=`gates-exercise-${s.id}-${m.id}`;
   const a=await evaluateOracleSuite(before.suite.selectedTests,originalMethodExample(id),before.suite.interface);
   const b=await evaluateOracleSuite(before.suite.selectedTests,createMethodGateExample(id),after.suite.interface);
   expect(b.counts).toEqual(a.counts);
   expect(b.results.map(r=>[r.verdict,r.step])).toEqual(a.results.map(r=>[r.verdict,r.step]));
 }
});

test.each(['string','list','pair'])('%s: joint HML selection works with gates',async type=>{
 const n=createMethodGateExample(`gates-hml-adt-${type}-reference`), result=await generateIntention(n.testIntentions[0],n);
 expect(result.suite.validation.referencePassed).toBeGreaterThan(0);
 const wrong=createMethodGateExample(`gates-hml-adt-${type}-wrong-value`);
 expect((await evaluateOracleSuite(result.suite.selectedTests,wrong,result.suite.interface)).counts.fail).toBeGreaterThan(0);
});

test('black-box responses are checked against gate argument types',async()=>{
 const n=parseMethodGateSource(source),io=publicInterface(n);
 const run=outputs=>runBlackBoxExperiment({referenceNet:n,calls:[{method:'get',arguments:{}}],createSut:()=>({interface:io,reset:async()=>{},invoke:async()=>({status:'accepted',outputs})})});
 expect((await run({reply:[[0,true]],done:[[]]})).verdict).toBe('compatible');
 expect((await run({reply:[[0,7]],done:[[]]})).verdict).toBe('error');
 expect((await run({reply:[[9,true]],done:[[]]})).verdict).toBe('mismatch');
});

test('migration retains a public output used as state under an internal name',()=>{
 const n=createOracleAccountExample('oracle-account-reference');n.testIntentions=[{formula:{op:'marking',markings:{ack:{equals:[]}}}}];
 const converted=convertOutputPlacesToGates(n);
 expect(converted.places.find(p=>p.id==='ack_state')).toBeDefined();
 expect(converted.testIntentions[0].formula.markings).toEqual({ack_state:{equals:[]}});
 const edge=enumerateMethodSuccessors(converted,'deposit',{n:4}).successors[0];
 expect(edge.produced.ack).toEqual([1]);expect(edge.next.places.find(p=>p.id==='ack_state').valueTokens).toEqual([1]);
});
