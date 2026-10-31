/** @jest-environment node */
import { builder } from '../../satel/examples/exercises/builder.js';
import { deriveSymbolicIntention } from '../../satel/core/SymbolicIntention.js';
import { admitIntention } from '../../satel/core/Admission.js';
import { sequenceFormula, validateFormula } from '../../satel/core/HmlFormula.js';
jest.setTimeout(60000);

function fixture(length) {
  const b = builder(); b.place('counter', 'Nat', [0]);
  b.net.gates = [{ name: 'value', parameters: [{ name: 'arg1', sort: 'Nat' }] }];
  b.rule('advance', 'advance', {}, '', [['counter', 'n']], [['counter', 'n + 1']]);
  b.net.transitions[0].gates = [{ gate: 'value', arguments: ['n + 1'] }];
  const intention = { id: 'long', name: 'Long counter sequence', kind: 'symbolic', symbolic: {
    source: 'operation identity(Nat): Nat\nrule identity.def(n: Nat): identity(n) = n',
    variablesText: 'n: Nat', argsText: 'n', operation: 'identity', maxDepth: 1,
    protocolSource: `case advance(n: Nat):\ninputs n\nresult n\n${Array.from({ length }, (_, i) => `pair advance() => value(${i === length - 1 ? 'n' : i + 1})`).join('\n')}`
  } };
  return { net: b.net, intention };
}

test('default 32-pair bound remains; excess length is unresolved, never an infeasible class', async () => {
  const { net, intention } = fixture(33), report = await deriveSymbolicIntention(intention, net);
  expect(report.execution.maxSequencePairs).toBe(32);
  expect(report.execution.blocked).toEqual([]); expect(report.candidates).toEqual([]);
  expect(report.execution.unresolved[0].diagnostic.code).toBe('sequence-length-limit');
  await expect(admitIntention(report, net)).rejects.toThrow('unresolved');
});

test('explicit budget admits 100 pairs and the final observation constrains the witness', async () => {
  const { net, intention } = fixture(100);
  const report = await deriveSymbolicIntention(intention, net, { maxSequencePairs: 128, maxSequenceBranches: 100000 });
  expect(report.execution.unresolved).toEqual([]);
  expect(report.candidates[0].symbolicDomain.witnessArgs).toEqual([100]);
  const suite = await admitIntention(report, net);
  expect(suite.selectedTests[0].pairs).toHaveLength(100);
  expect(suite.selectedTests[0].referenceMarkings.at(-1).counter).toEqual([100]);
  // This sequence support does not silently raise the imported HML formula cap.
  expect(() => validateFormula(sequenceFormula(suite.selectedTests[0].pairs))).toThrow('64 nested levels');
});

test('invalid configured lengths fail validation before selection', async () => {
  const { net, intention } = fixture(25);
  for (const maxSequencePairs of [0, -1, 257, 1.5, '100']) {
    const report = await deriveSymbolicIntention(intention, net, { maxSequencePairs });
    expect(report.diagnostic.code).toBe('invalid-options'); expect(report.candidates).toEqual([]);
  }
});

test('raising the pair limit does not bypass the search-node budget', async () => {
  const { net, intention } = fixture(100);
  const report = await deriveSymbolicIntention(intention, net, { maxSequencePairs: 128, maxSequenceBranches: 1 });
  expect(report.execution.unresolved[0].diagnostic.code).toBe('resource-limit');
  expect(report.execution.blocked).toEqual([]); expect(report.candidates).toEqual([]);
});
