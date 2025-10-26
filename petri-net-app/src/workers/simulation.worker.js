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

      await core.initialize(elements || {}, { netMode: simOptions.netMode || elements?.netMode, maxTokens: simOptions.maxTokens || 20 });

      const now = (typeof performance !== 'undefined' && performance.now) ? () => performance.now() : () => Date.now();
      const startedAt = now();
      const shouldCancel = () => canceled === true;
      const onProgress = (info) => { postMessage({ op: 'progress', payload: { steps: info?.steps || 0, elapsedMs: info?.elapsedMs ?? (now() - startedAt) } }); };

      const result = await core.runToCompletion({
        mode: run.mode || 'single',
        maxSteps: run.maxSteps ?? 200000,
        timeBudgetMs: run.timeBudgetMs ?? 60000,
        yieldEvery: run.yieldEvery ?? 50,
        batchMax: run.batchMax ?? (run.mode === 'maximal' ? 64 : 0),
        onProgress,
        shouldCancel,
      });

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


