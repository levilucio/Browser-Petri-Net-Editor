/** @jest-environment node */
import {builder} from '../../satel/examples/exercises/builder.js';
import {generateIntention} from '../../satel/core/IntentionPipeline.js';
import {selectNegativeCompanions} from '../../satel/core/NegativeSelection.js';
import {validateOracleCandidates} from '../../satel/core/ValidatedSubuniformity.js';
jest.setTimeout(60000);
async function fixture(){
 const b=builder();b.place('stock','Nat',[2]);b.place('out','Nat',[],true);
 b.rule('use','use',{n:'Nat'},'n > 0 and n <= s',[['stock','s']],[['stock','s - n'],['out','n']]);
 b.rule('special','use',{n:'Nat'},'n == 3',[],[['out','n']]);
 b.rule('inspect','inspect',{},'',[],[['out','0']]);
 const intention={id:'seed',name:'Use once',testType:'positive',variables:[],pairs:[{stimulation:{method:'use',arguments:{n:1}},observation:{outputs:{out:[1]}}}]};
 return (await generateIntention(intention,b.net)).suite;
}
const target=(suite,prefixLength,values)=>({seedId:suite.selectedTests[0].id,prefixLength,method:'use',parameterDomains:{n:values}});
test('scoped refusal after the final seed pair negates every rule and retains its admitted prefix',async()=>{
 const suite=await fixture();const targets=[target(suite,0,[1,2,3]),target(suite,1,[1,2,3])];
 const r=await selectNegativeCompanions(suite,{negativeTargets:targets});
 expect(r.attempts.map(a=>a.status)).toEqual(['no-refusal','selected']);expect(r.candidates).toHaveLength(1);
 expect(r.candidates[0].pairs[0]).toEqual(suite.selectedTests[0].pairs[0]);expect(r.candidates[0].pairs[1].stimulation.arguments.n).toBe(2);
 const tests=await validateOracleCandidates({referenceNet:suite.referenceNet,io:suite.interface,candidates:r.candidates});expect(tests[0].referenceMarkings[1]).toEqual(tests[0].referenceMarkings[2]);
 expect(r.unvisitedTargets).toBe(0);expect(r.truncated).toBe(false);
});
test('singleton domains and another method are supported; exact duplicate targets are counted',async()=>{
 const suite=await fixture(),t=target(suite,1,[2]);
 const r=await selectNegativeCompanions(suite,{negativeTargets:[t,t,{seedId:t.seedId,prefixLength:1,method:'inspect'}]});
 expect(r.candidates[0].pairs.at(-1).stimulation.arguments).toEqual({n:2});expect(r.skippedDuplicates).toBe(1);expect(r.attempts.at(-1).status).toBe('no-refusal');
});
test('limits and solver unknown preserve unresolved or unvisited targets',async()=>{
 const suite=await fixture(),targets=[target(suite,0,[1]),target(suite,1,[2])];
 const limited=await selectNegativeCompanions(suite,{negativeTargets:targets,negativeLimits:{maxAttempts:1}});
 expect(limited.truncated).toBe(true);expect(limited.unvisitedTargets).toBe(1);expect(limited.candidates).toHaveLength(0);
 const unknown=await selectNegativeCompanions(suite,{negativeTargets:[targets[1]],solve:async()=>({status:'unknown',reason:'forced'})});
 expect(unknown.unresolved).toHaveLength(1);expect(unknown.candidates).toHaveLength(0);
});
test('invalid target domains, methods and prefix positions are rejected before search',async()=>{
 const suite=await fixture(),t=target(suite,1,[2]);
 for(const invalid of [{...t,prefixLength:2},{...t,method:'missing'},{...t,parameterDomains:{n:[]}},{...t,parameterDomains:{n:[-1]}},{...t,parameterDomains:{bad:[1]}},{...t,seedId:'missing'}])await expect(selectNegativeCompanions(suite,{negativeTargets:[invalid]})).rejects.toMatchObject({code:'invalid-options'});
});
