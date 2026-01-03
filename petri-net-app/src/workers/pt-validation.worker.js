import { loadPyodide } from 'pyodide';

let pyodidePromise = null;
let pyodide = null;
let engineReady = false;

let interruptView = null;
let canceled = false;
let currentRunId = 0;

function tinyYield() {
  return new Promise((res) => {
    try { setTimeout(res, 0); } catch (_) { res(); }
  });
}

function computeBasePathFromWorkerUrl(urlStr) {
  // Worker script URL is typically:
  // - dev:   http://localhost:3000/src/workers/pt-validation.worker.js
  // - prod:  https://host/<base>/assets/pt-validation.worker-<hash>.js
  // We want: /<base>/ (including trailing slash).
  try {
    const u = new URL(urlStr);
    const p = u.pathname || '/';
    const pickPrefix = (marker) => {
      const idx = p.indexOf(marker);
      if (idx >= 0) return p.slice(0, idx + 1); // include trailing slash from '/.../'
      return null;
    };
    return (
      pickPrefix('/assets/') ||
      pickPrefix('/src/') ||
      p.slice(0, p.lastIndexOf('/') + 1) ||
      '/'
    );
  } catch (_) {
    return '/';
  }
}

function getSymexZipUrl() {
  const basePath = computeBasePathFromWorkerUrl(self.location?.href || '');
  const origin = self.location?.origin || '';
  // symex bundle is served from Vite public dir: <base>/py/symex_engine_pt.zip
  return new URL(`${basePath}py/symex_engine_pt.zip`, origin).toString();
}

async function ensurePyodide(indexURL) {
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = (async () => {
    pyodide = await loadPyodide({ indexURL });

    // Optional: enable interrupts for cancellation if supported.
    try {
      if (typeof SharedArrayBuffer !== 'undefined' && typeof pyodide.setInterruptBuffer === 'function') {
        const sab = new SharedArrayBuffer(4);
        interruptView = new Int32Array(sab);
        pyodide.setInterruptBuffer(interruptView);
      }
    } catch (_) {
      interruptView = null;
    }

    return pyodide;
  })();

  return pyodidePromise;
}

async function ensureEngineLoaded() {
  if (engineReady) return;
  if (!pyodide) throw new Error('Pyodide not initialized');

  // Fetch & unpack the bundled engine code.
  const zipUrl = getSymexZipUrl();
  console.log('[PT Validation Worker] Fetching symex bundle from:', zipUrl);
  const resp = await fetch(zipUrl, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`Failed to fetch symex bundle (${resp.status}): ${zipUrl}`);
  const buf = await resp.arrayBuffer();
  console.log('[PT Validation Worker] Unpacking symex bundle, size:', buf.byteLength);
  pyodide.unpackArchive(buf, 'zip', { extractDir: '/' });

  // Ensure Python can find the extracted package at /
  pyodide.runPython(`
import sys
if '/' not in sys.path:
    sys.path.insert(0, '/')
`);

  // Define a stable Python entrypoint for validation.
  // We keep everything in one helper so the JS side can call a single function.
  pyodide.runPython(`
import json
import time
from pathlib import Path

from symex_engine.petri_net.pnml_pt_parser import parse_pnml_pt
from symex_engine.petri_net.explore_pt import explore_pt, _results_json, ExploreResult, ExploreStats

def _pt_validate_pnml_to_json(pnml: str, mode: str, max_nodes: int, max_steps: int) -> str:
    # Write to a temp file because the parser expects a path.
    p = Path("/tmp/pt_validate_input.pnml")
    p.write_text(pnml, encoding="utf-8")

    t0 = time.perf_counter()
    t_parse0 = time.perf_counter()
    parsed = parse_pnml_pt(str(p))
    t_parse1 = time.perf_counter()

    t_explore0 = time.perf_counter()
    res0 = explore_pt(parsed, mode=mode, max_nodes=int(max_nodes), max_steps=int(max_steps))
    t_explore1 = time.perf_counter()
    t1 = time.perf_counter()

    res = ExploreResult(
        parsed=res0.parsed,
        graph=res0.graph,
        property_results=res0.property_results,
        stats=ExploreStats(
            mode=res0.stats.mode,
            nodes=res0.stats.nodes,
            edges=res0.stats.edges,
            truncated=res0.stats.truncated,
            max_nodes=res0.stats.max_nodes,
            max_steps=res0.stats.max_steps,
            parse_s=t_parse1 - t_parse0,
            explore_s=t_explore1 - t_explore0,
            total_s=t1 - t0,
        ),
    )

    return json.dumps(_results_json(res))
`);

  // Sanity import: fail early if bundle is broken.
  pyodide.runPython(`import symex_engine; import symex_engine.petri_net.explore_pt`);
  engineReady = true;
}

function requestCancel() {
  canceled = true;
  try {
    if (interruptView) {
      // Any non-zero value triggers KeyboardInterrupt.
      Atomics.store(interruptView, 0, 2);
    }
  } catch (_) {}
}

self.onmessage = async (e) => {
  const { op, payload } = e.data || {};

  // Default to the matching Pyodide version used by the app dependency.
  // Can be overridden by passing payload.indexURL.
  const defaultIndexURL =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PYODIDE_INDEX_URL) ||
    'https://cdn.jsdelivr.net/pyodide/v0.27.6/full/';

  try {
    if (op === 'cancel') {
      requestCancel();
      postMessage({ op: 'cancel:ack' });
      return;
    }

    if (op === 'dispose') {
      pyodide = null;
      pyodidePromise = null;
      engineReady = false;
      interruptView = null;
      canceled = false;
      postMessage({ op: 'dispose:ok' });
      return;
    }

    if (op === 'prewarm' || op === 'init') {
      const indexURL = payload?.indexURL || defaultIndexURL;
      await ensurePyodide(indexURL);
      await ensureEngineLoaded();
      postMessage({ op: 'init:ok' });
      return;
    }

    if (op === 'validate') {
      const runId = ++currentRunId;
      canceled = false;
      try { if (interruptView) Atomics.store(interruptView, 0, 0); } catch (_) {}

      const indexURL = payload?.indexURL || defaultIndexURL;
      const pnml = String(payload?.pnml || '');
      const mode = payload?.mode === 'km' ? 'km' : 'exact';
      const maxNodes = Number.isFinite(Number(payload?.maxNodes)) ? Number(payload.maxNodes) : 50_000;
      const maxSteps = Number.isFinite(Number(payload?.maxSteps)) ? Number(payload.maxSteps) : 200_000;

      await ensurePyodide(indexURL);
      await ensureEngineLoaded();

      // If canceled before start, short-circuit.
      if (canceled) {
        postMessage({ op: 'validate:done', payload: { canceled: true, runId } });
        return;
      }

      const t0 = (self.performance && performance.now) ? performance.now() : Date.now();
      // Return JSON string (avoid proxy conversions).
      const jsonStr = await pyodide.runPythonAsync(
        `_pt_validate_pnml_to_json(${JSON.stringify(pnml)}, ${JSON.stringify(mode)}, ${Math.floor(maxNodes)}, ${Math.floor(maxSteps)})`
      );
      const t1 = (self.performance && performance.now) ? performance.now() : Date.now();

      // If canceled while running, still return a canceled response.
      if (canceled) {
        postMessage({ op: 'validate:done', payload: { canceled: true, runId } });
        return;
      }

      // Guard against late results after a newer run started.
      if (runId !== currentRunId) return;

      const results = JSON.parse(String(jsonStr));
      postMessage({
        op: 'validate:done',
        payload: {
          canceled: false,
          runId,
          elapsedMs: Math.round(t1 - t0),
          results,
        },
      });
      return;
    }

    postMessage({ op: 'error', payload: { message: 'unknown op' } });
  } catch (err) {
    const message = String(err?.message || err);
    postMessage({ op: op === 'validate' ? 'validate:error' : 'error', payload: { message } });
  } finally {
    await tinyYield();
  }
};

