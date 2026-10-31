// Only transport/observation normalization. No APN or backend implementation imports.
export const io = {
  methods: [
    {name: 'open', parameters: []}, {name: 'allocate', parameters: []},
    {name: 'reserve', parameters: [{name: 'warehouse', sort: 'Nat'}]}, {name: 'finish', parameters: []}
  ],
  gates: ['ready', 'allocated', 'receipt'].map(name => ({name, parameters: [{name: 'arg1', sort: name === 'ready' ? 'Bool' : 'Nat'}]})),
  outputs: ['ready', 'allocated', 'receipt'], outputSorts: {ready: 'Bool', allocated: 'Nat', receipt: 'Nat'}
};
export async function request(base, path, body, headers = {}, signal) {
  const r = await fetch(base + path, {method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body), signal: signal || AbortSignal.timeout(10000)});
  const data = await r.json();
  if (!r.ok && data.status !== 'refused') throw Error(`HTTP ${r.status}: ${JSON.stringify(data)}`);
  return data;
}
export const testHeaders = {'X-Test-Key': 'local-experiment'};
export const control = (base, action, body = {}) => request(base, '/api/testing/' + action, body, testHeaders);
export function observed(data) {
  if (!['accepted', 'refused'].includes(data?.status)) throw Error('Invalid public response');
  const outputs = {ready: [], allocated: [], receipt: []};
  if (data.status === 'accepted') {
    if (!data.result || Object.keys(data.result).length !== 1) throw Error('Invalid result');
    const [key, value] = Object.entries(data.result)[0];
    if (!(key in outputs) || (key === 'ready' ? typeof value !== 'boolean' : !Number.isInteger(value) || value < 0)) throw Error('Invalid gate value');
    outputs[key] = [value];
  }
  return {status: data.status, outputs};
}
export function adapter(base, page = null) {
  return {
    interface: structuredClone(io),
    async reset({seed = 1, signal} = {}) {
      await request(base, '/api/testing/reset', {seed}, testHeaders, signal);
      if (page) { await page.setExtraHTTPHeaders({}); await page.goto(base); }
    },
    async invoke(call, {signal, choice} = {}) {
      const headers = choice === undefined ? {} : {...testHeaders, 'X-Choice': String(choice)};
      if (!page) return observed(await request(base, '/api/reservation/' + call.method, call.arguments, headers, signal));
      if (signal?.aborted) throw Error('Aborted');
      const abort = () => page.close().catch(() => {});
      signal?.addEventListener('abort', abort, {once: true});
      try {
        await page.setExtraHTTPHeaders(headers);
        const selector = `[data-method="${call.method}"]` + (call.method === 'reserve' ? `[data-warehouse="${call.arguments.warehouse}"]` : '');
        const before = Number(await page.locator('#response').getAttribute('data-request'));
        await page.locator(selector).click({timeout: 10000});
        await page.waitForFunction(n => Number(document.querySelector('#response').dataset.request) > n && !document.querySelector('[data-method="open"]').disabled, before, {timeout: 10000});
        return observed(JSON.parse(await page.locator('#response').textContent()));
      } finally { signal?.removeEventListener('abort', abort); await page.setExtraHTTPHeaders({}).catch(() => {}); }
    }
  };
}
