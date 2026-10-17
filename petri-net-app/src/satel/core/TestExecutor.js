// Compatibility facade for consumers of the original suite/result envelope.
import { evaluateOracleSuite } from './ValidatedSubuniformity.js';
export async function executeTestSuite(suite, net, simulator, options = {}) {
  const start = Date.now();
  const run = await evaluateOracleSuite(suite.selectedTests || suite.testCases, net, suite.interface, {
    ...options,
    simulator
  });
  return {
    ...run,
    suiteId: suite.id,
    suiteName: suite.name,
    testResults: run.results,
    statistics: {
      total: run.results.length,
      passed: run.counts.pass,
      failed: run.counts.fail,
      errors: run.counts.error,
      inconclusive: run.counts.inconclusive || 0,
      executionTime: Date.now() - start
    }
  };
}
