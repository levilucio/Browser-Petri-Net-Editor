import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {root, editorRoot, editorImport} from '../experiments/runtime.mjs';
import {policy} from './trial.mjs';
const {runBlackBoxExperiment} = await editorImport('src/satel/blackbox/Campaign.js');
const {traceEvidence} = await editorImport('src/satel/blackbox/Experiments.js');
const dir = process.argv[2];
const corpus = JSON.parse(readFileSync(resolve(root,'results/corpus.json')));
const manifest = JSON.parse(readFileSync(resolve(dir,'manifest.json')));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const [p,digest] of Object.entries(manifest.hashes)) {
  const file = p === 'editor/Campaign.js' ? resolve(editorRoot,'src/satel/blackbox/Campaign.js') : resolve(root,p);
  assert.equal(sha(readFileSync(file)),digest,p);
}
const summary = [];
for (const variant of ['none','illegal-output','missing-b','early-commitment','bad-b-receipt']) {
  for (const transport of ['api','ui']) {
    const bytes = readFileSync(resolve(dir,variant+'-'+transport+'.json.gz'));
    const data = JSON.parse(gunzipSync(bytes));
    assert.equal(data.variant,variant); assert.equal(data.transport,transport); assert.equal(data.rows.length,48);
    const row = {variant,transport,trials:48,pairs:0,traceMismatches:0,automaticOpportunities:0,outcomes:{},finishAfterB:0,
      manualOpportunities:{},manualAccepted:{},aReallocationRefusals:0,hml:{},reportSha256:sha(bytes)};
    const count = (bucket,key) => bucket[key]=(bucket[key] || 0)+1;
    for (const r of data.rows) {
      const calls = r.events.map(e=>e.stimulation);
      assert.deepEqual(r.audit.methods,calls.map(c=>c.method)); assert.deepEqual(r.audit.denied,[]);
      // Verify each recorded event and verdict afresh using the fixed-path oracle.
      let cursor=0;
      const replay = await runBlackBoxExperiment({referenceNet:corpus.referenceNet,io:corpus.interface,calls,
        createSut:()=>({interface:corpus.interface,reset:async()=>{},invoke:async()=>r.events[cursor++].response})});
      assert.deepEqual(replay.events,r.events); assert.equal(replay.verdict,r.verdict);
      assert.deepEqual(calls[0],{method:'open',arguments:{}});
      for (let i=1;i<calls.length;i++) assert.deepEqual(policy(r.kind,r.events.slice(0,i)),calls[i]);
      if (r.verdict==='compatible') assert.equal(policy(r.kind,r.events),null);
      row.pairs+=calls.length; if(r.verdict==='mismatch') row.traceMismatches++;
      const open = r.events[0].response.outputs.ready[0]===true;
      const allocation = r.events.find(e=>e.stimulation.method==='allocate');
      if(open && allocation) {
        row.automaticOpportunities++;
        const value=allocation.response.outputs.allocated[0] ?? allocation.response.status;
        count(row.outcomes,value);
        if(value===2 && calls.some(c=>c.method==='finish')) row.finishAfterB++;
        if(value===1 && r.events.some(e=>e.stimulation.method==='reserve' && e.response.status==='refused')) row.aReallocationRefusals++;
      }
      if(open && r.kind!=='automatic') {
        const request = r.events.find(e=>e.stimulation.method==='reserve');
        if(request) { count(row.manualOpportunities,r.kind); if(request.response.status==='accepted')count(row.manualAccepted,r.kind); }
      }
      for(const test of corpus.selectedTests.filter(t=>(t.id==='both-choices-1')===(r.kind!=='automatic'))) {
        const verdict=traceEvidence(test.formula,r.events,corpus.interface,test.expectedTruth).verdict;
        assert.equal(r.hml[test.id],verdict); count(row.hml[test.id]??={},verdict);
      }
    }
    assert.equal(row.automaticOpportunities,32);assert.deepEqual(row.manualOpportunities,{'manual-a':8,'manual-b':8});
    summary.push(row);
  }
}
writeFileSync(resolve(dir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary.map(r=>[r.variant,r.transport,r.outcomes,r.traceMismatches,r.finishAfterB,r.manualAccepted])));
