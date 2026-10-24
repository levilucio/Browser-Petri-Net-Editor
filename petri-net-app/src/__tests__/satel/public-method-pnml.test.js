import { createInventoryExample, inventoryExamples } from '../../satel/examples/inventory/editor.js';
import { createExerciseExample, exerciseExamples } from '../../satel/examples/exercises/editor';
import { exportToPNML, importFromPNML } from '../../utils/python/index';
import { createOracleAccountExample } from '../../satel/examples/oracle-account/editor';
import { getPublicMethods } from '../../features/simulation/PublicMethods';
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';
import { createFulfilmentExample, fulfilmentExamples } from '../../satel/examples/fulfilment/editor';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { workerService } from '../../satel/examples/scale/models';
import { semanticFingerprint } from '../../domain/apn/SemanticNet';

test('exported audit stress reference and mutants load as the benchmarked models', async () => {
  for (const mutant of [null, 'missing-worker', 'wrong-receipt']) {
    const file = resolve(__dirname, '../../../../docs/satel/performance/models', `workers-audit-stress-${mutant || 'reference'}.pnml`);
    const loaded = await importFromPNML(readFileSync(file, 'utf8'));
    // Compare both after the GUI importer normalizes arc binding aliases and
    // direction metadata; these differ from the generator's in-memory shape.
    const expected = await importFromPNML(await exportToPNML(workerService({ workers: 4, rounds: 4, audit: true, mutant })));
    expect(semanticFingerprint(loaded)).toBe(semanticFingerprint(expected));
    expect(loaded.testIntentions).toEqual(expected.testIntentions);
  }
});

test('large fulfilment reference and mutants survive GUI PNML save/load', async () => {
  for (const example of fulfilmentExamples) {
    const net = createFulfilmentExample(example.filename);
    const loaded = await importFromPNML(await exportToPNML(net));
    expect(getPublicMethods(loaded)).toEqual(getPublicMethods(net));
    expect(loaded.testIntentions).toEqual(net.testIntentions);
    expect(loaded.satelExample).toEqual(net.satelExample);
    expect(loaded.places.map(p => [p.id, p.sort, p.io_type, p.valueTokens])).toEqual(net.places.map(p => [p.id, p.sort, p.io_type, p.valueTokens]));
    expect(loaded.arcs.map(a => [a.id, a.binding || a.bindings?.[0]])).toEqual(net.arcs.map(a => [a.id, a.binding]));
  }
});

test('GUI PNML save/load preserves callable methods, sorts, outputs and intentions', async () => {
  const net = createOracleAccountExample('oracle-account-reference');
  net.testIntentions = [{ id: 'saved', pairs: [{ stimulation: { method: 'deposit', arguments: { n: 5 } }, observation: { outputs: { ack: [1] } } }] }];
  const saved = await exportToPNML(net), loaded = await importFromPNML(saved);
  expect(getPublicMethods(loaded)).toEqual(getPublicMethods(net));
  expect(loaded.testIntentions).toEqual(net.testIntentions);
  expect(loaded.satelExample).toEqual(net.satelExample);
  expect(loaded.mode).toBe(net.mode);
  expect(loaded.places.map(p => [p.id, p.sort, p.io_type, p.valueTokens])).toEqual(net.places.map(p => [p.id, p.sort, p.io_type, p.valueTokens]));
  const simulator = new AlgebraicSimulator(); await simulator.initialize(loaded);
  expect(await simulator.getEnabledTransitions()).toEqual([]);
  expect((await simulator.invokeMethod('deposit', { n: 5 })).produced).toMatchObject({ balance: [5], ack: [1] });
});

test('malformed method metadata fails loading rather than making public rules autonomous', async () => {
  const saved = await exportToPNML(createOracleAccountExample('oracle-account-reference'));
  await expect(importFromPNML(saved.replace('"name":"deposit"', '"name":null'))).rejects.toThrow('Invalid SATEL metadata');
  await expect(importFromPNML(saved.replace('"places":', '"places"BROKEN:'))).rejects.toThrow('Invalid SATEL metadata');
});


test.each(exerciseExamples)('$filename: exercise PNML preserves initial state, methods, equations and pair sequences', async entry => {
  const net = createExerciseExample(entry.filename);
  const loaded = await importFromPNML(await exportToPNML(net));
  expect(getPublicMethods(loaded)).toEqual(getPublicMethods(net));
  expect(loaded.testIntentions).toEqual(net.testIntentions);
  expect(loaded.satelExample).toEqual(net.satelExample);
  expect(loaded.places.map(p => [p.id, p.sort, p.io_type, p.valueTokens])).toEqual(net.places.map(p => [p.id, p.sort, p.io_type, p.valueTokens]));
  expect(loaded.arcs.map(a => [a.id, a.binding || a.bindings?.[0]])).toEqual(net.arcs.map(a => [a.id, a.binding]));
});


test.each(inventoryExamples)('$filename: saved inventory PNML matches the GUI example', async entry => {
  const file = resolve(__dirname, '../../../../docs/satel/performance/models/inventory', `${entry.filename}.pnml`);
  const loaded = await importFromPNML(readFileSync(file, 'utf8'));
  const expected = await importFromPNML(await exportToPNML(createInventoryExample(entry.filename)));
  expect(semanticFingerprint(loaded)).toBe(semanticFingerprint(expected));
  expect(loaded.testIntentions).toEqual(expected.testIntentions);
  expect(loaded.satelExample).toEqual(expected.satelExample);
});
