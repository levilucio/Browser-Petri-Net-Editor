import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const built = process.argv.includes('--built'), mode = built ? 'built' : 'dev';
const output = path.resolve(app, `../docs/satel/performance/increment-38-browser-${mode}.json`);
const raw = path.resolve(app, `test-results/satel-browser-${mode}.json`);
const run = spawnSync(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.satel.config.js', 'solver-lifecycle.spec.js', '--repeat-each', '3'], {
  cwd: app, stdio: 'inherit', env: { ...process.env, SATEL_BUILT: built ? '1' : '0', SATEL_BROWSER_REPORT: raw }
});
if (run.status !== 0) process.exit(run.status || 1);
const report = JSON.parse(fs.readFileSync(raw, 'utf8')), trials = [];
function visit(suites) {
  for (const suite of suites) {
    for (const spec of suite.specs || []) for (const test of spec.tests) for (const result of test.results) {
      trials.push({ title: spec.title, repeat: test.repeatEachIndex, status: result.status, durationMs: result.duration,
        evidence: result.attachments.filter(a => a.contentType === 'application/json').map(a => ({ name: a.name, data: JSON.parse(a.body ? Buffer.from(a.body, 'base64').toString() : fs.readFileSync(a.path, 'utf8')) })) });
    }
    visit(suite.suites || []);
  }
}
visit(report.suites);
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'tests/e2e/satel', 'playwright.satel.config.js', 'vite.satel-test.config.js', 'tools/node/benchmarks/run-browser-lifecycle.js'], { cwd: app, encoding: 'utf8' }).trim().split('\n').sort();
const hash = createHash('sha256'); for (const file of files) hash.update(file).update('\0').update(fs.readFileSync(path.join(app, file))).update('\0');
fs.writeFileSync(output, JSON.stringify({ recordedAt: new Date().toISOString(), mode, node: process.version, sourceFingerprint: hash.digest('hex'), sourceFiles: files, statistics: report.stats, trials }, null, 2) + '\n');
console.log(`Saved ${trials.length} browser trials to ${output}`);
