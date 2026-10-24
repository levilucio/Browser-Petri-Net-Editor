/** Public assets sit above Vite's source or bundled assets directory. Derive
 * from this module URL, not the worker's entry directory (which varies in dev).
 */
export function z3AssetBase(moduleUrl) {
  const url = new URL(moduleUrl);
  const source = url.pathname.lastIndexOf('/src/');
  const bundled = url.pathname.lastIndexOf('/assets/');
  const boundary = Math.max(source, bundled);
  url.pathname = boundary >= 0 ? url.pathname.slice(0, boundary + 1) : url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
  url.search = ''; url.hash = '';
  return url.href;
}

export async function loadWorkerZ3(moduleUrl) {
  if (typeof globalThis.initZ3 === 'function') return;
  const base = z3AssetBase(moduleUrl), scriptUrl = new URL('z3-built.js', base).href;
  const response = await fetch(scriptUrl);
  if (!response.ok) throw new Error(`Failed to fetch Z3 worker assets: ${response.status}`);
  // Module workers cannot importScripts. The SDK ships a classic factory.
  (0, eval)(await response.text());
  const initialize = globalThis.initZ3;
  if (typeof initialize !== 'function') throw new Error('Z3 worker factory was not loaded');
  // Emscripten's modular factory consumes its argument, not globalThis.Module.
  // Give its nested pthread the classic script URL and fetch WASM as binary.
  globalThis.initZ3 = options => initialize({
    ...options,
    locateFile: path => new URL(path, base).href,
    mainScriptUrlOrBlob: scriptUrl
  });
}
