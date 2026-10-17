import { deriveIntention } from './IntentionPipeline.js';
/** Compatibility suite envelope; selection policy is independent of replay. */
export async function generateTestSuite(intentions, net, simulator, options = {}) {
  if (!intentions?.length) throw new Error('At least one test intention is required');
  const start = Date.now(),
    testCases = [];
  for (const [index, intention] of intentions.entries()) {
    options.onProgress?.({
      current: index + 1,
      total: intentions.length,
      message: `Processing: ${intention.name}`
    });
    const report = await deriveIntention(intention, net, options);
    if (report.encodingError) throw new Error(report.encodingError);
    testCases.push(...report.candidates);
  }
  return {
    id: `suite-${Date.now()}`,
    name: options.suiteName || 'SATEL Test Suite',
    testCases,
    oracleValidated: false,
    statistics: {
      totalIntentions: intentions.length,
      intentionsProcessed: intentions.length,
      casesGenerated: testCases.length,
      casesAfterReduction: testCases.length,
      pairStimulations: testCases.reduce((n, test) => n + test.pairs.length, 0),
      statesExplored: 0,
      reductionApplied: false,
      generationTime: Date.now() - start
    }
  };
}
