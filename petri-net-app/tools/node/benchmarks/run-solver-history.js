#!/usr/bin/env node
// Fresh process per trial: preserve the exact String -> List -> Pair history,
// without a warm-up query that would itself alter context allocation history.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
const args = process.argv.slice(2);
const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const hash = text => createHash('sha256').update(text).digest('hex');
if (args.includes('--child')) {
  // Reuse the normal Node test loading route, without changing solver options.
  process.env.JEST_WORKER_ID = 'solver-history';
  const { setLogLevel } = await import('../../../src/utils/logger.js'); setLogLevel('silent');
  const { createSymbolicSolver } = await import('../../../src/satel/core/SymbolicZ3.js');
  const { buildHmlConstraints } = await import('../../../src/satel/core/HmlConstraints.js');
  const { parseSymbolicSource } = await import('../../../src/satel/core/SymbolicSource.js');
  const { publicInterface } = await import('../../../src/satel/core/TestCase.js');
  const { instantiateFormula } = await import('../../../src/satel/core/HmlFormula.js');
  const { evaluateFormula } = await import('../../../src/satel/core/HmlEvaluator.js');
  const { symbolicToValue } = await import('../../../src/utils/builtin-values.js');
  const { solverHistoryExamples } = await import('../../../src/satel/examples/hml-selection/solver-history.js');
  const { getContext } = await import('../../../src/utils/z3/context.js');
  const smtPreambleProjection = value('--mode', 'disabled') === 'enabled';
  const { ctx } = await getContext();
  const Original = ctx.Solver;
  let script;
  // Observe actual parser input without changing assertion or symbol order.
  ctx.Solver = class extends Original {
    fromString(text) { script = text; return super.fromString(text); }
  };
  const algebra = parseSymbolicSource(''), rows = [];
  for (const { sort, net, formula } of solverHistoryExamples()) {
    const constraints = await buildHmlConstraints(formula, net, publicInterface(net), { x: { var: 'x' } }, { x: sort }, algebra);
    const solve = await createSymbolicSolver(algebra, { smtPreambleProjection, profileSolver: true });
    const started = performance.now();
    const result = await solve({ terms: [{ var: 'x' }], conditions: constraints.conditions, variables: { x: sort } });
    const row = { sort, status: result.status, reason: result.reason, ms: performance.now() - started,
      scriptChars: script.length, scriptSha256: hash(script), profile: solve.solverProfile };
    if (result.status === 'sat') {
      row.witness = symbolicToValue(result.bindings.get('x'));
      const replay = await evaluateFormula(instantiateFormula(formula, { x: row.witness }), net, publicInterface(net));
      if (replay.value !== true) throw new Error('Witness failed concrete HML replay');
      row.replay = 'pass';
    } else if (result.status !== 'unknown' || !smtPreambleProjection) {
      throw new Error(`Unexpected ${result.status} for ${sort} in ${smtPreambleProjection ? 'enabled' : 'disabled'} mode`);
    }
    rows.push(row);
  }
  console.log(JSON.stringify({ mode: smtPreambleProjection ? 'enabled' : 'disabled', rows }));
  process.exit(0);
}
const output = resolve(value('--out', '../docs/satel/performance/increment-36-solver-history.json'));
const repeats = Number(value('--runs', 3));
const sourceFiles = readdirSync('src/satel', { recursive: true }).filter(p => p.endsWith('.js')).map(p => 'src/satel/' + p);
sourceFiles.push('tools/node/benchmarks/run-solver-history.js');
const report = { recordedAt: new Date().toISOString(), repeats,
  methodology: 'Fresh child process per mode/trial, no solver warm-up. String -> List -> Pair APN/HML queries share the ordinary Z3 context. Actual SMT scripts hashed; SAT witnesses independently validated and concretely replayed. Unknown is unresolved, never a failed property or UNSAT. Baseline must solve all three cases.',
  environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length },
  sourceHashes: Object.fromEntries(sourceFiles.map(p => [p, hash(readFileSync(p))])), results: [] };
for (let trial = 0; trial < repeats; trial++) {
  for (const mode of trial % 2 ? ['enabled', 'disabled'] : ['disabled', 'enabled']) {
    const child = spawnSync(process.execPath, [process.argv[1], '--child', '--mode', mode], { encoding: 'utf8', timeout: 30000 });
    if (child.status !== 0) throw new Error(`History trial failed: ${child.error || child.stderr}`);
    const result = JSON.parse(child.stdout.trim());
    report.results.push({ trial, ...result });
    mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`${trial} ${mode}: ${result.rows.map(r => `${r.sort} ${r.status} ${r.ms.toFixed(1)}ms`).join(', ')}`);
  }
}
console.log(`Saved ${output}`);
