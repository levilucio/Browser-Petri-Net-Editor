import { exportToPNML, importFromPNML } from '../../utils/python/index';
import { createOracleAccountExample } from '../../satel/examples/oracle-account/editor';
import { getPublicMethods } from '../../features/simulation/PublicMethods';
import { AlgebraicSimulator } from '../../features/simulation/algebraic-simulator';

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
