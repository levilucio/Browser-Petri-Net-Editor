import { useEffect, useRef, useState, useMemo } from 'react';
import { createSatelClient } from '../../../workers/satel-client.js';
import { semanticFingerprint } from '../../../domain/apn/SemanticNet.js';
import { copy } from '../../../domain/snapshots.js';

/** Own asynchronous jobs here; rendered panels only consume reports/results. */
export function useOracleSession({
  elements,
  selected,
  session,
  onSessionChange,
  enabled = true
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [progress, setProgress] = useState('');
  const job = useRef(null), client = useRef(null);
  const executor = () => client.current || (client.current = createSatelClient());
  useEffect(() => {
    if (!enabled) { setBusy(false); setProgress(''); }
    return () => {
      job.current?.abort();
      job.current = null;
      client.current?.dispose();
      client.current = null;
    };
  }, [enabled]);
  const fingerprint = useMemo(() => semanticFingerprint(elements, { intentions: true }), [elements]);
  const targetFingerprint = useMemo(() => semanticFingerprint(elements), [elements]);
  const currentName = elements.satelExample?.name || 'Current editor APN';
  const run = async work => {
    if (!enabled || job.current) return;
    const controller = new AbortController();
    job.current = controller;
    const publish = value => {
      if (job.current === controller && !controller.signal.aborted) onSessionChange(value);
    };
    setBusy(true);
    setError(null);
    try {
      await work(controller.signal, publish);
    } catch (e) {
      if (job.current === controller && !controller.signal.aborted) setError(e.message);
    } finally {
      if (job.current === controller) {
        job.current = null;
        setBusy(false);
        setProgress('');
      }
    }
  };
  const generate = (classesOnly = false, includeNegative = false) => selected && run(async (signal, publish) => {
    const net = copy(elements),
      intention = copy(selected);
    const next = {
      referenceFingerprint: fingerprint,
      referenceName: currentName,
      intentionName: intention.name,
      intentionId: intention.id
    };
    publish(null);
    setProgress('Selecting values and instantiating the pair sequences…');
    const result = await executor().generate(intention, net, {
      signal,
      classesOnly,
      includeNegative: !classesOnly && includeNegative,
      onPhase: message => {
        if (job.current?.signal === signal && !signal.aborted) setProgress(message);
      },
      onSelection: report => publish({
        ...next,
        report
      })
    });
    publish({
      ...next,
      ...result
    });
  });
  const replay = () => session?.suite && run(async (signal, publish) => {
    const saved = session,
      net = copy(elements);
    setProgress('Replaying frozen expectations…');
    const target = await executor().replay(saved.suite.selectedTests, net, saved.suite.interface, {
      signal
    });
    publish({
      ...saved,
      target,
      targetName: currentName,
      targetFingerprint
    });
  });
  const cancel = () => {
    job.current?.abort();
    job.current = null;
    setBusy(false);
    setProgress('');
  };
  return {
    busy,
    error,
    setError,
    progress,
    fingerprint,
    currentName,
    generate,
    replay,
    cancel,
    target: session?.targetFingerprint === targetFingerprint ? session.target : null
  };
}
