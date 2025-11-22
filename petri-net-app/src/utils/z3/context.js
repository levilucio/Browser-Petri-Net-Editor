import { logger } from '../logger.js';

let z3InitPromise = null;

async function ensureZ3Available() {
  const isNodeJSTest = typeof process !== 'undefined' && process.env && process.env.JEST_WORKER_ID;
  if (isNodeJSTest) {
    logger.debug('Jest worker detected, skipping Z3 asset fetch');
    return;
  }
    // Worker context (no DOM): fetch and evaluate z3-built.js with embedded WASM
    if (typeof document === 'undefined') {
      if (typeof globalThis.initZ3 === 'function') return;
      const originalModule = globalThis.Module;
      try {
        const deriveBaseUrl = () => {
          try {
            const { origin, pathname } = self.location || {};
            if (!origin) return '';
            if (typeof pathname === 'string') {
              const assetsIdx = pathname.indexOf('/assets/');
              if (assetsIdx !== -1) {
                return `${origin}${pathname.slice(0, assetsIdx + 1)}`;
              }
              // Fallback to directory of current path
              const lastSlash = pathname.lastIndexOf('/');
              const dir = lastSlash >= 0 ? pathname.slice(0, lastSlash + 1) : '/';
              return `${origin}${dir}`;
            }
            return `${origin}/`;
          } catch (_) {
            return '';
          }
        };

        const baseUrl = deriveBaseUrl();
        const buildAssetUrl = (assetPath) => {
          const cleanPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
          if (!baseUrl) {
            return `/${cleanPath}`;
          }
          return `${baseUrl}${cleanPath}`;
        };

        // First load the WASM file as base64
        const wasmPath = buildAssetUrl('z3-built.wasm.base64');
        logger.debug('[Z3 worker] fetching WASM base64 from', wasmPath);
        const wasmResponse = await fetch(wasmPath);
        if (!wasmResponse.ok) throw new Error(`Failed to fetch WASM base64 from ${wasmPath}: ${wasmResponse.status}`);
        const wasmBase64 = await wasmResponse.text();

        // Create data URL for WASM
        const wasmDataUrl = `data:application/wasm;base64,${wasmBase64}`;

        const patchedModule = {
          ...(typeof originalModule === 'object' ? originalModule : {}),
          locateFile: (path) => {
            if (path.endsWith('.wasm')) {
              logger.debug('[Z3 worker] locateFile', path, '->', `${wasmDataUrl.substring(0, 50)}...`);
              return wasmDataUrl;
            }
            const resolved = buildAssetUrl(path);
            logger.debug('[Z3 worker] locateFile', path, '->', resolved);
            return resolved;
          }
        };
        globalThis.Module = patchedModule;

        const jsPath = buildAssetUrl('z3-built.js');
        const response = await fetch(jsPath);
        if (!response.ok) throw new Error(`Failed to fetch z3-built.js from ${jsPath}: ${response.status}`);
        const z3Script = await response.text();
        // Evaluate in worker global scope
        (0, eval)(z3Script);
        await new Promise(resolve => setTimeout(resolve, 20));
        if (typeof globalThis.initZ3 !== 'function') throw new Error('initZ3 not defined after eval');
        return;
      } catch (error) {
        throw new Error(`Failed to load Z3 in worker: ${error.message}`);
      } finally {
      if (typeof originalModule === 'object') {
        globalThis.Module = originalModule;
      } else {
        delete globalThis.Module;
      }
    }
  }

  // Main thread (DOM available)
  if (typeof globalThis.initZ3 === 'function') return;
  logger.debug('initZ3 not found, loading Z3 built assets...');
  await new Promise((resolve, reject) => {
    const scriptElement = document.createElement('script');
    scriptElement.src = '/z3-built.js';
    scriptElement.async = true;
    scriptElement.addEventListener('load', () => {
      if (typeof globalThis.initZ3 === 'function') {
        logger.debug('Z3 built assets loaded successfully');
        resolve();
      } else {
        reject(new Error('initZ3 function not found after loading z3-built.js'));
      }
    });
    scriptElement.addEventListener('error', (err) => {
      reject(new Error(`Failed to load z3-built.js: ${err?.message || err}`));
    });
    document.head.appendChild(scriptElement);
  });
}

export async function getContext() {
  if (!z3InitPromise) {
    z3InitPromise = (async () => {
      try {
        logger.debug('Initializing Z3 context...');
        // Always ensure Z3 assets are loaded first (skip direct WASM init that fails)
        await ensureZ3Available();

        const { init } = await import('z3-solver');
        if (!init) {
          throw new Error('Z3 init function not found. Z3-solver package may not be properly installed.');
        }

        logger.debug('Calling Z3 init...');
        const z3 = await init();
        if (!z3) {
          throw new Error('Z3 initialization failed. Check browser console for WASM loading errors.');
        }

        logger.debug('Creating Z3 context...');
        // Use a general-purpose context so both arithmetic and string theories are available
        const ctx = new z3.Context('main');
        if (!ctx) {
          throw new Error('Failed to create Z3 context.');
        }

        logger.debug('Z3 context initialized successfully');
        return { z3, ctx };
      } catch (error) {
        logger.error('Z3 initialization error:', error);

        // For browser (not test environment), try asset loading fallback
        const isNodeJSTest = typeof process !== 'undefined' && process.env && process.env.JEST_WORKER_ID;
        if (typeof document !== 'undefined' && !isNodeJSTest) {
          logger.debug('Retrying Z3 initialization with asset loading...');
          try {
            // Force asset loading
            if (typeof globalThis.initZ3 !== 'function') {
              logger.debug('initZ3 not found, loading Z3 built assets...');
              await new Promise((resolve, reject) => {
                const scriptElement = document.createElement('script');
                scriptElement.src = '/z3-built.js';
                scriptElement.async = true;
                scriptElement.addEventListener('load', () => {
                  if (typeof globalThis.initZ3 === 'function') {
                    logger.debug('Z3 built assets loaded successfully');
                    resolve();
                  } else {
                    reject(new Error('initZ3 function not found after loading z3-built.js'));
                  }
                });
                scriptElement.addEventListener('error', (err) => {
                  reject(new Error(`Failed to load z3-built.js: ${err?.message || err}`));
                });
                document.head.appendChild(scriptElement);
              });
            }

            const { init } = await import('z3-solver');
            const z3 = await init();
            const ctx = new z3.Context('main');
            logger.debug('Z3 context initialized successfully (fallback)');
            return { z3, ctx };
          } catch (fallbackError) {
            logger.error('Fallback Z3 initialization also failed:', fallbackError);
          }
        }

        // For Node.js (tests), try direct import without asset loading
        if (isNodeJSTest || typeof document === 'undefined') {
          logger.debug('Retrying Z3 initialization for Node.js...');
          try {
            const { init } = await import('z3-solver');
            const z3 = await init();
            const ctx = new z3.Context('main');
            logger.debug('Z3 context initialized successfully (Node.js)');
            return { z3, ctx };
          } catch (nodeError) {
            logger.error('Node.js Z3 initialization also failed:', nodeError);
          }
        }

        throw new Error(`initZ3 was not imported correctly. Please consult documentation on how to load Z3 in browser. Details: ${error.message}`);
      }
    })();
  }
  return z3InitPromise;
}


