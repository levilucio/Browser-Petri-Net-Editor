/** @jest-environment node */
import { createExerciseExample, exerciseScenarios } from '../../satel/examples/exercises/editor';
import { deriveSymbolicIntention, admitSymbolicIntention } from '../../satel/core/SymbolicIntention';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity';
import { getPublicMethods } from '../../features/simulation/PublicMethods';

jest.setTimeout(60000);
const matrix = {
  thermostat: [[1, 2], [3, 2]], door: [[1, 2], [1, 4]], tickets: [[2, 3], [2, 3]],
  labels: [[3, 4], [3, 8]], coordinates: [[4, 4], [4, 10]], queue: [[3, 4], [3, 6]],
  parcel: [[4, 6], [4, 12]], quota: [[3, 4], [1, 1]], kits: [[2, 1], [1, 4]], journal: [[4, 4], [4, 6]],
};
const pair = (fst, snd) => ({ __pair__: true, fst, snd });

test.each(exerciseScenarios)('$id: executable classes, continuous state and independently replayed mutants', async scenario => {
  const reference = createExerciseExample(`exercise-${scenario.id}-reference`), original = JSON.stringify(reference);
  const report = await deriveSymbolicIntention(reference.testIntentions[0], reference);
  expect(report.encodingError).toBeNull();
  expect(report.decomposition.unresolved).toEqual([]); expect(report.decomposition.overlaps).toEqual([]);
  expect(report.execution.blocked).toEqual([]); expect(report.execution.unresolved).toEqual([]);
  const suite = await admitSymbolicIntention(report, reference);
  expect(suite.validation).toEqual({ generated: scenario.classes, referencePassed: scenario.classes });
  for (const test of suite.selectedTests) {
    expect(test.steps).toHaveLength(scenario.depth);
    expect(test.referenceMarkings).toHaveLength(scenario.depth + 1);
    const last = test.referenceMarkings.at(-1);
    switch (scenario.id) {
      case 'thermostat': expect(last.temperature).toEqual([20 + test.steps[0].arguments.delta]); break;
      case 'door': expect(last.opened).toEqual([false]); break;
      case 'tickets': expect(last.remaining).toEqual([0]); break;
      case 'labels': expect(last.label).toEqual(['']); break;
      case 'coordinates': expect(last.position).toEqual([pair(0, 0)]); break;
      case 'queue': expect(last.queue).toEqual([[]]); break;
      case 'parcel': expect(last.parcel).toEqual([pair('', false)]); expect(last.phase).toEqual([0]); break;
      case 'quota':
        expect(test.steps[0].arguments.n).toBeGreaterThanOrEqual(3);
        expect(last.available).toEqual([10]); expect(last.held).toEqual([0]);
        for (const marking of test.referenceMarkings) expect(marking.available[0] + marking.held[0]).toBe(10);
        break;
      case 'kits':
        expect(last.stock).toEqual([pair('bolt', true), pair('bolt', true)]);
        expect(last.loan).toEqual([]); expect(last.product).toEqual([]);
        for (const marking of test.referenceMarkings) expect(marking.stock.length + marking.loan.length + 2 * marking.product.length).toBe(2);
        expect(test.expected[1].parts).toEqual([pair('bolt', true), pair('bolt', true)]);
        break;
      case 'journal': {
        const { delta, armed } = test.steps[0].arguments;
        expect(last.current).toEqual([10 * delta]);
        expect(last.journal).toEqual([Array.from({ length: 10 }, (_, i) => pair((i + 1) * delta, armed))]);
        break;
      }
    }
  }
  if (scenario.id === 'quota') {
    const small = report.execution.selected.find(d => d.id === 'small');
    expect(small.witnessArgs).toEqual([3]);
    expect(small.execution.representative).toBe('solved jointly from whole sequence');
  }
  const frozen = JSON.stringify(suite);
  for (const [i, mutant] of scenario.mutants.entries()) {
    const target = createExerciseExample(`exercise-${scenario.id}-${mutant.id}`);
    expect(getPublicMethods(target)).toEqual(getPublicMethods(reference));
    expect(target.testIntentions).toEqual(reference.testIntentions);
    const run = await evaluateOracleSuite(suite.selectedTests, target, suite.interface);
    const [failures, step] = matrix[scenario.id][i];
    expect(run.counts).toEqual({ pass: scenario.classes - failures, fail: failures, error: 0 });
    for (const failure of run.results.filter(r => r.verdict === 'fail')) {
      expect(failure.step).toBe(step);
      expect(failure.reason).toBe(mutant.id === 'missing-part' ? 'request-blocked' : 'observation-mismatch');
    }
    expect(JSON.stringify(suite)).toBe(frozen);
  }
  expect((await evaluateOracleSuite(suite.selectedTests, reference, suite.interface)).counts).toEqual({ pass: scenario.classes, fail: 0, error: 0 });
  expect(JSON.stringify(reference)).toBe(original);
});

test('late impossible observation is disproved within budget after equal-token symmetry reduction', async () => {
  const net = createExerciseExample('exercise-kits-reference');
  net.testIntentions[0].symbolic.protocolSource = net.testIntentions[0].symbolic.protocolSource.replace(/pair returnParts\(\) => ack\(true\)$/, 'pair returnParts() => ack(false)');
  const report = await deriveSymbolicIntention(net.testIntentions[0], net, { maxSequenceBranches: 400 });
  expect(report.execution.selected).toEqual([]);
  expect(report.execution.unresolved).toEqual([]);
  expect(report.execution.blocked).toHaveLength(2);
  expect(report.execution.visited).toBeLessThan(400);
  await expect(admitSymbolicIntention(report, net)).rejects.toThrow('No partial suite');
});
