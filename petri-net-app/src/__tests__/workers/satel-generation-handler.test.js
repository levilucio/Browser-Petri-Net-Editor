import { createSatelGenerationHandler } from '../../workers/satel-generation-handler.js';
import { checkCancelled } from '../../domain/diagnostics.js';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const start = requestId => ({ data: { type: 'GENERATE', requestId, payload: { testIntentions: [{}], petriNet: {}, options: {} } } });

test('overlap cannot replace the active controller; cancellation waits for settlement and permits restart', async () => {
  const pending = deferred(), messages = [], calls = [];
  const handler = createSatelGenerationHandler(async (...args) => { calls.push(args); return pending.promise; }, m => messages.push(m));
  const first = handler(start('first'));
  await handler(start('overlap'));
  expect(messages[0]).toMatchObject({ type: 'ERROR', requestId: 'overlap', payload: { code: 'busy' } });
  await handler({ data: { type: 'CANCEL', requestId: 'overlap' } });
  expect(calls[0][3].signal.aborted).toBe(false);
  await handler({ data: { type: 'CANCEL', requestId: 'first' } });
  expect(calls[0][3].signal.aborted).toBe(true);
  calls[0][3].onProgress({ current: 1 });
  expect(messages).toHaveLength(1);
  pending.resolve({ testCases: [] }); await first;
  expect(messages[1]).toEqual({ type: 'CANCELLED', requestId: 'first' });
  await handler(start('next'));
  expect(messages[2]).toEqual({ type: 'SUCCESS', requestId: 'next', payload: { testCases: [] } });
});

test.each(['domain', 'abort', 'error'])('%s terminal outcome leaves worker usable', async kind => {
  const messages = [];
  const generate = jest.fn().mockImplementationOnce(() => {
    if (kind === 'domain') checkCancelled({ aborted: true });
    const error = new Error('failure'); if (kind === 'abort') error.name = 'AbortError'; throw error;
  }).mockResolvedValue({ testCases: [] });
  const handler = createSatelGenerationHandler(generate, m => messages.push(m));
  await handler(start());
  expect(messages[0].type).toBe(kind === 'error' ? 'ERROR' : 'CANCELLED');
  expect(messages[0]).not.toHaveProperty('requestId');
  await handler(start()); expect(messages[1].type).toBe('SUCCESS');
});

test('shared job protocol carries full selection/admission progress and replay without changing operations', async () => {
  const { createSatelJobHandler } = await import('../../workers/satel-generation-handler.js');
  const messages = [], report = { candidates: [1], referenceResults: [] };
  const generate = jest.fn(async (payload, options) => {
    expect(payload.intention).toEqual({ id: 'one' }); expect(options.includeNegative).toBe(true);
    options.onSelection(report); options.onPhase('Validating');
    report.referenceResults.push({ verdict: 'pass' }); options.onSelection(report);
    return { report, suite: { oracleValidated: true } };
  });
  const replay = jest.fn().mockResolvedValue({ counts: { fail: 1 } });
  const handler = createSatelJobHandler({ GENERATE_INTENTION: generate, REPLAY: replay }, message => messages.push(JSON.parse(JSON.stringify(message))));
  await handler({ data: { type: 'GENERATE_INTENTION', requestId: 1, payload: { intention: { id: 'one' }, options: { includeNegative: true } } } });
  expect(messages.map(m => m.type)).toEqual(['SELECTION', 'PHASE', 'SELECTION', 'SUCCESS']);
  expect(messages[0].payload.referenceResults).toHaveLength(0); expect(messages[2].payload.referenceResults).toHaveLength(1);
  expect(messages[3].payload.suite.oracleValidated).toBe(true);
  await handler({ data: { type: 'REPLAY', requestId: 2, payload: { tests: [1] } } });
  expect(messages.at(-1)).toMatchObject({ type: 'SUCCESS', requestId: 2, payload: { counts: { fail: 1 } } });
});
