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
