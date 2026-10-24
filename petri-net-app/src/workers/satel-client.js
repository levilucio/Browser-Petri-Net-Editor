import { createSatelWorker } from './worker-factory.js';
import { generateIntention } from '../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../satel/core/ValidatedSubuniformity.js';
import { DomainError, checkCancelled } from '../domain/diagnostics.js';
import { freeze } from '../domain/snapshots.js';

/** One reusable worker per panel. No native handles cross the boundary.
 * Cancellation/disposal destroys the whole worker runtime, including in-flight
 * native work. An unavailable Worker API uses the same pipeline locally;
 * startup, transport and solver errors are surfaced, never silently retried.
 */
export function createSatelClient({ createWorker = createSatelWorker } = {}) {
  let worker = null, active = null, serial = 0, disposed = false;
  const dropWorker = () => {
    if (!worker) return;
    worker.onmessage = worker.onerror = worker.onmessageerror = null;
    worker.terminate();
    worker = null;
  };
  const finish = (job, error, value) => {
    if (active !== job) return;
    active = null;
    job.signal?.removeEventListener('abort', job.abort);
    if (error) job.reject(error);
    else {
      try {
        // Structured clone preserves data but removes Object.freeze descriptors.
        if (value?.suite) freeze(value.suite);
        job.resolve(value);
      } catch (failure) { job.reject(failure); }
    }
  };
  const failWorker = (owner, error) => {
    if (worker !== owner) return;
    dropWorker();
    if (active) finish(active, error);
  };
  const ensureWorker = () => {
    if (worker) return worker;
    const owner = createWorker();
    if (!owner) return null;
    worker = owner;
    owner.onmessage = ({ data }) => {
      const job = active;
      if (worker !== owner || !job || data?.requestId !== job.id || job.signal?.aborted) return;
      try {
        if (data.type === 'SUCCESS') finish(job, null, data.payload);
        else if (data.type === 'ERROR') finish(job, new DomainError(data.payload?.code || 'worker-error', data.payload?.message || 'SATEL worker failed'));
        else if (data.type === 'CANCELLED') finish(job, new DomainError('cancelled', 'SATEL operation cancelled'));
        else job.callbacks[data.type]?.(data.payload);
      } catch (error) { failWorker(owner, error); }
    };
    owner.onerror = event => {
      event.preventDefault?.();
      failWorker(owner, new DomainError('worker-error', event.message || 'SATEL worker could not start or crashed'));
    };
    owner.onmessageerror = () => failWorker(owner, new DomainError('worker-message-error', 'SATEL worker response could not be decoded'));
    return owner;
  };
  const run = (type, payload, options = {}) => {
    if (disposed) return Promise.reject(new DomainError('disposed', 'SATEL session has been disposed'));
    if (active) return Promise.reject(new DomainError('busy', 'SATEL session is already running'));
    const { signal, onPhase, onSelection, onProgress, onValidation, ...settings } = options;
    return new Promise((resolve, reject) => {
      const job = { id: ++serial, signal, resolve, reject, callbacks: { PHASE: onPhase, SELECTION: onSelection, PROGRESS: onProgress, VALIDATION: onValidation } };
      job.abort = () => {
        if (active !== job) return;
        dropWorker();
        finish(job, new DomainError('cancelled', 'SATEL operation cancelled'));
      };
      active = job;
      try {
        checkCancelled(signal);
        signal?.addEventListener('abort', job.abort, { once: true });
        const owner = ensureWorker();
        if (owner) owner.postMessage({ type, requestId: job.id, payload: { ...payload, options: settings } });
        else {
          const localOptions = { ...settings, signal, ...Object.fromEntries([
            ['onPhase', 'PHASE'], ['onSelection', 'SELECTION'], ['onProgress', 'PROGRESS'], ['onValidation', 'VALIDATION']
          ].map(([name, event]) => [name, value => {
            if (active === job && !signal?.aborted) job.callbacks[event]?.(value);
          }])) };
          const result = type === 'GENERATE_INTENTION'
            ? generateIntention(payload.intention, payload.petriNet, localOptions)
            : evaluateOracleSuite(payload.tests, payload.petriNet, payload.io, localOptions);
          Promise.resolve(result).then(value => finish(job, null, value), error => finish(job, error));
        }
      } catch (error) { dropWorker(); finish(job, error); }
    });
  };
  return {
    generate: (intention, petriNet, options) => run('GENERATE_INTENTION', { intention, petriNet }, options),
    replay: (tests, petriNet, io, options) => run('REPLAY', { tests, petriNet, io }, options),
    dispose() {
      disposed = true;
      if (active) active.abort();
      else dropWorker();
    }
  };
}
