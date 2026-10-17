import { performance } from 'node:perf_hooks';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateIntention } from '../../src/satel/core/IntentionPipeline.js';
import { selectNegativeCompanions } from '../../src/satel/core/NegativeSelection.js';
import { validateOracleCandidates, evaluateOracleSuite } from '../../src/satel/core/ValidatedSubuniformity.js';
import { exerciseScenarios, createExerciseExample } from '../../src/satel/examples/exercises/editor.js';
import { createRefusalExample } from '../../src/satel/examples/refusal/editor.js';
import { setLogLevel } from '../../src/utils/logger.js';
import { getContext } from '../../src/utils/z3/context.js';
const ms = value => Math.round(value * 100) / 100;
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
async function main() {
  setLogLevel('silent');
  await getContext();
  const records = [];
  for (const scenario of exerciseScenarios) {
    const net = createExerciseExample(`exercise-${scenario.id}-reference`);
    let start = performance.now();
    const { suite } = await generateIntention(net.testIntentions[0], net);
    const positiveMs = ms(performance.now() - start);
    start = performance.now();
    const selection = await selectNegativeCompanions(suite);
    const selectMs = ms(performance.now() - start);
    start = performance.now();
    const negatives = selection.candidates.length ? await validateOracleCandidates({ referenceNet: net, io: suite.interface, candidates: selection.candidates }) : [];
    const admissionMs = ms(performance.now() - start);
    const tests = [...suite.selectedTests, ...negatives];
    const reference = await evaluateOracleSuite(tests, net, suite.interface);
    requireThat(!reference.counts.fail && !reference.counts.error, `${scenario.id}: reference failure`);
    const mutants = [];
    for (const mutant of scenario.mutants) {
      const run = await evaluateOracleSuite(tests, createExerciseExample(`exercise-${scenario.id}-${mutant.id}`), suite.interface);
      requireThat(run.counts.fail > 0, `${scenario.id}/${mutant.id}: no detected behavioral fault`);
      mutants.push({ id: mutant.id, ...run.counts, errors: run.results.filter(r => r.verdict === 'error').map(r => ({ id: r.id, reason: r.reason })) });
    }
    records.push({ id: scenario.id, depth: scenario.depth, positiveTests: suite.selectedTests.length, negativeTests: negatives.length,
      positiveMs, negativeSelectionMs: selectMs, negativeAdmissionMs: admissionMs,
      attempts: selection.attempts.length, visits: selection.visited, truncated: selection.truncated,
      unresolved: selection.unresolved, limits: selection.limits, reference: reference.counts, mutants,
      negatives: negatives.map(t => ({ id: t.id, pairs: t.pairs.length, finalCall: t.pairs.at(-1).stimulation })) });
  }
  const extraMutants = [];
  for (const name of ['quota', 'thermostat']) {
    const net = createRefusalExample(`refusal-${name}-reference`), mutant = createRefusalExample(`refusal-${name}-mutant`);
    const negative = await generateIntention(net.testIntentions[0], net), positive = await generateIntention(net.testIntentions[1], net);
    const refused = (await evaluateOracleSuite(negative.suite.selectedTests, mutant, negative.suite.interface)).counts;
    const accepted = (await evaluateOracleSuite(positive.suite.selectedTests, mutant, positive.suite.interface)).counts;
    requireThat(refused.fail > 0 && !refused.error && !accepted.fail && !accepted.error, `${name}: expected additional mutation detection`);
    extraMutants.push({ name, positive: accepted, refusal: refused });
  }
  const output = { generatedAt: new Date().toISOString(), node: process.version,
    sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    method: 'Single sequential smoke run, shared warmed Z3 context; not a statistical benchmark or a before/after comparison.', records, extraMutants };
  const path = process.argv[2];
  if (path) { await mkdir(dirname(resolve(path)), { recursive: true }); await writeFile(path, JSON.stringify(output, null, 2) + '\n'); }
  console.log(JSON.stringify(output, null, 2));
}
main().then(() => process.exit(0), error => { console.error(error); process.exit(1); });
