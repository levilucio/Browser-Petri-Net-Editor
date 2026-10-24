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
  const context = value('--context', 'shared'), reuseAdapter = args.includes('--reuse-adapter');
  const order = value('--order', 'forward');
  const { z3 } = await getContext();
  let script;
  const fromString = z3.Z3.solver_from_string;
  z3.Z3.solver_from_string = (context, solver, text) => {
    script = text; return fromString(context, solver, text);
  };
  const algebra = parseSymbolicSource(''), rows = [];
  let reusable;
  let examples = solverHistoryExamples();
  if (order === 'reverse') examples.reverse();
  if (order === 'list-only') examples = examples.filter(x => x.sort === 'List');
  for (const { sort, net, formula } of examples) {
    const constraints = await buildHmlConstraints(formula, net, publicInterface(net), { x: { var: 'x' } }, { x: sort }, algebra);
    const solve = reusable || await createSymbolicSolver(algebra, { smtPreambleProjection, profileSolver: true, solverContext: context });
    if (reuseAdapter) reusable = solve;
    const started = performance.now();
    const result = await solve({ terms: [{ var: 'x' }], conditions: constraints.conditions, variables: { x: sort } });
    const row = { sort, status: result.status, reason: result.reason, ms: performance.now() - started,
      scriptChars: script.length, scriptSha256: hash(script), profile: solve.solverProfile };
    if (result.status === 'sat') {
      row.witness = symbolicToValue(result.bindings.get('x'));
      const replay = await evaluateFormula(instantiateFormula(formula, { x: row.witness }), net, publicInterface(net));
      if (replay.value !== true) throw new Error('Witness failed concrete HML replay');
      row.replay = 'pass';
    } else if (result.status !== 'unknown' || !smtPreambleProjection || context !== 'shared') {
      throw new Error(`Unexpected ${result.status} for ${sort} in ${smtPreambleProjection ? 'enabled' : 'disabled'} mode`);
    }
    rows.push(row);
  }
  console.log(JSON.stringify({ mode: smtPreambleProjection ? 'enabled' : 'disabled', context, reuseAdapter, order, rows }));
  process.exit(0);
}
const output = resolve(value('--out', '../docs/satel/performance/increment-36-solver-history.json'));
const repeats = Number(value('--runs', 3));
const cases = args.includes('--ownership') ? [
  ...[false, true].flatMap(reuseAdapter => [
    { mode: 'disabled', context: 'shared', reuseAdapter },
    { mode: 'enabled', context: 'shared', reuseAdapter },
    { mode: 'enabled', context: 'query', reuseAdapter }
  ]),
  { mode: 'disabled', context: 'query', reuseAdapter: true },
  { mode: 'enabled', context: 'query', reuseAdapter: true, order: 'reverse' },
  { mode: 'enabled', context: 'query', reuseAdapter: true, order: 'list-only' }
] : [{ mode: 'disabled', context: 'shared' }, { mode: 'enabled', context: 'shared' }];
const sourceFiles = readdirSync('src/satel', { recursive: true }).filter(p => p.endsWith('.js')).map(p => 'src/satel/' + p);
sourceFiles.push('tools/node/benchmarks/run-solver-history.js', 'src/utils/z3/context.js', 'src/utils/z3/owned-solver.js', 'src/utils/z3/async-runtime.js');
const report = { recordedAt: new Date().toISOString(), repeats,
  methodology: 'Fresh child process per configuration/trial, no solver warm-up. Explicit shared/query context ownership, adapter reuse and query order. Actual SMT scripts hashed; SAT witnesses independently validated and concretely replayed. Unknown is permitted only for the legacy shared/projected reproduction. Baseline and query-owned modes must solve every case.',
  environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length },
  sourceHashes: Object.fromEntries(sourceFiles.map(p => [p, hash(readFileSync(p))])), results: [] };
for (let trial = 0; trial < repeats; trial++) {
  for (const config of trial % 2 ? [...cases].reverse() : cases) {
    const { mode, context, reuseAdapter, order = 'forward' } = config;
    const child = spawnSync(process.execPath, [process.argv[1], '--child', '--mode', mode, '--context', context, '--order', order, ...(reuseAdapter ? ['--reuse-adapter'] : [])], { encoding: 'utf8', timeout: 30000 });
    if (child.status !== 0) throw new Error(`History trial failed: ${child.error || child.stderr}`);
    const result = JSON.parse(child.stdout.trim());
    report.results.push({ trial, ...result });
    mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`${trial} ${context}/${mode}/${reuseAdapter ? 'reused' : 'separate'}/${order}: ${result.rows.map(r => `${r.sort} ${r.status} ${r.ms.toFixed(1)}ms`).join(', ')}`);
  }
}
console.log(`Saved ${output}`);
