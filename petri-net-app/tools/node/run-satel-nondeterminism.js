#!/usr/bin/env node
/** Reproducible functional/performance smoke run, not a statistical benchmark. */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createNondeterminismExample, nondeterminismExamples, modal } from '../../src/satel/examples/nondeterminism/editor.js';
import { generateIntention } from '../../src/satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../src/satel/core/ValidatedSubuniformity.js';
import { evaluateFormula } from '../../src/satel/core/HmlEvaluator.js';
import { publicInterface } from '../../src/satel/core/TestCase.js';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const report = { measuredAt: new Date().toISOString(), node: process.version, sourceCommit: git('rev-parse', 'HEAD'), dirty: !!git('status', '--porcelain'), scope: 'single-process functional smoke; cold/warm timings mixed; no statistical performance claim', models: [] };
for (const family of ['bag', 'branch']) {
  const reference = createNondeterminismExample(`nondeterminism-${family}-reference`);
  const row = { family, reference: [], mutants: [] }, tests = [];
  for (const intention of reference.testIntentions) {
    const start = performance.now();
    const { suite } = await generateIntention(intention, reference);
    tests.push(...suite.selectedTests);
    row.reference.push({ intention: intention.id, expectedTruth: intention.expectedTruth, verdict: 'pass', durationMs: performance.now() - start, ...suite.selectedTests[0].referencePropertyResult.stats });
  }
  for (const entry of nondeterminismExamples.filter(e => e.filename.startsWith(`nondeterminism-${family}-`) && !e.filename.endsWith('reference'))) {
    const result = await evaluateOracleSuite(tests, createNondeterminismExample(entry.filename), publicInterface(reference));
    row.mutants.push({ id: entry.filename, counts: result.counts, properties: result.results.map(r => ({ id: r.id, verdict: r.verdict, actualTruth: r.actualTruth, ...(r.verdict === 'fail' ? { explanation: r.propertyExplanation } : {}) })) });
    if (!result.counts.fail || result.counts.error || result.counts.inconclusive) throw new Error(`Unexpected mutant result: ${entry.filename}`);
  }
  report.models.push(row);
}
const stress = createNondeterminismExample('nondeterminism-bag-reference');
stress.places[0].valueTokens = [...Array(10).fill(1), ...Array(10).fill(2)]; stress.places[0].tokens = 20;
const formula = Array.from({ length: 20 }).reduce(child => modal('box', 'take', null, child), modal('box', 'take', null, { op: 'false' }));
const result = await evaluateFormula(formula, stress, publicInterface(stress));
if (result.value !== true) throw new Error('Depth-20 property was not established');
report.depth20 = { tokenChoices: 'ten 1s and ten 2s', completeValueOrders: 184756, expectedTruth: true, ...result.stats, serializedEvidenceBytes: Buffer.byteLength(JSON.stringify(result)) };
const json = JSON.stringify(report, null, 2) + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], json);
console.log(json);
