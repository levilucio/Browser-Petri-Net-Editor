import { renderHook, act } from '@testing-library/react';
import { useSharedClipboard } from '../../../features/selection/useSharedClipboard';

class MockBroadcastChannel {
  constructor() {
    this.postMessage = jest.fn();
    this.close = jest.fn();
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    const set = this.listeners.get(type);
    if (!set) return;
    set.delete(handler);
  }

  dispatch(type, data) {
    const set = this.listeners.get(type);
    if (!set) return;
    set.forEach(handler => handler({ data }));
  }
}

describe('useSharedClipboard', () => {
  const originalBroadcastChannel = global.BroadcastChannel;
  let mockCtor;

  beforeEach(() => {
    mockCtor = jest.fn(() => new MockBroadcastChannel());
    global.BroadcastChannel = mockCtor;
  });

  afterEach(() => {
    global.BroadcastChannel = originalBroadcastChannel;
    jest.clearAllMocks();
  });

  test('setClipboard stores payload locally and broadcasts', () => {
    const clipboardRef = { current: null };
    const { result } = renderHook(() => useSharedClipboard({
      clipboardRef,
      netMode: 'pt',
      instanceId: 'instance-a',
    }));

    const payload = { places: [{ id: 'p1' }], transitions: [], arcs: [] };
    act(() => {
      result.current.setClipboard(payload);
    });

    expect(clipboardRef.current).toMatchObject({
      payload,
      netMode: 'pt',
      source: 'local',
      instanceId: 'instance-a',
    });
    const channel = mockCtor.mock.results[0]?.value;
    expect(channel.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: 'PETRI_NET_CLIPBOARD_UPDATE',
      payload,
      netMode: 'pt',
      instanceId: 'instance-a',
    }));
  });

  test('remote clipboard updates local ref and warns on mismatch', () => {
    const clipboardRef = { current: null };
    const mismatchSpy = jest.fn();
    const { rerender } = renderHook(({ mode }) => useSharedClipboard({
      clipboardRef,
      netMode: mode,
      instanceId: 'local-instance',
      onIncompatibleClipboard: mismatchSpy,
    }), { initialProps: { mode: 'pt' } });

    const channel = mockCtor.mock.results[0]?.value;
    expect(channel).toBeTruthy();

    const remotePayload = { places: [{ id: 'rp1' }], transitions: [], arcs: [] };
    act(() => {
      channel.dispatch('message', {
        type: 'PETRI_NET_CLIPBOARD_UPDATE',
        payload: remotePayload,
        netMode: 'algebraic-int',
        instanceId: 'remote-instance',
        timestamp: 123,
      });
    });

    expect(clipboardRef.current).toMatchObject({
      payload: remotePayload,
      netMode: 'algebraic-int',
      source: 'remote',
      instanceId: 'remote-instance',
    });
    expect(mismatchSpy).toHaveBeenCalledWith('algebraic-int', 'pt', expect.any(Object));

    rerender({ mode: 'algebraic-int' });
    act(() => {
      channel.dispatch('message', {
        type: 'PETRI_NET_CLIPBOARD_UPDATE',
        payload: remotePayload,
        netMode: 'algebraic-int',
        instanceId: 'remote-instance-2',
        timestamp: 456,
      });
    });
    expect(mismatchSpy).toHaveBeenCalledTimes(1);
  });
});

