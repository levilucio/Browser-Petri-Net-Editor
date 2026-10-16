import { act, renderHook } from '@testing-library/react';
import { useOracleSession } from '../../components/satel/hooks/useOracleSession.js';
import { generateIntention } from '../../satel/core/IntentionPipeline.js';
import { accountNet } from '../../satel/examples/oracle-account/net.js';
jest.mock('../../satel/core/IntentionPipeline.js', () => ({ generateIntention: jest.fn() }));
const selected = { id: 'one', name: 'One' };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test('cancelled and unmounted jobs cannot overwrite the current session', async () => {
  const first = deferred(), second = deferred();
  generateIntention.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  const publish = jest.fn();
  const { result, unmount } = renderHook(() => useOracleSession({ elements: accountNet, selected, session: null, onSessionChange: publish }));
  let oldJob, newJob;
  act(() => { oldJob = result.current.generate(); });
  const oldSignal = generateIntention.mock.calls[0][2].signal;
  act(() => result.current.cancel());
  expect(oldSignal.aborted).toBe(true);
  act(() => { newJob = result.current.generate(); });
  await act(async () => { first.resolve({ suite: { id: 'stale' } }); await oldJob; });
  expect(result.current.busy).toBe(true);
  expect(publish.mock.calls.some(([value]) => value?.suite?.id === 'stale')).toBe(false);
  const newSignal = generateIntention.mock.calls[1][2].signal;
  unmount();
  expect(newSignal.aborted).toBe(true);
  await act(async () => { second.resolve({ suite: { id: 'unmounted' } }); await newJob; });
  expect(publish.mock.calls.some(([value]) => value?.suite)).toBe(false);
});
