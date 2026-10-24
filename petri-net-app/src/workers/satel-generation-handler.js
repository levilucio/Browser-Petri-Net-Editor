import { checkCancelled } from '../domain/diagnostics.js';

/** Single-flight worker protocol. Keep the active job until native work settles;
 * cancellation acknowledges completion only after its resources are released.
 * requestId is optional for legacy callers and echoed on every response.
 */
export function createSatelGenerationHandler(generate, postMessage) {
  let active = null;
  return async ({ data = {} }) => {
    const { type, payload, requestId } = data;
    if (type === 'CANCEL') {
      if (active && (requestId === undefined || requestId === active.requestId)) active.controller.abort();
      return;
    }
    if (type !== 'GENERATE') return;
    const send = (type, payload) => postMessage({ type, ...(requestId === undefined ? {} : { requestId }), ...(payload === undefined ? {} : { payload }) });
    if (active) {
      send('ERROR', { code: 'busy', message: 'SATEL generation is still running; wait for its terminal response.' });
      return;
    }
    const job = { requestId, controller: new AbortController() };
    active = job;
    try {
      const { testIntentions, petriNet, options } = payload;
      const suite = await generate(testIntentions, petriNet, null, {
        ...options,
        signal: job.controller.signal,
        onProgress: progress => {
          if (!job.controller.signal.aborted) send('PROGRESS', progress);
        }
      });
      checkCancelled(job.controller.signal);
      send('SUCCESS', suite);
    } catch (error) {
      if (job.controller.signal.aborted || error.code === 'cancelled' || error.name === 'AbortError') send('CANCELLED');
      else send('ERROR', { code: error.code || 'generation-error', message: error.message, stack: error.stack });
    } finally {
      active = null;
    }
  };
}
