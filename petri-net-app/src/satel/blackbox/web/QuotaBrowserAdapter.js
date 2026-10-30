/** Maps public browser controls/results to a typed method/gate contract.
 * No reference APN, expected results or application implementation is imported.
 */
import { DomainError } from '../../../domain/diagnostics.js';
let resetSequence = 0;
const parameters = [{ name: 'n', sort: 'Nat' }];
export const quotaInterface = {
  methods: [{ name: 'reserve', parameters }, { name: 'release', parameters }, { name: 'audit', parameters: [] }],
  gates: [['eligible', 'Bool'], ['ack', 'Bool'], ['free', 'Nat'], ['reserved', 'Nat']]
    .map(([name, sort]) => ({ name, parameters: [{ name: 'value', sort }] })),
  outputs: ['eligible', 'ack', 'free', 'reserved'],
  outputSorts: { eligible: 'Bool', ack: 'Bool', free: 'Nat', reserved: 'Nat' }
};
export const quotaWebSystems = [
  ['reference', 'Quota web app', 'Reserve, release and audit through a separate web page.'],
  ['wrong-reservation', 'Quota web fault: wrong reservation', 'Reserves one fewer resource than requested.'],
  ['lost-release', 'Quota web fault: lost release', 'Releasing resources fails to restore availability.'],
  ['wrong-audit', 'Quota web fault: wrong audit', 'Audit overstates availability by one.'],
  ['timeout', 'Quota web experiment: no response', 'Leaves the operation pending; the result must be inconclusive.']
].map(([variant, name, description]) => ({ id: `quota-web-${variant}`, variant, name, description, interface: quotaInterface, transport: 'browser' }));

export function quotaPageUrl(variant = 'reference', baseURL = document.baseURI) {
  if (!quotaWebSystems.some(s => s.variant === variant)) throw new DomainError('adapter-error', 'Unknown quota web variant');
  const url = new URL('quota-sut/index.html', baseURL);
  url.searchParams.set('variant', variant);
  return url.href;
}
const fail = message => new DomainError('adapter-error', message);
const cancelled = () => new DomainError('cancelled', 'Quota browser operation cancelled');

/** Typed gate bags: ordering is immaterial, multiplicity is preserved. */
export function readQuotaResponse(root, method) {
  const status = root.dataset.state;
  if (!['accepted', 'refused'].includes(status) || root.dataset.operation !== method) throw fail('Invalid quota completion response');
  const outputs = { eligible: [], ack: [], free: [], reserved: [] };
  const expected = status === 'refused' ? [] : ({ reserve: ['priority'], release: ['acknowledged'], audit: ['available', 'held'] })[method];
  const fields = [...root.querySelectorAll('[data-field]')];
  if (!expected || fields.length !== expected.length || expected.some(name => fields.filter(f => f.dataset.field === name).length !== 1)) throw fail('Quota response has missing, duplicate or unexpected fields');
  const value = name => {
    const raw = fields.find(f => f.dataset.field === name).dataset.value;
    if (['priority', 'acknowledged'].includes(name)) {
      if (raw !== 'true' && raw !== 'false') throw fail(`Invalid boolean response: ${name}`);
      return raw === 'true';
    }
    if (!/^(0|[1-9]\d*)$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw fail(`Invalid natural-number response: ${name}`);
    return Number(raw);
  };
  if (status === 'accepted') {
    if (method === 'reserve') outputs.eligible.push(value('priority'));
    if (method === 'release') outputs.ack.push(value('acknowledged'));
    if (method === 'audit') { outputs.free.push(value('available')); outputs.reserved.push(value('held')); }
  }
  return { status, outputs };
}

/** The runner bounds each operation and passes AbortSignal. Reset reloads a fresh
 * document; cancellation/timeout invalidates this instance until another reset.
 * The frame is owned by the caller, allowing the last response to stay visible.
 */
export function createQuotaBrowserSystem({ frame, variant = 'reference', baseURL } = {}) {
  if (!frame) throw fail('A quota browser frame is required');
  const url = quotaPageUrl(variant, baseURL);
  let ready = false, busy = false, activeDocument;
  function operation(work, signal) {
    if (busy) return Promise.reject(fail('A quota interaction is already outstanding'));
    if (signal?.aborted) return Promise.reject(cancelled());
    busy = true;
    return new Promise((resolve, reject) => {
      let cleanup = () => {}, settled = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true; cleanup(); signal?.removeEventListener('abort', abort); busy = false;
        if (error) { ready = false; reject(error); } else resolve(value);
      };
      const abort = () => finish(cancelled());
      signal?.addEventListener('abort', abort, { once: true });
      try { cleanup = work(finish) || cleanup; if (settled) cleanup(); }
      catch (error) { finish(error); }
    });
  }
  return {
    interface: JSON.parse(JSON.stringify(quotaInterface)),
    reset({ signal } = {}) {
      return operation(done => {
        ready = false;
        const target = new URL(url);
        target.searchParams.set('run', `${Date.now()}-${++resetSequence}`);
        const loaded = () => {
          try {
            const doc = frame.contentDocument;
            if (doc && doc.URL !== target.href) return;
            if (!doc || doc.documentElement.dataset.quotaReady !== 'true') throw fail('Quota page did not initialize');
            activeDocument = doc; ready = true; done();
          } catch (error) { done(error); }
        };
        frame.addEventListener('load', loaded);
        frame.src = target.href;
        return () => frame.removeEventListener('load', loaded);
      }, signal);
    },
    invoke({ method, arguments: args }, { signal } = {}) {
      if (!ready) return Promise.reject(fail('Reset the quota browser before invoking a method'));
      const valid = method === 'audit' ? args && Object.keys(args).length === 0
        : ['reserve', 'release'].includes(method) && args && Object.keys(args).length === 1 && Number.isSafeInteger(args.n) && args.n >= 0;
      if (!valid) return Promise.reject(fail('Invalid quota method or arguments'));
      return operation(done => {
        const doc = frame.contentDocument;
        if (doc !== activeDocument) throw fail('Quota page changed during the experiment');
        const root = doc.getElementById('response'), button = doc.getElementById(method), input = doc.getElementById('quantity');
        if (!root || !button || !input || button.disabled) throw fail('Quota controls are unavailable');
        const request = Number(root.dataset.request) + 1;
        if (!Number.isSafeInteger(request) || request < 1) throw fail('Invalid quota response sequence');
        const inspect = () => {
          try {
            if (Number(root.dataset.request) !== request || root.dataset.state === 'pending') return;
            done(null, readQuotaResponse(root, method));
          } catch (error) { done(error); }
        };
        const observer = new doc.defaultView.MutationObserver(inspect);
        observer.observe(root, { attributes: true, childList: true, subtree: true, characterData: true });
        if (method !== 'audit') {
          input.value = String(args.n);
          input.dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
        }
        button.click(); inspect();
        return () => observer.disconnect();
      }, signal);
    }
  };
}
