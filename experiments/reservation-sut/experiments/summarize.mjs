import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './runtime.mjs';
const reportRoot = process.env.RESERVATION_REPORT_DIR || resolve(root, 'results');
const read = p => JSON.parse(readFileSync(resolve(reportRoot, p)));
const hash = x => createHash('sha256').update(x).digest('hex');
const variants = ['none', 'illegal-output', 'missing-b', 'early-commitment', 'bad-b-receipt'];
const baseline = read('none-api.json'), results = [], comparisons = [];
const counts = (rows, get) => rows.reduce((o, r) => { const key = get(r); o[key] = (o[key] || 0) + 1; return o; }, {});
for (const variant of variants) {
  const data = {};
  for (const transport of ['api', 'ui']) {
    const d = read(`${variant}-${transport}.json`); data[transport] = d;
    assert(d.complete); assert.deepEqual(d.sourceHashes, baseline.sourceHashes); assert.equal(d.corpusHash, baseline.corpusHash);
    assert.equal(d.ordinary.length, 96); assert.equal(d.controlled.length, 5);
    assert(d.ordinary.every(r => ['compatible', 'mismatch'].includes(r.verdict)));
    assert(d.controlled.every(r => r.complete && typeof r.value === 'boolean'));
    if (variant === 'none') { assert(d.baselinePassed); assert(d.ordinary.every(r => r.verdict === 'compatible')); assert(d.controlled.every(r => r.value)); }
    const properties = d.controlled.map(c => {
      const rows = d.ordinary.filter(r => r.testId === c.testId);
      return {id: c.testId, ordinaryTrace: counts(rows, r => r.verdict), ordinaryHml: counts(rows, r => r.propertyEvidence.verdict), controlledValue: c.value, controlledCalls: c.calls};
    });
    results.push({variant, transport, ordinaryExecutions: d.ordinary.length, ordinaryPairs: d.ordinary.reduce((n,r)=>n+r.events.length,0),
      ordinaryTrace: counts(d.ordinary, r => r.verdict), ordinaryHml: counts(d.ordinary, r => r.propertyEvidence.verdict),
      controlledProperties: counts(d.controlled, r => r.verdict), controlledCalls: d.controlled.reduce((n,r)=>n+r.calls,0), properties,
      firstTraceMismatch: d.ordinary.find(r=>r.verdict==='mismatch') ?? null,
      firstHmlCounterexample: d.ordinary.find(r=>r.propertyEvidence.verdict==='counterexample') ?? null,
      reportHash: hash(readFileSync(resolve(reportRoot, `${variant}-${transport}.json`)))});
  }
  for (let i = 0; i < data.api.ordinary.length; i++) {
    assert.deepEqual(data.api.ordinary[i].events, data.ui.ordinary[i].events);
    assert.deepEqual(data.api.ordinary[i].propertyEvidence, data.ui.ordinary[i].propertyEvidence);
    assert.equal(data.api.ordinary[i].verdict, data.ui.ordinary[i].verdict);
  }
  for (let i = 0; i < 5; i++) {
    assert.equal(data.api.controlled[i].value, data.ui.controlled[i].value);
    assert.deepEqual(data.api.controlled[i].log, data.ui.controlled[i].log);
  }
  comparisons.push({variant, matchedOrdinary: 96, matchedControlledProperties: 5, publicEventsAndControlledLogsEqual: true});
}
for (const [p,h] of Object.entries(baseline.sourceHashes)) assert.equal(hash(readFileSync(resolve(root,p))),h);
assert.equal(hash(readFileSync(resolve(root,'results/corpus.json'))), baseline.corpusHash);
const summary = {schemaVersion: 1, sourceHashes: baseline.sourceHashes, corpusHash: baseline.corpusHash, results, comparisons,
  interpretation: 'Ordinary HML evidence is per execution, never pooled to invent a state. Controlled truth is conditional on faithful checkpointing and complete enumeration of the declared binary environmental choices. Seeded runs are not IID operational samples.'};
writeFileSync(resolve(reportRoot,'summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(results.map(({variant,transport,ordinaryTrace,ordinaryHml,controlledProperties,controlledCalls})=>({variant,transport,ordinaryTrace,ordinaryHml,controlledProperties,controlledCalls})),null,2));
