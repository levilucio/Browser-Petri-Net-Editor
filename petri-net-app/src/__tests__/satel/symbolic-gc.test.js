/** @jest-environment node */
import { spawnSync } from 'node:child_process';

// Run in a child: a WASM worker crash must fail this regression, not kill Jest.
test('repeated rich symbolic derivation tolerates garbage collection during asynchronous solving', () => {
  const source = `
    import { createTypedStoreExample } from './src/satel/examples/typed-store/editor.js';
    import { deriveSymbolicIntention } from './src/satel/core/SymbolicIntention.js';
    const net = createTypedStoreExample();
    const timer = setInterval(() => global.gc(), 10);
    try {
      for (let i = 0; i < 3; i++) {
        const report = await deriveSymbolicIntention(net.testIntentions[0], net);
        if (report.candidates.length !== 5 || report.decomposition.unresolved.length || report.decomposition.overlaps.length) throw new Error('Incomplete derivation');
      }
    } finally { clearInterval(timer); }
    process.exit(0);
  `;
  const child = spawnSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', source], {
    cwd: process.cwd(), env: { ...process.env, JEST_WORKER_ID: 'gc-regression' }, encoding: 'utf8', timeout: 25000,
  });
  expect({ status: child.status, error: child.error?.message, stderr: child.stderr }).toEqual({ status: 0, error: undefined, stderr: '' });
}, 30000);
