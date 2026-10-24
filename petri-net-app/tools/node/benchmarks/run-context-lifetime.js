#!/usr/bin/env node
// Native lifetime probe, isolated from the GUI and bounded to small child runs.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { cpus, platform, arch } from 'node:os';
const args = process.argv.slice(2), value = (n, d) => args.includes(n) ? args[args.indexOf(n) + 1] : d;
if (args.includes('--child')) {
  process.env.JEST_WORKER_ID = 'lifetime';
  const { getContext } = await import('../../../src/utils/z3/context.js');
  const { createSymbolicSolver } = await import('../../../src/satel/core/SymbolicZ3.js');
  const { parseSymbolicSource } = await import('../../../src/satel/core/SymbolicSource.js');
  const { setLogLevel } = await import('../../../src/utils/logger.js'); setLogLevel('silent');
  const { z3 } = await getContext(), { Z3 } = z3;
  const mode = value('--mode', 'query'), count = Number(value('--count', 150)), batch = Number(value('--batch', 1));
  let created = 0, deleted = 0, peakLive = 0;
  const live = new Set(), mk = Z3.mk_context_rc, del = Z3.del_context;
  Z3.mk_context_rc = (...args) => { const c = mk(...args); created++; live.add(c); peakLive = Math.max(peakLive, live.size); return c; };
  Z3.del_context = c => { if (!live.delete(c)) throw Error('Unowned/double context deletion'); deleted++; return del(c); };
  const solve = mode === 'sdk-context' ? null : await createSymbolicSolver(parseSymbolicSource(''), { solverContext: mode, smtPreambleProjection: true, solverQueryCache: false });
  const run = async i => {
    if (mode === 'sdk-context') {
      // Diagnostic of the discarded approach, using only public SDK wrappers.
      const ctx = new z3.Context('lifetime'); Z3.enable_concurrent_dec_ref(ctx.ptr);
      const s = new ctx.Solver();
      try { s.set('timeout', 3000); s.fromString(`(declare-const n Int) (assert (= n ${i}))`); if (await s.check() !== 'sat') throw Error('SDK control failed'); }
      finally { s.release(); }
    } else {
      const r = await solve({ terms: [{ var: 'n' }], conditions: [{ op: '==', left: { var: 'n' }, right: i }], variables: { n: 'Int' } });
      if (r.status !== 'sat' || r.bindings.get('n') !== i) throw Error('Owned/shared control failed');
    }
  };
  const points = [], started = performance.now();
  const record = completed => points.push({ completed, created, deleted, live: live.size, peakLive,
    rssMiB: process.memoryUsage().rss / 2 ** 20, peakRssMiB: process.resourceUsage().maxRSS / 1024, wasmMiB: z3.em.HEAP8.length / 2 ** 20, elapsedMs: performance.now() - started });
  record(0);
  for (let i = 0; i < count; i += batch) {
    await Promise.all(Array.from({ length: Math.min(batch, count - i) }, (_, j) => run(i + j)));
    if (mode === 'sdk-context' && global.gc) { global.gc(); await new Promise(r => setTimeout(r, 0)); }
    if ((i + batch) % 10 === 0 || i + batch >= count) record(Math.min(i + batch, count));
    if (process.memoryUsage().rss > 1600 * 2 ** 20) throw Error('Memory safety bound exceeded');
  }
  if (mode === 'query' && (live.size || created !== count || peakLive !== 1)) throw Error('Native contexts were not bounded and reclaimed');
  console.log(JSON.stringify({ mode, count, batch, forcedGc: mode === 'sdk-context', points })); process.exit(0);
}
const output = resolve(value('--out', '../docs/satel/performance/increment-37-context-lifetime.json'));
const files = ['src/satel/core/SymbolicZ3.js', 'src/utils/z3/context.js', 'src/utils/z3/owned-solver.js', 'src/utils/z3/async-runtime.js', 'tools/node/benchmarks/run-context-lifetime.js'];
const report = { recordedAt: new Date().toISOString(),
  methodology: 'Fresh child per configuration. One retained adapter, distinct integer equality queries, answer caching disabled. Query mode must allocate/delete exactly one context per backend call, with at most one live, including burst requests. SDK-context is a bounded diagnostic of the rejected wrapper-based approach, with explicit GC requests and no retained Context references; it is not a fair end-to-end speed comparison. RSS/WASM high-water memory need not shrink after native objects are freed.',
  environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length },
  sourceSha256: Object.fromEntries(files.map(f => [f, createHash('sha256').update(readFileSync(f)).digest('hex')])), results: [] };
for (const [mode, count, batch] of [['shared', 150, 1], ['query', 150, 1], ['query', 150, 15], ['sdk-context', 50, 1]]) {
  const child = spawnSync(process.execPath, ['--expose-gc', process.argv[1], '--child', '--mode', mode, '--count', String(count), '--batch', String(batch)], { encoding: 'utf8', timeout: 30000 });
  if (child.status !== 0) throw Error(child.error || child.stderr);
  const result = JSON.parse(child.stdout.trim()); report.results.push(result);
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`${mode} batch ${batch}: ${JSON.stringify(result.points.at(-1))}`);
}
