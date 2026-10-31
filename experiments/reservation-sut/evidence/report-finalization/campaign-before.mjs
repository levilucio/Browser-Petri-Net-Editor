import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, readdirSync, mkdirSync, mkdtempSync, cpSync, existsSync} from 'node:fs';
import {resolve, relative} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn, execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {root, editorImport, playwright} from './runtime.mjs';
import {adapter, control, request} from './adapters.mjs';
import {evaluateControlled} from './controlled.mjs';
const {runBlackBoxExperiment} = await editorImport('src/satel/blackbox/Campaign.js');
const {experimentsForTest, traceEvidence} = await editorImport('src/satel/blackbox/Experiments.js');
const args = process.argv.slice(2), option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const variants = option('--variants', 'none').split(',');
const corpus = JSON.parse(readFileSync(resolve(root, 'results/corpus.json')));
const hash = data => createHash('sha256').update(data).digest('hex');
function sourceFiles(dir) {
  return readdirSync(dir, {withFileTypes: true}).flatMap(e => e.name === '__pycache__' ? [] : e.isDirectory() ? sourceFiles(resolve(dir, e.name)) : [resolve(dir, e.name)]);
}
const sources = ['backend', 'frontend', 'experiments', 'specification', 'tests'].flatMap(d => sourceFiles(resolve(root, d)));
const sourceHashes = Object.fromEntries(sources.map(p => [relative(root, p), hash(readFileSync(p))]));
const corpusHash = hash(readFileSync(resolve(root, 'results/corpus.json')));
const parentCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
function preserve(report, file) {
  const dest = resolve(root, 'evidence', 'baseline-' + new Date().toISOString().replaceAll(/[:.]/g, '-'));
  mkdirSync(dest, {recursive: true});
  for (const d of ['backend', 'frontend', 'experiments', 'specification', 'tests']) cpSync(resolve(root, d), resolve(dest, 'snapshot', d), {recursive: true, filter: p => !p.includes('__pycache__')});
  cpSync(resolve(root, 'results/corpus.json'), resolve(dest, 'corpus.json'));
  cpSync(file, resolve(dest, 'failure.json'));
  writeFileSync(resolve(dest, 'README.md'), '# Preserved unexpected baseline result\n\nCaptured before correction. Initial classification unresolved.\n\nParent: `' + parentCommit + '`. Full sources and corpus included.\n\nReproduce: `node experiments/campaign.mjs --variants none`.\n');
  console.error('Preserved baseline discrepancy at', dest);
}
for (const variant of variants) {
  if (variant !== 'none') for (const transport of ['api', 'ui']) {
    const baseline = JSON.parse(readFileSync(resolve(root, `results/none-${transport}.json`)));
    assert(baseline.complete && baseline.baselinePassed);
    assert.equal(baseline.corpusHash, corpusHash); assert.deepEqual(baseline.sourceHashes, sourceHashes);
  }
  for (const transport of ['api', 'ui']) {
    const file = resolve(root, `results/${variant}-${transport}.json`);
    if (args.includes('--resume') && existsSync(file)) {
      const old = JSON.parse(readFileSync(file));
      if (old.complete && old.corpusHash === corpusHash && JSON.stringify(old.sourceHashes) === JSON.stringify(sourceHashes)) { console.log('Already complete', variant, transport); continue; }
    }
    const db = resolve(mkdtempSync(resolve(tmpdir(), 'reservation-hml-')), 'sut.sqlite3');
    const port = 8891, base = `http://127.0.0.1:${port}`;
    const server = spawn(process.env.PYTHON || 'python', [resolve(root, 'backend/app.py'), '--db', db, '--port', String(port), '--test-mode', '--variant', variant], {stdio: ['ignore', 'pipe', 'pipe']});
    let ready = false, stderr = '', browser;
    server.stdout.on('data', data => { if (data.toString().includes('Reservation SUT ready')) ready = true; });
    server.stderr.on('data', data => { stderr += data; });
    const report = {schemaVersion: 1, variant, transport, parentCommit, sourceHashes, corpusHash, complete: false, baselinePassed: false,
      runtime: {node: process.version, platform: process.platform, python: execFileSync(process.env.PYTHON || 'python', ['--version'], {encoding: 'utf8'}).trim()},
      seeds: Array.from({length: 16}, (_, i) => i + 1), ordinary: [], controlled: [], probes: {}};
    const save = () => writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
    try {
      for (let i = 0; !ready && i < 100; i++) await new Promise(r => setTimeout(r, 50));
      if (!ready) throw Error('Server startup failed: ' + stderr);
      const health = await (await fetch(base + '/api/health')).json();
      assert.equal(health.variant, variant); assert.equal(health.binaryChoicesPerCall, 1);
      if (transport === 'ui') {
        const pw = await playwright();
        browser = await pw.chromium.launch({headless: true, ...(process.env.SATEL_CHROMIUM ? {executablePath: process.env.SATEL_CHROMIUM} : {}), args: ['--no-sandbox', '--disable-dev-shm-usage']});
        report.runtime.browser = browser.version();
      }
      const page = browser ? await browser.newPage({viewport: {width: 1400, height: 1200}}) : null;
      for (const test of corpus.selectedTests) {
        const plan = experimentsForTest(test, corpus.interface);
        for (const [pathIndex, calls] of plan.paths.entries()) for (const seed of report.seeds) {
          const run = await runBlackBoxExperiment({referenceNet: corpus.referenceNet, io: corpus.interface, calls, createSut: () => adapter(base, page), seed}, {callTimeoutMs: 15000, maxTimeMs: 60000});
          const evidence = traceEvidence(plan.formula, run.events, corpus.interface, true);
          if (run.verdict === 'error') Object.assign(evidence, {value: null, verdict: 'inconclusive'});
          report.ordinary.push({...run, testId: test.id, pathIndex, propertyEvidence: evidence}); save();
          if (variant === 'none' && run.verdict !== 'compatible') { preserve(report, file); throw Error('Unexpected baseline trace; preserved before correction'); }
        }
        const result = await evaluateControlled(test.formula, adapter(base, page), base, corpus.interface);
        report.controlled.push({testId: test.id, ...result}); save();
        if (variant === 'none' && (result.value !== true || !result.complete)) { preserve(report, file); throw Error('Unexpected controlled baseline; preserved before correction'); }
        console.log(JSON.stringify({variant, transport, property: test.id, controlled: result.verdict, ordinaryRuns: report.ordinary.length}));
      }
      if (variant === 'none') {
        report.probes.budget = await evaluateControlled(corpus.selectedTests[0].formula, adapter(base, page), base, corpus.interface, {maxNodes: 1});
        assert.equal(report.probes.budget.value, null); assert.equal(report.probes.budget.verdict, 'inconclusive');
        const broken = adapter(base, page); broken.invoke = async () => { throw Error('Deliberate transport failure probe'); };
        report.probes.error = await evaluateControlled(corpus.selectedTests[0].formula, broken, base, corpus.interface);
        assert.equal(report.probes.error.value, null); assert.equal(report.probes.error.verdict, 'error');
        // Controls must require the test key, even when the service is in test mode.
        const denied = await fetch(base + '/api/testing/checkpoint', {method: 'POST', body: '{}'});
        assert.equal(denied.status, 403); report.probes.unkeyedControlStatus = denied.status;
        if (page) {
          const sut = adapter(base, page); await sut.reset({seed: 1});
          await sut.invoke({method: 'open', arguments: {}}); await sut.invoke({method: 'reserve', arguments: {warehouse: 2}});
          await sut.invoke({method: 'finish', arguments: {}});
          await page.screenshot({path: resolve(root, 'results/app-desktop.png'), fullPage: true});
          await page.setViewportSize({width: 390, height: 844});
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          await page.screenshot({path: resolve(root, 'results/app-mobile.png'), fullPage: true});
        }
        report.baselinePassed = true;
      }
      report.complete = true; save();
    } catch (error) { report.error = error.message; report.stderr = stderr; save(); throw error; }
    finally { await browser?.close(); if (server.exitCode === null) { server.kill(); await new Promise(r => server.once('close', r)); } }
  }
}
