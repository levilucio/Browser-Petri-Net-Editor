#!/usr/bin/env node
/** Functional smoke record; mixed cold/warm timings are not a benchmark. */
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHmlSelectionExample, hmlSelectionExamples } from '../../src/satel/examples/hml-selection/editor.js';
import { createNondeterminismExample, modal } from '../../src/satel/examples/nondeterminism/editor.js';
import { generateIntention } from '../../src/satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../src/satel/core/ValidatedSubuniformity.js';
import { buildHmlConstraints } from '../../src/satel/core/HmlConstraints.js';
import { parseSymbolicSource } from '../../src/satel/core/SymbolicSource.js';
import { publicInterface } from '../../src/satel/core/TestCase.js';
import { setLogLevel } from '../../src/utils/logger.js';
setLogLevel('silent');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const model = createHmlSelectionExample(), report = {
  measuredAt: new Date().toISOString(), node: process.version, baselineCommit: git('rev-parse', 'HEAD'), dirty: !!git('status', '--porcelain'),
  scope: 'functional smoke; includes solver initialization; no statistical timing claim', intentions: [],
};
const baseline = structuredClone(model.testIntentions[0]); delete baseline.branchingProperty;
const sequence = await generateIntention(baseline, model);
report.sequenceOnly = sequence.report.execution.selected[0].witnessArgs;
if (report.sequenceOnly[0] !== 1) throw new Error('Unexpected sequence baseline');
for (const intention of model.testIntentions) {
  const started = performance.now();
  const { report: selection, suite } = await generateIntention(intention, model);
  const domain = selection.execution.selected[0];
  const row = { id: intention.id, expectedAdditionalTruth: intention.branchingExpectedTruth ?? true, selected: domain.witnessArgs, staticRepresentative: domain.staticWitness.args, validation: suite.validation, selection: domain.execution, durationMs: performance.now() - started, mutants: [] };
  if (domain.witnessArgs[0] < 3 || domain.witnessArgs[0] > 5 || suite.validation.referencePassed !== 1) throw new Error('Invalid joint selection');
  for (const mutant of hmlSelectionExamples.filter(e => !e.filename.endsWith('reference'))) {
    const replay = await evaluateOracleSuite(suite.selectedTests, createHmlSelectionExample(mutant.filename), suite.interface);
    if (replay.counts.fail !== 1 || replay.counts.error) throw new Error(`Mutant not detected: ${mutant.filename}`);
    row.mutants.push({ id: mutant.filename, counts: replay.counts });
  }
  report.intentions.push(row);
}
const bag = createNondeterminismExample('nondeterminism-bag-reference');
bag.places[0].valueTokens = [...Array(10).fill(1), ...Array(10).fill(2)]; bag.places[0].tokens = 20;
const formula = Array.from({ length: 20 }).reduce(child => modal('box', 'take', null, child), modal('box', 'take', null, { op: 'false' }));
const started = performance.now();
const constraints = await buildHmlConstraints(formula, bag, publicInterface(bag), {}, {}, parseSymbolicSource(''));
report.depth20 = { ...constraints.stats, durationMs: performance.now() - started, note: 'ground-token universal constraint construction, not a general symbolic branching benchmark' };
const text = JSON.stringify(report, null, 2) + '\n';
if (process.argv[2]) writeFileSync(process.argv[2], text);
console.log(text);
