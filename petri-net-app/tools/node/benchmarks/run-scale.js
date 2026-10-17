#!/usr/bin/env node
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { createHash } from 'node:crypto';
const args = process.argv.slice(2), option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const repeats = Number(option('--runs', 3)), hardTimeoutMs = Number(option('--hard-timeout-ms', 30000));
const output = resolve(option('--out', '../docs/satel/performance/scaling-2026-10-17.json'));
const configs = [], add = (family, cases) => cases.forEach(c => configs.push({ family, ...c }));
add('allocation', [16, 64, 256, 1024].map(size => ({ kind: 'linear', size })));
add('allocation', [4, 8, 12, 16].flatMap(size => [false, true].map(unsat => ({ kind: 'slots', size, unsat }))));
add('invoice', [2, 4, 8, 16, 32].map(size => ({ size, nonlinear: false })));
add('invoice', [2, 4, 8, 16].map(size => ({ size, nonlinear: true })));
add('decomposition', [2, 4, 8, 16].map(depth => ({ kind: 'list', depth })));
add('decomposition', [2, 3, 4, 6].map(depth => ({ kind: 'tree', depth })));
add('fulfilment', [1, 4, 16, 64, 128].map(sites => ({ sites, policies: 8, cycles: 4, mutations: sites === 4 || sites === 16 })));
add('fulfilment', [2, 32, 64].map(policies => ({ sites: 4, policies, cycles: 4 })));
add('fulfilment', [1, 2, 6].map(cycles => ({ sites: 4, policies: 8, cycles })));
add('workers', [2, 4, 8].flatMap(workers => [2, 4, 8].map(rounds => ({ workers, rounds, audit: false, mutations: rounds === 2 }))));
add('workers', [2, 4].flatMap(workers => [2, 3, 4, 6].map(rounds => ({ workers, rounds, audit: true, mutations: rounds === 2 }))));
let selected = option('--cases', null) ? JSON.parse(readFileSync(option('--cases'), 'utf8')) : configs;
if (option('--family', null)) selected = selected.filter(c => c.family === option('--family'));
if (args.includes('--pilot')) selected = [configs[0], configs.find(c => c.family === 'invoice'), configs.find(c => c.family === 'decomposition' && c.kind === 'tree'), configs.find(c => c.family === 'fulfilment' && c.sites === 4), configs.find(c => c.family === 'workers' && c.audit && c.rounds === 2)];
const roots = ['src/satel/core', 'src/domain', 'src/satel/examples/scale', 'tools/node/benchmarks'];
const files = roots.flatMap(root => readdirSync(root, { recursive: true }).filter(p => p.endsWith('.js')).map(p => `${root}/${p}`));
const report = { recordedAt: new Date().toISOString(), baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), sourceSha256: Object.fromEntries(files.map(p => [p, createHash('sha256').update(readFileSync(p)).digest('hex')])), environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length }, methodology: 'One sequential child per configuration, repeated in-process trials after separately timed Z3 initialization and a trivial warm-up solver query. First trial has cold model caches; later trials reuse caches. SMT adapter time includes encoding, solving, extraction and independent checking. Peak RSS is process lifetime high-water including initialization, not incremental workload memory. Hard timeout kills the isolated child; completed trial records are retained. Unknown, partial and timeouts are not UNSAT or tests.', repeats, hardTimeoutMs, results: [] };
mkdirSync(dirname(output), { recursive: true }); writeFileSync(output + '.jsonl', '');
for (const [i, config] of selected.entries()) {
  const row = { config, samples: [] }, start = performance.now();
  await new Promise(resolveDone => {
    const child = spawn(process.execPath, ['tools/node/benchmarks/scale-worker.js', JSON.stringify({ ...config, repeats })], { stdio: ['ignore', 'pipe', 'pipe'] });
    let pending = '', stderr = '';
    const timeout = setTimeout(() => { row.hardTimeout = true; child.kill('SIGKILL'); }, hardTimeoutMs);
    child.stdout.on('data', chunk => {
      pending += chunk.toString(); let index;
      while ((index = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, index); pending = pending.slice(index + 1);
        try { const event = JSON.parse(line); if (event.type === 'sample') row.samples.push(event.sample); else if (event.type === 'done') { row.initializationMs = event.initializationMs; row.limits = event.limits; } } catch { /* Non-JSON library diagnostics stay out of metrics. */ }
      }
    });
    child.stderr.on('data', data => { stderr = (stderr + data).slice(-3000); });
    child.on('error', error => { row.error = error.message; });
    child.on('close', (code, signal) => { clearTimeout(timeout); row.exitCode = code; row.signal = signal; if (stderr) row.stderr = stderr; resolveDone(); });
  });
  row.processWallMs = Math.round(performance.now() - start); report.results.push(row);
  appendFileSync(output + '.jsonl', JSON.stringify(row) + '\n'); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`${i + 1}/${selected.length} ${JSON.stringify(config)}: ${row.samples.map(s => `${s.status}:${s.selectionMs ?? s.elapsedMs}ms`).join(', ')}${row.hardTimeout ? ' HARD TIMEOUT' : ''}`);
}
console.log(`Saved ${output}`);
