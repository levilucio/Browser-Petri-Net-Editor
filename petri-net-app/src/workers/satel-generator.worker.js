import { generateTestSuite } from '../satel/core/TestGenerator.js';
import { generateIntention } from '../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../satel/core/ValidatedSubuniformity.js';
import { createSatelJobHandler } from './satel-generation-handler.js';

self.onmessage = createSatelJobHandler({
  // Legacy candidate-only envelope remains explicitly unvalidated.
  GENERATE: ({ testIntentions, petriNet }, options) => generateTestSuite(testIntentions, petriNet, null, options),
  GENERATE_INTENTION: ({ intention, petriNet }, options) => generateIntention(intention, petriNet, options),
  REPLAY: ({ tests, petriNet, io }, options) => evaluateOracleSuite(tests, petriNet, io, options)
}, message => self.postMessage(message));
