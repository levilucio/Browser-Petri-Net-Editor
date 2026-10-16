import { useEffect, useRef, useState, useMemo } from 'react';
import { generateIntention } from '../../../satel/core/IntentionPipeline.js';
import { evaluateOracleSuite } from '../../../satel/core/ValidatedSubuniformity.js';
import { semanticFingerprint } from '../../../domain/apn/SemanticNet.js';
import { copy } from '../../../domain/snapshots.js';

/** Own asynchronous jobs here; rendered panels only consume reports/results. */
export function useOracleSession({
  elements,
  selected,
  session,
  onSessionChange
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(null),
    [progress, setProgress] = useState('');
  const job = useRef(null);
  useEffect(() => () => {
    job.current?.abort();
    job.current = null;
  }, []);
  const fingerprint = useMemo(() => semanticFingerprint(elements, { intentions: true }), [elements]);
  const targetFingerprint = useMemo(() => semanticFingerprint(elements), [elements]);
  const currentName = elements.satelExample?.name || 'Current editor APN';
  const run = async work => {
    if (job.current) return;
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
  const generate = (classesOnly = false) => selected && run(async (signal, publish) => {
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
    const result = await generateIntention(intention, net, {
      signal,
      classesOnly,
      onPhase: setProgress,
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
    const target = await evaluateOracleSuite(saved.suite.selectedTests, net, saved.suite.interface, {
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
