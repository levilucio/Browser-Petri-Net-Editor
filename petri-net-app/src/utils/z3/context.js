let z3InitPromise = null;

async function ensureZ3Available() {
  // Worker context (no DOM): fetch and evaluate z3-built.js with embedded WASM
  if (typeof document === 'undefined') {
    if (typeof globalThis.initZ3 === 'function') return;
    const originalModule = globalThis.Module;
    try {
      // First load the WASM file as base64
      const wasmResponse = await fetch('/z3-built.wasm.base64');
      if (!wasmResponse.ok) throw new Error(`Failed to fetch WASM base64: ${wasmResponse.status}`);
      const wasmBase64 = await wasmResponse.text();

      // Create data URL for WASM
      const wasmDataUrl = `data:application/wasm;base64,${wasmBase64}`;

      const patchedModule = {
        ...(typeof originalModule === 'object' ? originalModule : {}),
        locateFile: (path) => {
          if (path.endsWith('.wasm')) {
            try { console.log('[Z3 worker] locateFile', path, '->', wasmDataUrl.substring(0, 50) + '...'); } catch (_) {}
            return wasmDataUrl;
          }
          const resolved = `/${path}`;
          try { console.log('[Z3 worker] locateFile', path, '->', resolved); } catch (_) {}
          return resolved;
        }
      };
      globalThis.Module = patchedModule;

      const response = await fetch('/z3-built.js');
      if (!response.ok) throw new Error(`Failed to fetch z3-built.js: ${response.status}`);
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
  console.log('initZ3 not found, loading Z3 built assets...');
  try {
    const response = await fetch('/z3-built.js');
    if (!response.ok) throw new Error(`Failed to fetch z3-built.js: ${response.status}`);
    const z3Script = await response.text();
    const scriptElement = document.createElement('script');
    scriptElement.textContent = z3Script;
    document.head.appendChild(scriptElement);
    await new Promise(resolve => setTimeout(resolve, 100));
    if (typeof globalThis.initZ3 !== 'function') throw new Error('initZ3 function not found after loading z3-built.js');
    console.log('Z3 built assets loaded successfully');
  } catch (error) {
    throw new Error(`Failed to load Z3 built assets: ${error.message}`);
  }
}

export async function getContext() {
  if (!z3InitPromise) {
    z3InitPromise = (async () => {
      try {
        console.log('Initializing Z3 context...');
        // Always ensure Z3 assets are loaded first (skip direct WASM init that fails)
        await ensureZ3Available();

        const { init } = await import('z3-solver');
        if (!init) {
          throw new Error('Z3 init function not found. Z3-solver package may not be properly installed.');
        }

        console.log('Calling Z3 init...');
        const z3 = await init();
        if (!z3) {
          throw new Error('Z3 initialization failed. Check browser console for WASM loading errors.');
        }

        console.log('Creating Z3 context...');
        // Use a general-purpose context so both arithmetic and string theories are available
        const ctx = new z3.Context('main');
        if (!ctx) {
          throw new Error('Failed to create Z3 context.');
        }

        console.log('Z3 context initialized successfully');
        return { z3, ctx };
      } catch (error) {
        console.error('Z3 initialization error:', error);

        // For browser (not test environment), try asset loading fallback
        const isNodeJSTest = typeof process !== 'undefined' && process.env && process.env.JEST_WORKER_ID;
        if (typeof document !== 'undefined' && !isNodeJSTest) {
          console.log('Retrying Z3 initialization with asset loading...');
          try {
            // Force asset loading
            if (typeof globalThis.initZ3 !== 'function') {
              console.log('initZ3 not found, loading Z3 built assets...');
              const response = await fetch('/z3-built.js');
              if (!response.ok) throw new Error(`Failed to fetch z3-built.js: ${response.status}`);
              const z3Script = await response.text();
              const scriptElement = document.createElement('script');
              scriptElement.textContent = z3Script;
              document.head.appendChild(scriptElement);
              await new Promise(resolve => setTimeout(resolve, 100));
              if (typeof globalThis.initZ3 !== 'function') throw new Error('initZ3 function not found after loading z3-built.js');
              console.log('Z3 built assets loaded successfully');
            }

            const { init } = await import('z3-solver');
            const z3 = await init();
            const ctx = new z3.Context('main');
            console.log('Z3 context initialized successfully (fallback)');
            return { z3, ctx };
          } catch (fallbackError) {
            console.error('Fallback Z3 initialization also failed:', fallbackError);
          }
        }

        // For Node.js (tests), try direct import without asset loading
        if (isNodeJSTest || typeof document === 'undefined') {
          console.log('Retrying Z3 initialization for Node.js...');
          try {
            const { init } = await import('z3-solver');
            const z3 = await init();
            const ctx = new z3.Context('main');
            console.log('Z3 context initialized successfully (Node.js)');
            return { z3, ctx };
          } catch (nodeError) {
            console.error('Node.js Z3 initialization also failed:', nodeError);
          }
        }

        throw new Error(`initZ3 was not imported correctly. Please consult documentation on how to load Z3 in browser. Details: ${error.message}`);
      }
    })();
  }
  return z3InitPromise;
}


