import { performance } from 'node:perf_hooks';
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { exerciseScenarios, exerciseExamples, createExerciseExample } from '../../src/satel/examples/exercises/editor.js';
import { deriveSymbolicIntention, admitSymbolicIntention } from '../../src/satel/core/SymbolicIntention.js';
import { evaluateOracleSuite } from '../../src/satel/core/ValidatedSubuniformity.js';
import { generatePNML } from '../../src/utils/pnml/writer.js';
import { getContext } from '../../src/utils/z3/context.js';
import { setLogLevel } from '../../src/utils/logger.js';
const args = process.argv.slice(2);
const argument = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${name}`);
  return args[index + 1];
};
const now = () => performance.now();
const ms = n => Math.round(n * 100) / 100;
const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    median: ms(sorted[Math.floor(sorted.length / 2)]),
    min: ms(sorted[0]),
    max: ms(sorted.at(-1))
  };
};
const must = (condition, message) => {
  if (!condition) throw new Error(message);
};
async function measure(net, scenario) {
  let start = now();
  const report = await deriveSymbolicIntention(net.testIntentions[0], net);
  const generateMs = now() - start;
  must(!report.encodingError && !report.decomposition.unresolved.length && !report.decomposition.overlaps.length && !report.execution?.blocked.length && !report.execution?.unresolved.length, `${scenario.id}: unresolved generation: ${JSON.stringify({
    encoding: report.encodingError,
    decomposition: report.decomposition.unresolved,
    blocked: report.execution?.blocked,
    unresolved: report.execution?.unresolved
  })}`);
  start = now();
  const suite = await admitSymbolicIntention(report, net);
  const admitMs = now() - start;
  must(suite.selectedTests.length === scenario.classes, `${scenario.id}: wrong class count`);
  must(suite.selectedTests.every(t => t.steps.length === scenario.depth), `${scenario.id}: wrong sequence depth`);
  start = now();
  const reference = await evaluateOracleSuite(suite.selectedTests, net, suite.interface);
  const replayMs = now() - start;
  must(reference.counts.pass === scenario.classes && !reference.counts.fail && !reference.counts.error, `${scenario.id}: reference replay failed`);
  const mutants = [];
  for (const mutant of scenario.mutants || []) {
    start = now();
    const run = await evaluateOracleSuite(suite.selectedTests, createExerciseExample(`exercise-${scenario.id}-${mutant.id}`), suite.interface);
    must(run.counts.fail > 0 && run.counts.error === 0, `${scenario.id}/${mutant.id}: not killed cleanly`);
    mutants.push({
      id: mutant.id,
      ms: ms(now() - start),
      ...run.counts,
      failures: run.results.filter(r => r.verdict === 'fail').map(r => ({
        id: r.id,
        step: r.step,
        reason: r.reason
      }))
    });
  }
  return {
    generateMs,
    admitMs,
    replayMs,
    mutants,
    visited: report.execution.visited,
    pruned: report.execution.pruned,
    prefixChecks: report.execution.prefixChecks,
    tests: suite.selectedTests.map(t => ({
      id: t.id,
      firstCall: t.steps[0],
      pairs: t.steps.length
    })),
    selection: report.execution.selected.map(d => ({
      id: d.id,
      policy: d.execution.representative,
      pathsTried: d.execution.pathsTried
    })),
    memoryMiB: Object.fromEntries(Object.entries(process.memoryUsage()).map(([key, value]) => [key, ms(value / 1024 ** 2)]))
  };
}
async function main() {
  setLogLevel('silent');
  const runs = Number(argument('--runs', '3'));
  if (!Number.isInteger(runs) || runs < 1 || runs > 30) throw new Error('--runs must be 1–30');
  const output = argument('--out', null),
    exportDir = argument('--export-dir', null);
  if (exportDir) {
    await mkdir(exportDir, {
      recursive: true
    });
    const {
      JSDOM
    } = await import('jsdom');
    const dom = new JSDOM();
    globalThis.document = dom.window.document;
    globalThis.XMLSerializer = dom.window.XMLSerializer;
    try {
      for (const entry of exerciseExamples) await writeFile(resolve(exportDir, `${entry.filename}.pnml`), generatePNML(createExerciseExample(entry.filename)));
    } finally {
      delete globalThis.document;
      delete globalThis.XMLSerializer;
      dom.window.close();
    }
    console.log(`Exported ${exerciseExamples.length} independently loadable PNML files to ${exportDir}`);
  }
  const start = now();
  await getContext();
  const initMs = ms(now() - start);
  const roots = ['src/satel/core', 'src/domain', 'src/satel/examples/exercises'];
  const files = ['src/utils/builtin-values.js', 'tools/node/run-satel-exercises.js',
    ...(await Promise.all(roots.map(async root => (await readdir(new URL(`../../${root}`, import.meta.url), { recursive: true }))
      .filter(path => path.endsWith('.js') && !path.includes('__tests__')).map(path => `${root}/${path}`)))).flat()];
  const sourceSha256 = Object.fromEntries(await Promise.all(files.map(async path => [path, createHash('sha256').update(await readFile(new URL(`../../${path}`, import.meta.url))).digest('hex')])));
  const result = {
    recordedAt: new Date().toISOString(),
    baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8'
    }).trim(),
    sourceSha256,
    environment: {
      node: process.version,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length
    },
    methodology: 'Serial, in-process runs after separately timed Z3 initialization. No forced GC. Generation includes algebraic decomposition and whole-sequence selection. Admission executes and checks the reference. Replay is a further frozen-suite execution. Memory is sampled after each run, not a peak or leak measurement. Numbers are descriptive, not timing gates.',
    runs,
    z3InitializationMs: initMs,
    scenarios: [],
    journalDepthSweep: []
  };
  console.log(`Z3 initialization: ${initMs} ms; ${runs} serial runs per example`);
  for (const scenario of exerciseScenarios) {
    const samples = [];
    for (let i = 0; i < runs; i++) samples.push(await measure(createExerciseExample(`exercise-${scenario.id}-reference`), scenario));
    const row = {
      id: scenario.id,
      depth: scenario.depth,
      classes: scenario.classes,
      types: scenario.types,
      generationMs: stats(samples.map(s => s.generateMs)),
      admissionMs: stats(samples.map(s => s.admitMs)),
      replayMs: stats(samples.map(s => s.replayMs)),
      tests: samples[0].tests,
      selection: samples[0].selection,
      mutations: samples[0].mutants,
      samples: samples.map(({
        tests,
        selection,
        mutants,
        ...s
      }) => ({
        ...s,
        generateMs: ms(s.generateMs),
        admitMs: ms(s.admitMs),
        replayMs: ms(s.replayMs),
        mutants: mutants.map(({
          failures,
          ...m
        }) => m)
      }))
    };
    result.scenarios.push(row);
    console.log(`${row.id.padEnd(12)} ${row.classes} classes × ${String(row.depth).padStart(2)} pairs | generation ${row.generationMs.median} ms | admission ${row.admissionMs.median} ms | replay ${row.replayMs.median} ms | 2/2 mutants killed`);
  }
  // Same model and four classes: vary only the number of record/read rounds.
  for (const depth of [2, 4, 8, 12, 16, 20]) {
    const samples = [];
    for (let i = 0; i < runs; i++) {
      const net = createExerciseExample('exercise-journal-reference');
      net.testIntentions[0].symbolic.protocolSource = net.testIntentions[0].symbolic.protocolSource.split('\n').slice(0, 3 + depth).join('\n');
      samples.push(await measure(net, {
        id: 'journal-prefix',
        depth,
        classes: 4
      }));
    }
    result.journalDepthSweep.push({
      depth,
      generationMs: stats(samples.map(s => s.generateMs)),
      admissionMs: stats(samples.map(s => s.admitMs)),
      replayMs: stats(samples.map(s => s.replayMs)),
      samples: samples.map(s => ({
        generateMs: ms(s.generateMs),
        admitMs: ms(s.admitMs),
        replayMs: ms(s.replayMs),
        visited: s.visited,
        memoryMiB: s.memoryMiB
      }))
    });
  }
  // Explicit bounded stress probe, not an extra reference or a negative test.
  // A false final acknowledgement makes every equal-token permutation infeasible.
  const net = createExerciseExample('exercise-kits-reference');
  net.testIntentions[0].symbolic.protocolSource = net.testIntentions[0].symbolic.protocolSource.replace(/pair returnParts\(\) => ack\(true\)$/, 'pair returnParts() => ack(false)');
  const limits = {
    maxSequenceBranches: 1000,
    maxSequenceTimeMs: 3000
  };
  const probeStart = now(),
    probe = await deriveSymbolicIntention(net.testIntentions[0], net, limits);
  result.lateContradictionProbe = {
    limits,
    ms: ms(now() - probeStart),
    visited: probe.execution?.visited,
    blocked: probe.execution?.blocked,
    unresolved: probe.execution?.unresolved,
    admitted: false
  };
  must(probe.execution?.blocked.length === 2 && probe.execution.unresolved.length === 0, 'Symmetry-reduced contradiction probe must disprove both classes within the budget');
  console.log(`Late-contradiction probe: ${result.lateContradictionProbe.ms} ms, ${probe.execution.visited} visited nodes, ${probe.execution.blocked.length} infeasible classes, ${probe.execution.unresolved.length} unresolved (not a mutant kill).`);
  if (output) {
    await mkdir(dirname(resolve(output)), {
      recursive: true
    });
    await writeFile(output, JSON.stringify(result, null, 2) + '\n');
    console.log(`Saved measurements to ${output}`);
  }
}
main().then(() => process.exit(0)).catch(error => {
  console.error(error.stack);
  process.exit(1);
});
