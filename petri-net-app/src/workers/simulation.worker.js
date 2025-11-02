import { SimulatorCore } from '../features/simulation/simulator-core.js';
import { setZ3WorkerConfig } from '../utils/z3-remote';

let core = null;
let canceled = false;

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
      return;
    }

    if (op === 'dispose') {
      core = null; canceled = false;
      postMessage({ op: 'dispose:ok' });
      return;
    }

    if (op === 'start') {
      canceled = false;
      const { elements, simOptions = {}, run = {}, z3 = {} } = payload || {};
      try { setZ3WorkerConfig(z3 || {}); } catch (_) {}
      if (!core) core = new SimulatorCore();

      await core.initialize(elements || {}, { netMode: simOptions.netMode || elements?.netMode });

      const shouldCancel = () => canceled === true;
      const onProgress = () => {
        // Silent - no progress reporting to frontend
      };

      // Track timing for completion stats
      const startTime = performance.now ? performance.now() : Date.now();

      const result = await core.runToCompletion({
        mode: run.mode || 'single',
        maxSteps: run.maxSteps ?? 200000,
        timeBudgetMs: run.timeBudgetMs ?? 0,
        yieldEvery: run.yieldEvery ?? 5000,
        progressEveryMs: run.progressEveryMs ?? 0,
        yieldEveryMs: run.yieldEveryMs ?? 0,
        batchMax: run.batchMax ?? 0,
        onProgress,
        shouldCancel,
      });

      const endTime = performance.now ? performance.now() : Date.now();
      const elapsedMs = Math.round(endTime - startTime);

      postMessage({
        op: 'done',
        payload: {
          canceled: shouldCancel(),
          elements: result?.petriNet || core.currentSimulator?.petriNet || null,
          stats: { elapsedMs, steps: result?.steps || 0 }
        }
      });
      return;
    }

    postMessage({ op: 'error', payload: { message: 'unknown op' } });
  } catch (err) {
    postMessage({ op: 'error', payload: { message: String(err?.message || err) } });
  } finally {
    await tinyYield();
  }
};


