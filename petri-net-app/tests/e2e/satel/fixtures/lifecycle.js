import { createSatelClient } from '../../../../src/workers/satel-client.js';
import { generateIntention } from '../../../../src/satel/core/IntentionPipeline.js';
import { createExerciseExample } from '../../../../src/satel/examples/exercises/editor.js';
import { createOracleAccountExample } from '../../../../src/satel/examples/oracle-account/editor.js';
import { lifecycleProbe, cancellationProbe } from './lifecycle-probe.js';
import { createHmlAlgebraicExample } from '../../../../src/satel/examples/hml-selection/algebraic.js';
window.satelLifecycle = {
  client: createSatelClient, generateIntention, exercise: createExerciseExample, account: createOracleAccountExample,
  run: lifecycleProbe, cancel: cancellationProbe, example: createHmlAlgebraicExample,
  worker: () => new Worker(new URL('./lifecycle.worker.js', import.meta.url), { type: 'module' }),
  generator: () => new Worker(new URL('../../../../src/workers/satel-generator.worker.js', import.meta.url), { type: 'module' })
};
