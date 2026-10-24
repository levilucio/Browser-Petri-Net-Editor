import { z3AssetBase, loadWorkerZ3 } from '../../../utils/z3/browser-assets.js';

test.each([
  ['https://example.org/src/utils/z3/context.js?t=123', 'https://example.org/'],
  ['https://example.org/petri/src/utils/z3/context.js', 'https://example.org/petri/'],
  ['https://example.org/petri/assets/z3.worker-123.js#hash', 'https://example.org/petri/'],
  ['https://example.org/src/project/assets/z3.worker.js', 'https://example.org/src/project/'],
  ['https://example.org/petri/worker.js', 'https://example.org/petri/']
])('resolves public Z3 assets from %s', (moduleUrl, expected) => expect(z3AssetBase(moduleUrl)).toBe(expected));

test('worker factory receives binary asset and nested pthread paths as arguments', async () => {
  const originalFetch = global.fetch, originalInit = global.initZ3;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, text: async () => 'globalThis.initZ3 = options => options;' });
  delete global.initZ3;
  try {
    await loadWorkerZ3('https://example.org/petri/src/utils/z3/context.js');
    const options = global.initZ3({ testOption: true });
    expect(global.fetch).toHaveBeenCalledWith('https://example.org/petri/z3-built.js');
    expect(options.mainScriptUrlOrBlob).toBe('https://example.org/petri/z3-built.js');
    expect(options.locateFile('z3-built.wasm')).toBe('https://example.org/petri/z3-built.wasm');
    expect(options.testOption).toBe(true);
    await loadWorkerZ3('https://example.org/petri/src/utils/z3/context.js');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally { global.fetch = originalFetch; if (originalInit) global.initZ3 = originalInit; else delete global.initZ3; }
});
