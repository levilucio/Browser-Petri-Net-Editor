// The WASM runtime permits one asynchronous native call at a time. The SDK's
// high-level mutex does not cover our owned low-level solver or all other native
// async APIs. Queue at their common entry point, before publishing the runtime.
const installed = new WeakSet();
export function serializeZ3AsyncCalls(em) {
  if (installed.has(em)) return;
  const original = em.async_call;
  if (typeof original !== 'function') throw new Error('Z3 runtime has no asynchronous call entry point');
  let tail = Promise.resolve();
  em.async_call = function (...args) {
    const run = tail.then(() => original.apply(this, args));
    tail = run.catch(() => {}); // A rejection must not poison later requests.
    return run;
  };
  installed.add(em);
}
