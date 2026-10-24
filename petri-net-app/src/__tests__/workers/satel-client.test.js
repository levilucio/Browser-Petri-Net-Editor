/** @jest-environment node */
import { createSatelClient } from '../../workers/satel-client.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../satel/core/ValidatedSubuniformity.js';
jest.mock('../../satel/core/IntentionPipeline.js', () => ({ generateIntention: jest.fn() }));
jest.mock('../../satel/core/ValidatedSubuniformity.js', () => ({ evaluateOracleSuite: jest.fn() }));
function fixture() {
  const workers = [];
  const createWorker = jest.fn(() => {
    const worker = { sent: [], terminate: jest.fn(), postMessage(message) { this.sent.push(structuredClone(message)); } };
    workers.push(worker); return worker;
  });
  return { client: createSatelClient({ createWorker }), workers, createWorker };
}
const reply = (worker, type, payload, requestId = worker.sent.at(-1).requestId) => worker.onmessage({ data: { requestId, type, payload } });
beforeEach(() => jest.clearAllMocks());

test('full generation streams reports, strips callbacks and signal, and restores the frozen suite', async () => {
  const { client, workers, createWorker } = fixture();
  const onPhase = jest.fn(), onSelection = jest.fn(), controller = new AbortController();
  const intention = { name: 'original' };
  const pending = client.generate(intention, { places: [] }, { signal: controller.signal, onPhase, onSelection, includeNegative: true });
  intention.name = 'changed';
  const worker = workers[0];
  expect(worker.sent[0]).toMatchObject({ type: 'GENERATE_INTENTION', payload: { intention: { name: 'original' }, options: { includeNegative: true } } });
  expect(Object.keys(worker.sent[0].payload.options)).toEqual(['includeNegative']);
  reply(worker, 'PHASE', 'admitting'); reply(worker, 'SELECTION', { candidates: [1] });
  expect(onPhase).toHaveBeenCalledWith('admitting'); expect(onSelection).toHaveBeenCalledWith({ candidates: [1] });
  reply(worker, 'SUCCESS', { report: {}, suite: { oracleValidated: true, referenceNet: { places: [] }, selectedTests: [{ id: 'one' }] } });
  const result = await pending;
  expect(Object.isFrozen(result.suite.referenceNet.places)).toBe(true);
  expect(Object.isFrozen(result.suite.selectedTests[0])).toBe(true);
  const replay = client.replay(result.suite.selectedTests, {}, {}, {});
  expect(createWorker).toHaveBeenCalledTimes(1); expect(worker.sent[1].type).toBe('REPLAY');
  reply(worker, 'SUCCESS', { counts: { fail: 1 } }); expect(await replay).toEqual({ counts: { fail: 1 } });
  client.dispose(); expect(worker.terminate).toHaveBeenCalledTimes(1);
});

test('cancel destroys the runtime, immediately allows restart and ignores stale messages', async () => {
  const { client, workers } = fixture(), controller = new AbortController(), onSelection = jest.fn();
  const first = client.generate({}, {}, { signal: controller.signal, onSelection });
  const rejected = expect(first).rejects.toMatchObject({ code: 'cancelled' });
  const oldWorker = workers[0], lateMessage = oldWorker.onmessage;
  controller.abort(); await rejected;
  expect(oldWorker.terminate).toHaveBeenCalledTimes(1);
  const second = client.generate({}, {}); expect(workers).toHaveLength(2);
  lateMessage({ data: { type: 'SELECTION', requestId: 1, payload: 'stale' } });
  lateMessage({ data: { type: 'SUCCESS', requestId: 1, payload: 'stale' } });
  reply(workers[1], 'SUCCESS', 'wrong id', 1);
  reply(workers[1], 'SUCCESS', { report: 'new' });
  expect(await second).toEqual({ report: 'new' }); expect(onSelection).not.toHaveBeenCalled();
  client.dispose();
});

test('already cancelled, concurrent and disposed requests do not start extra work', async () => {
  const { client, workers, createWorker } = fixture(), controller = new AbortController(); controller.abort();
  await expect(client.generate({}, {}, { signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
  expect(createWorker).not.toHaveBeenCalled();
  const first = client.generate({}, {}), rejected = expect(first).rejects.toMatchObject({ code: 'cancelled' });
  await expect(client.generate({}, {})).rejects.toMatchObject({ code: 'busy' });
  client.dispose(); await rejected;
  await expect(client.generate({}, {})).rejects.toMatchObject({ code: 'disposed' });
  expect(workers[0].terminate).toHaveBeenCalledTimes(1);
});

test.each(['startup', 'transport', 'decode', 'crash'])('%s failure is an error, never a local retry or test verdict', async kind => {
  const { client, workers, createWorker } = fixture();
  if (kind === 'startup') createWorker.mockImplementationOnce(() => { throw Error('startup failed'); });
  if (kind === 'transport') createWorker.mockImplementationOnce(() => ({ postMessage() { throw Error('clone failed'); }, terminate: jest.fn() }));
  const pending = client.generate({}, {}), rejected = expect(pending).rejects.toThrow();
  if (kind === 'decode') workers[0].onmessageerror({});
  if (kind === 'crash') workers[0].onerror({ message: 'crashed', preventDefault() {} });
  await rejected; expect(generateIntention).not.toHaveBeenCalled();
  const next = client.generate({}, {}); reply(workers.at(-1), 'SUCCESS', { report: 'recovered' });
  expect(await next).toEqual({ report: 'recovered' }); client.dispose();
});

test('admission failure retains the partial report and leaves the worker reusable', async () => {
  const { client, workers } = fixture(), onSelection = jest.fn();
  const pending = client.generate({}, {}, { onSelection }), rejected = expect(pending).rejects.toMatchObject({ code: 'generation-error', message: 'No partial suite admitted' });
  reply(workers[0], 'SELECTION', { candidates: [], execution: { unresolved: [1] } });
  reply(workers[0], 'ERROR', { code: 'generation-error', message: 'No partial suite admitted' }); await rejected;
  expect(onSelection).toHaveBeenCalledTimes(1); expect(workers[0].terminate).not.toHaveBeenCalled();
  const classes = client.generate({}, {}, { classesOnly: true }); reply(workers[0], 'SUCCESS', { report: { candidates: [] } });
  expect(await classes).not.toHaveProperty('suite'); client.dispose();
});

test('unavailable Worker API uses the same pipeline and suppresses late cancelled callbacks', async () => {
  const client = createSatelClient({ createWorker: () => null }), controller = new AbortController(), onSelection = jest.fn();
  let complete, callbacks;
  generateIntention.mockImplementationOnce((i, n, options) => { callbacks = options; return new Promise(resolve => { complete = resolve; }); });
  const first = client.generate({}, {}, { signal: controller.signal, onSelection }), rejected = expect(first).rejects.toMatchObject({ code: 'cancelled' });
  controller.abort(); await rejected; callbacks.onSelection('late'); complete({ suite: { id: 'stale' } });
  evaluateOracleSuite.mockResolvedValue({ counts: { pass: 1 } });
  expect(await client.replay([], {}, {})).toEqual({ counts: { pass: 1 } });
  expect(onSelection).not.toHaveBeenCalled(); client.dispose();
});
