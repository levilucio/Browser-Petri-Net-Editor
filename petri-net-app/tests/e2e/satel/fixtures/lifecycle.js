import { lifecycleProbe, cancellationProbe } from './lifecycle-probe.js';
import { createHmlAlgebraicExample } from '../../../../src/satel/examples/hml-selection/algebraic.js';
window.satelLifecycle = {
  run: lifecycleProbe, cancel: cancellationProbe, example: createHmlAlgebraicExample,
  worker: () => new Worker(new URL('./lifecycle.worker.js', import.meta.url), { type: 'module' }),
  generator: () => new Worker(new URL('../../../../src/workers/satel-generator.worker.js', import.meta.url), { type: 'module' })
};
