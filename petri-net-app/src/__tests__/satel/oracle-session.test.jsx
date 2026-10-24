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

test('late progress from a cancelled job cannot replace a newer job status', async () => {
  generateIntention.mockClear();
  const first = deferred(), second = deferred();
  generateIntention.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
  const { result } = renderHook(() => useOracleSession({ elements: accountNet, selected, session: null, onSessionChange: jest.fn() }));
  let oldJob, newJob;
  act(() => { oldJob = result.current.generate(); });
  const oldOptions = generateIntention.mock.calls[0][2];
  act(() => result.current.cancel());
  act(() => { newJob = result.current.generate(); });
  act(() => generateIntention.mock.calls[1][2].onPhase('Current job'));
  act(() => oldOptions.onPhase('Stale job'));
  expect(result.current.progress).toBe('Current job');
  await act(async () => { first.resolve({}); second.resolve({}); await Promise.all([oldJob, newJob]); });
});

test('closing the hidden panel cancels work and reopening can start a new job', async () => {
  generateIntention.mockClear();
  const first = deferred(); generateIntention.mockImplementationOnce(() => first.promise).mockResolvedValueOnce({ suite: { id: 'new' } });
  const publish = jest.fn();
  const { result, rerender } = renderHook(({ enabled }) => useOracleSession({ elements: accountNet, selected, session: null, onSessionChange: publish, enabled }), { initialProps: { enabled: true } });
  let old;
  act(() => { old = result.current.generate(); });
  const signal = generateIntention.mock.calls[0][2].signal;
  rerender({ enabled: false }); expect(signal.aborted).toBe(true);
  expect(result.current.busy).toBe(false);
  rerender({ enabled: true });
  await act(async () => { await result.current.generate(); });
  await act(async () => { first.resolve({ suite: { id: 'late' } }); await old; });
  expect(publish.mock.calls.some(([value]) => value?.suite?.id === 'late')).toBe(false);
  expect(publish.mock.calls.at(-1)[0].suite.id).toBe('new');
});
