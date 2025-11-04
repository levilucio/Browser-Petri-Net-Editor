import { useEffect, useRef, useCallback } from 'react';

const CHANNEL_NAME = 'petri-net-shared-clipboard';

export function useSharedClipboard({ clipboardRef, netMode, instanceId, onIncompatibleClipboard }) {
  const channelRef = useRef(null);
  const netModeRef = useRef(netMode || 'pt');
  const mismatchHandlerRef = useRef(onIncompatibleClipboard || null);

  useEffect(() => {
    netModeRef.current = netMode || 'pt';
  }, [netMode]);

  useEffect(() => {
    mismatchHandlerRef.current = onIncompatibleClipboard || null;
  }, [onIncompatibleClipboard]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.BroadcastChannel !== 'function') {
      return undefined;
    }

    const channel = new window.BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    const handleMessage = (event) => {
      const message = event?.data;
      if (!message || message.type !== 'PETRI_NET_CLIPBOARD_UPDATE') return;
      if (message.instanceId === instanceId) return;

      const entry = {
        payload: message.payload,
        netMode: message.netMode,
        source: 'remote',
        instanceId: message.instanceId,
        timestamp: message.timestamp || Date.now(),
      };

      if (clipboardRef) {
        clipboardRef.current = entry;
      }

      const localMode = netModeRef.current;
      if (entry.netMode && localMode && entry.netMode !== localMode) {
        mismatchHandlerRef.current?.(entry.netMode, localMode, entry);
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channelRef.current = null;
      channel.close();
    };
  }, [clipboardRef, instanceId]);

  const setClipboard = useCallback((payload) => {
    if (!payload) return;
    const entry = {
      payload,
      netMode: netModeRef.current,
      source: 'local',
      instanceId,
      timestamp: Date.now(),
    };

    if (clipboardRef) {
      clipboardRef.current = entry;
    }

    const channel = channelRef.current;
    if (channel && typeof channel.postMessage === 'function') {
      try {
        channel.postMessage({
          type: 'PETRI_NET_CLIPBOARD_UPDATE',
          payload,
          netMode: entry.netMode,
          instanceId,
          timestamp: entry.timestamp,
        });
      } catch (error) {
        console.warn('Failed to broadcast clipboard payload:', error);
      }
    }
  }, [clipboardRef, instanceId]);

  const getClipboard = useCallback(() => clipboardRef?.current, [clipboardRef]);

  return {
    setClipboard,
    getClipboard,
  };
}

export default useSharedClipboard;

