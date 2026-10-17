import { runSequence } from './SequenceRunner.js';
/** Explicit trace recording API. Recorded outputs are NOT admitted expectations. */
export async function observeBoundedTrace(net, io, steps, options = {}) {
  return runSequence(net, steps.map(stimulation => ({
    stimulation,
    assertion: 'required'
  })), io, options);
}
