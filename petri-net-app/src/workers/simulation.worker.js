import { SimulatorCore } from '../features/simulation/simulator-core.js';
import { setZ3WorkerConfig } from '../utils/z3-remote';

let core = null;
let canceled = false;
let heartbeatId = null;
let latestProgress = { steps: 0, elapsedMs: 0 };

const tinyYield = async () => {
  try { await new Promise((res) => setTimeout(res, 0)); } catch (_) {}
  try { if (typeof requestAnimationFrame !== 'undefined') await new Promise((res) => requestAnimationFrame(() => res())); } catch (_) {}
};

self.onmessage = async (e) => {
  const { op, payload } = e.data || {};
  try {
    if (op === 'prewarm') {
      const { z3 } = payload || {};
      if (z3 && typeof z3 === 'object') { try { setZ3WorkerConfig(z3); } catch (_) {} }
      if (!core) core = new SimulatorCore();
      postMessage({ op: 'prewarm:ok' });
      return;
    }

    if (op === 'cancel') {
      canceled = true;
      postMessage({ op: 'cancel:ack' });
      if (heartbeatId) { try { clearInterval(heartbeatId); } catch (_) {} heartbeatId = null; }
      return;
    }

    if (op === 'dispose') {
      core = null; canceled = false;
      if (heartbeatId) { try { clearInterval(heartbeatId); } catch (_) {} heartbeatId = null; }
      postMessage({ op: 'dispose:ok' });
      return;
    }

    if (op === 'start') {
      canceled = false;
      const { elements, simOptions = {}, run = {}, z3 = {} } = payload || {};
      try { setZ3WorkerConfig(z3 || {}); } catch (_) {}
      if (!core) core = new SimulatorCore();

      await core.initialize(elements || {}, { netMode: simOptions.netMode || elements?.netMode });

      const now = (typeof performance !== 'undefined' && performance.now) ? () => performance.now() : () => Date.now();
      const startedAt = now();
      latestProgress = { steps: 0, elapsedMs: 0 };
      try { postMessage({ op: 'progress', payload: { steps: 0, elapsedMs: 0 } }); } catch (_) {}
      if (heartbeatId) { try { clearInterval(heartbeatId); } catch (_) {} }
      heartbeatId = setInterval(() => {
        try {
          const elapsed = now() - startedAt;
          const payload = { steps: latestProgress.steps || 0, elapsedMs: Math.max(latestProgress.elapsedMs || 0, elapsed) };
          postMessage({ op: 'progress', payload });
        } catch (_) {}
      }, 1000);
      const shouldCancel = () => canceled === true;
      const onProgress = (info) => {
        const payload = { steps: info?.steps || 0, elapsedMs: info?.elapsedMs ?? (now() - startedAt) };
        latestProgress = payload;
        postMessage({ op: 'progress', payload });
      };

      const result = await core.runToCompletion({
        mode: run.mode || 'single',
        maxSteps: run.maxSteps ?? 200000,
        timeBudgetMs: run.timeBudgetMs ?? 60000,
        yieldEvery: run.yieldEvery ?? 50,
        progressEveryMs: 1000,
        yieldEveryMs: 16,
        batchMax: run.batchMax ?? (run.mode === 'maximal' ? 64 : 0),
        onProgress,
        shouldCancel,
      });

      if (heartbeatId) { try { clearInterval(heartbeatId); } catch (_) {} heartbeatId = null; }
      postMessage({ op: 'done', payload: { canceled: shouldCancel(), elements: result || core.currentSimulator?.petriNet || null } });
      return;
    }

    postMessage({ op: 'error', payload: { message: 'unknown op' } });
  } catch (err) {
    postMessage({ op: 'error', payload: { message: String(err?.message || err) } });
  } finally {
    await tinyYield();
  }
};


