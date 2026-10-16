// Compatibility entry points; every test uses the canonical stepwise runner.
import { replayTest } from './Replay.js';
import { withInitialMarking } from './InitialMarking.js';
export async function executeV2TestCase(test, net, simulator) {
  if (test.initialMarking !== undefined && !test.pairs.some(p => p.stimulation.method)) withInitialMarking(net, test.initialMarking);
  return replayTest(test, net, test.interface?.outputs ? test.interface : undefined, {
    simulator
  });
}
export async function executeV2TestCases(tests, net, simulator, options = {}) {
  const {
    evaluateOracleSuite
  } = await import('./ValidatedSubuniformity.js');
  return (await evaluateOracleSuite(tests, net, undefined, {
    ...options,
    simulator
  })).results;
}
