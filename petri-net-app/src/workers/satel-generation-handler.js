import { checkCancelled } from '../domain/diagnostics.js';

/** Single-flight worker protocol. Keep the active job until native work settles;
 * cancellation acknowledges completion only after its resources are released.
 * requestId is optional for legacy callers and echoed on every response.
 */
export function createSatelJobHandler(operations, postMessage) {
  let active = null;
  return async ({ data = {} }) => {
    const { type, payload, requestId } = data;
    if (type === 'CANCEL') {
      if (active && (requestId === undefined || requestId === active.requestId)) active.controller.abort();
      return;
    }
    if (!Object.hasOwn(operations, type)) return;
    const send = (type, payload) => postMessage({ type, ...(requestId === undefined ? {} : { requestId }), ...(payload === undefined ? {} : { payload }) });
    if (active) {
      send('ERROR', { code: 'busy', message: 'SATEL generation is still running; wait for its terminal response.' });
      return;
    }
    const job = { requestId, controller: new AbortController() };
    active = job;
    try {
      const progress = type => value => {
        if (active === job && !job.controller.signal.aborted) send(type, value);
      };
      const result = await operations[type](payload, {
        ...payload.options,
        signal: job.controller.signal,
        onProgress: progress('PROGRESS'),
        onPhase: progress('PHASE'),
        onSelection: progress('SELECTION'),
        onValidation: progress('VALIDATION')
      });
      checkCancelled(job.controller.signal);
      send('SUCCESS', result);
    } catch (error) {
      if (job.controller.signal.aborted || error.code === 'cancelled' || error.name === 'AbortError') send('CANCELLED');
      else send('ERROR', { code: error.code || 'generation-error', message: error.message, stack: error.stack });
    } finally {
      active = null;
    }
  };
}

/** Preserve the candidate-suite API for external callers. */
export function createSatelGenerationHandler(generate, postMessage) {
  return createSatelJobHandler({
    GENERATE: ({ testIntentions, petriNet }, options) => generate(testIntentions, petriNet, null, options)
  }, postMessage);
}
