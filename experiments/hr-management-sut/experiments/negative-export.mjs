import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve} from 'node:path';import assert from 'node:assert/strict';import {root,editorImport} from './runtime.mjs';import {negativeFixture} from './negative-fixture.mjs';
const {net}=negativeFixture(),m=JSON.parse(readFileSync(resolve(root,'results/negative-manifest.json')));
// Refusal is the final pair's blocked assertion; legacy whole-test inversion is unsupported.
net.testIntentions=m.tests.map(t=>({id:t.id,name:t.target||t.id,testType:'positive',variables:[],pairs:t.pairs}));
net.satelExample={id:'hr-negative-companions',name:'HR management — Generated refusals',role:'reference',description:'Frozen scoped refusal companions and their two positive controls.'};
if(process.argv.includes('--verify')){
 const {generateIntention}=await editorImport('src/satel/core/IntentionPipeline.js');
 const project=p=>({stimulation:p.stimulation,assertion:p.assertion,outputs:p.observation.outputs});
 for(const intention of net.testIntentions){
  const {suite}=await generateIntention(intention,net);assert.equal(suite.selectedTests.length,1);
  const pairs=suite.selectedTests[0].pairs;assert.deepEqual(pairs.map(project),intention.pairs.map(project));
  for(let i=0;i<pairs.length;i++)if(pairs[i].observation.scope!==intention.pairs[i].observation.scope)assert.deepEqual(Object.keys(pairs[i].observation.outputs).sort(),[...suite.interface.outputs].sort());
 }
 console.log('All exported intentions pass admission with equivalent complete observations.');
}
mkdirSync(resolve(root,'specification'),{recursive:true});const path=resolve(root,'specification/hr-negative.apn.json');writeFileSync(path,JSON.stringify(net,null,2));console.log(path);
