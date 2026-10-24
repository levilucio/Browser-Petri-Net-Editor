import { lifecycleProbe, cancellationProbe } from './lifecycle-probe.js';
let controller;
self.onmessage = async ({ data }) => {
  if (data.type === 'CANCEL') { controller?.abort(); return; }
  try {
    controller = new AbortController();
    const result = data.type === 'CANCEL_PROBE'
      ? await cancellationProbe(controller.signal, type => self.postMessage({ type }))
      : await lifecycleProbe(data.options);
    self.postMessage({ type: 'DONE', result });
  } catch (error) { self.postMessage({ type: 'ERROR', error: error.message, stack: error.stack }); }
};
