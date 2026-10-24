/** Candidate-suite worker; oracle admission still belongs to generateIntention. */
import { generateTestSuite } from '../satel/core/TestGenerator.js';
import { createSatelGenerationHandler } from './satel-generation-handler.js';

self.onmessage = createSatelGenerationHandler(generateTestSuite, message => self.postMessage(message));
