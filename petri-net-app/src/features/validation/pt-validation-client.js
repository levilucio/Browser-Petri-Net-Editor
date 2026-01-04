import { createPtValidationWorker } from '../../workers/worker-factory';

let worker = null;
let isInitialized = false;

/** @type {Map<number, {resolve: Function, reject: Function}>} */
const pendingByRunId = new Map();

function ensureWorker() {
  if (worker) return worker;
  worker = createPtValidationWorker();
  if (!worker) {
    throw new Error('PT validation worker is unavailable (unsupported environment or test mode).');
  }

  worker.onmessage = (e) => {
    const { op, payload } = e.data || {};
    try {
      if (op === 'init:ok') {
        isInitialized = true;
        return;
      }
      if (op === 'validate:done') {
        const runId = payload?.runId;
        const entry = pendingByRunId.get(runId);
        if (!entry) return;
        pendingByRunId.delete(runId);
        // Flatten the response: merge results into the top level
        const { results, ...rest } = payload || {};
        entry.resolve({ ...rest, ...results });
        return;
      }
      if (op === 'validate:error') {
        // If we don't have a run id, reject all pending requests.
        const msg = payload?.message || 'Validation failed';
        const runId = payload?.runId;
        if (typeof runId === 'number') {
          const entry = pendingByRunId.get(runId);
          if (entry) {
            pendingByRunId.delete(runId);
            entry.reject(new Error(String(msg)));
          }
          return;
        }
        for (const [, entry] of pendingByRunId) {
          entry.reject(new Error(String(msg)));
        }
        pendingByRunId.clear();
        return;
      }
    } catch (_) {
      // ignore
    }
  };

  worker.onerror = (e) => {
    const msg = e?.message || 'PT validation worker crashed';
    for (const [, entry] of pendingByRunId) {
      entry.reject(new Error(String(msg)));
    }
    pendingByRunId.clear();
  };

  return worker;
}

export async function ptValidationInit(options = {}) {
  const w = ensureWorker();
  if (isInitialized) return;
  w.postMessage({ op: 'init', payload: { indexURL: options.indexURL } });
  // The worker will respond with init:ok; we don't need to await it strictly here.
  // Validation calls will still work because the worker ensures initialization internally.
}

export async function ptValidatePnml(pnml, options = {}) {
  const w = ensureWorker();
  // Ensure init is kicked off (idempotent).
  try { await ptValidationInit({ indexURL: options.indexURL }); } catch (_) {}

  return await new Promise((resolve, reject) => {
    // The worker allocates run ids internally and echoes them back.
    // We track by run id once we receive the response.
    const tmpRunId = Math.floor(Math.random() * 1e9);
    pendingByRunId.set(tmpRunId, { resolve, reject });

    // We cannot set the worker's runId from here (worker owns it),
    // so we also accept the first validate:done if runId mismatches by re-keying.
    const originalOnMessage = w.onmessage;
    w.onmessage = (e) => {
      const { op, payload } = e.data || {};
      if (op === 'validate:done' || op === 'validate:error') {
        const actualRunId = payload?.runId;
        if (typeof actualRunId === 'number' && actualRunId !== tmpRunId && pendingByRunId.has(tmpRunId)) {
          const entry = pendingByRunId.get(tmpRunId);
          pendingByRunId.delete(tmpRunId);
          pendingByRunId.set(actualRunId, entry);
        }
      }
      if (typeof originalOnMessage === 'function') originalOnMessage(e);
    };

    w.postMessage({
      op: 'validate',
      payload: {
        pnml,
        mode: options.mode || 'exact',
        maxNodes: options.maxNodes,
        maxSteps: options.maxSteps,
        indexURL: options.indexURL,
      },
    });
  });
}

export function ptValidationCancel() {
  if (!worker) return;
  try { worker.postMessage({ op: 'cancel' }); } catch (_) {}
}

export function ptValidationDispose() {
  if (!worker) return;
  try { worker.postMessage({ op: 'dispose' }); } catch (_) {}
  try { worker.terminate?.(); } catch (_) {}
  worker = null;
  isInitialized = false;
  pendingByRunId.clear();
}

