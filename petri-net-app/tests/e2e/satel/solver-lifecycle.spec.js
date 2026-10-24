import { test, expect } from '@playwright/test';
const harness = '/tests/e2e/satel/fixtures/lifecycle.html';
test.beforeEach(async ({ page }) => {
  await page.goto(harness);
  await page.waitForFunction(() => window.satelLifecycle);
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
});
for (const surface of ['main', 'worker']) {
  for (const projected of [false, true]) {
    test(`${surface}: repeated generation, mutant replay and concurrent simulation (${projected ? 'owned' : 'shared'})`, async ({ page }, info) => {
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      const result = await page.evaluate(async ({ surface, projected }) => {
        if (surface === 'main') return window.satelLifecycle.run({ projected });
        const worker = window.satelLifecycle.worker();
        try { return await new Promise((resolve, reject) => {
          worker.onerror = e => reject(Error(e.message));
          worker.onmessage = ({ data }) => data.type === 'ERROR' ? reject(Error(data.error)) : resolve(data.result);
          worker.postMessage({ type: 'RUN', options: { projected } });
        }); } finally { worker.terminate(); }
      }, { surface, projected });
      expect(result.rows).toHaveLength(30);
      expect(result.concurrent).toEqual({ sdk: 'sat', balance: [8], queries: 24 });
      expect(result.lifetime.created).toBe(result.lifetime.deleted);
      expect(result.lifetime.peak).toBe(projected ? 1 : 0);
      expect(errors).toEqual([]);
      await info.attach('lifecycle', { body: JSON.stringify({ surface, ...result }), contentType: 'application/json' });
    });
  }
  test(`${surface}: cancellation drains native work and skips queued allocations`, async ({ page }, info) => {
    const result = await page.evaluate(async surface => {
      if (surface === 'main') {
        const controller = new AbortController();
        return window.satelLifecycle.cancel(controller.signal, () => setTimeout(() => controller.abort(), 0));
      }
      const worker = window.satelLifecycle.worker();
      try { return await new Promise((resolve, reject) => {
        worker.onerror = e => reject(Error(e.message));
        worker.onmessage = ({ data }) => {
          if (data.type === 'NATIVE_STARTED') worker.postMessage({ type: 'CANCEL' });
          else if (data.type === 'ERROR') reject(Error(data.error)); else resolve(data.result);
        };
        worker.postMessage({ type: 'CANCEL_PROBE' });
      }); } finally { worker.terminate(); }
    }, surface);
    expect(result).toEqual({ cancelled: 12, created: 1, deleted: 1 });
    await info.attach('cancellation', { body: JSON.stringify({ surface, ...result }), contentType: 'application/json' });
  });
}
test('generator worker cancels, rejects overlap, and restarts without stale success', async ({ page }, info) => {
  const messages = await page.evaluate(async () => {
    const worker = window.satelLifecycle.generator(), messages = [];
    const net = window.satelLifecycle.example('hml-adt-list-reference');
    const payload = { petriNet: net, testIntentions: Array(50).fill(net.testIntentions[0]), options: { smtPreambleProjection: true } };
    try { return await new Promise((resolve, reject) => {
      let cancelling = false;
      worker.onerror = e => reject(Error(e.message));
      worker.onmessage = ({ data }) => {
        messages.push({ type: data.type, requestId: data.requestId, code: data.payload?.code, cases: data.payload?.testCases?.length });
        if (data.type === 'PROGRESS' && !cancelling) {
          cancelling = true;
          worker.postMessage({ type: 'GENERATE', requestId: 'overlap', payload });
          worker.postMessage({ type: 'CANCEL', requestId: 'first' });
        }
        if (data.type === 'CANCELLED') worker.postMessage({ type: 'GENERATE', requestId: 'restart', payload: { ...payload, testIntentions: net.testIntentions.slice(0, 1) } });
        if (data.type === 'SUCCESS' && data.requestId === 'restart') resolve(messages);
        if (data.type === 'ERROR' && data.payload.code !== 'busy') reject(Error(data.payload.message));
      };
      worker.postMessage({ type: 'GENERATE', requestId: 'first', payload });
    }); } finally { worker.terminate(); }
  });
  expect(messages.filter(m => m.type !== 'PROGRESS')).toEqual([
    { type: 'ERROR', requestId: 'overlap', code: 'busy', cases: undefined },
    { type: 'CANCELLED', requestId: 'first', code: undefined, cases: undefined },
    { type: 'SUCCESS', requestId: 'restart', code: undefined, cases: 1 }
  ]);
  await info.attach('worker-protocol', { body: JSON.stringify(messages), contentType: 'application/json' });
});

// Separate browser runtimes do not share a queue; exercise both simultaneously.
test('main-thread simulator coexists with background generation', async ({ page }, info) => {
  const results = await page.evaluate(async () => {
    const worker = window.satelLifecycle.worker();
    try {
      const background = new Promise((resolve, reject) => {
        worker.onerror = e => reject(Error(e.message));
        worker.onmessage = ({ data }) => data.type === 'ERROR' ? reject(Error(data.error)) : resolve(data.result);
        worker.postMessage({ type: 'RUN', options: { projected: true, rounds: 3 } });
      });
      return await Promise.all([window.satelLifecycle.run({ projected: true, rounds: 3 }), background]);
    } finally { worker.terminate(); }
  });
  for (const result of results) {
    expect(result.rows).toHaveLength(9);
    expect(result.lifetime.created).toBe(result.lifetime.deleted);
    expect(result.lifetime.peak).toBe(1);
    expect(result.concurrent.balance).toEqual([8]);
  }
  await info.attach('cross-runtime', { body: JSON.stringify(results), contentType: 'application/json' });
});
