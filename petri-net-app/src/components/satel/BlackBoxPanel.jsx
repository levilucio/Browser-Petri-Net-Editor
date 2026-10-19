import React, { useEffect, useMemo, useRef, useState } from 'react';
import { runBlackBoxCampaign } from '../../satel/blackbox/Campaign.js';
import { createDemoSystem, demoSystems } from '../../satel/blackbox/DemoSystems.js';
import { checkInterface } from '../../satel/core/SequenceRunner.js';
import { PlaceObservations, formatSatelTerm } from '../SatelTestDisplay.jsx';

const button = 'border rounded px-3 py-2 disabled:opacity-50';
const callText = call => `${call.method}(${Object.entries(call.arguments).map(([key, value]) => `${key}=${formatSatelTerm(value)}`).join(', ')})`;
export default function BlackBoxPanel({ session }) {
  const suite = session?.suite;
  const systems = useMemo(() => !suite ? [] : demoSystems.filter(s => {
    try {
      checkInterface(suite.referenceNet, s.interface);
      return JSON.stringify([...s.interface.outputs].sort()) === JSON.stringify([...suite.interface.outputs].sort());
    } catch { return false; }
  }), [suite]);
  const [selected, setSelected] = useState(''), [repetitions, setRepetitions] = useState(16);
  const [report, setReport] = useState(null), [error, setError] = useState(null), [progress, setProgress] = useState(null), [index, setIndex] = useState(0);
  const job = useRef(null);
  useEffect(() => {
    job.current?.abort(); job.current = null;
    setReport(null); setError(null); setProgress(null); setSelected('');
    return () => { job.current?.abort(); job.current = null; };
  }, [suite]);
  const system = systems.find(s => s.id === selected) || systems[0];
  const cancel = () => { job.current?.abort(); job.current = null; setProgress(null); };
  const run = async () => {
    if (job.current || !system) return;
    const controller = new AbortController(); job.current = controller;
    setReport(null); setError(null); setProgress({ current: 0 });
    try {
      const result = await runBlackBoxCampaign({ suite, createSut: () => createDemoSystem(system.id), sutName: system.name, repetitions }, {
        signal: controller.signal, onProgress: value => { if (job.current === controller) setProgress(value); }
      });
      if (job.current === controller) { setReport(result); setIndex(Math.max(0, result.runs.findIndex(r => r.verdict === 'mismatch'))); }
    } catch (e) { if (job.current === controller && !controller.signal.aborted) setError(e.message); }
    finally { if (job.current === controller) { job.current = null; setProgress(null); } }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ reference: suite.referenceNet, tests: suite.selectedTests, interface: suite.interface, report }, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'satel-black-box-campaign.json'; a.click(); URL.revokeObjectURL(url);
  };
  const observed = report?.runs[index];
  return <section aria-label="Black-box campaigns" className="p-4 space-y-3 text-sm">
    <h3 className="font-semibold text-lg">Black-box runs</h3>
    <p>Call an independent JavaScript service and observe its responses. Its private state and implementation choices are not available to the tester.</p>
    {!suite ? <p>Generate tests first. To try this increment, load SATEL Nondeterminism — Multiset reference, Branching reference, or SATEL HML selection — Reference.</p> : <>
      <p><strong>Saved reference:</strong> {session.referenceName} · {session.intentionName}</p>
      <p>The saved APN is the oracle even if another model is loaded in the editor.</p>
      {!systems.length ? <p>No bundled service matches this suite’s public interface. This increment includes the multiset, branching-choice, and parameterized HML-selection services. Other systems need a reset/invoke adapter.</p> : <>
        <label className="block">System under test<select aria-label="Black-box system" className="block border rounded p-2 w-full" disabled={!!progress} value={system.id} onChange={e => { setSelected(e.target.value); setReport(null); setError(null); }}>
          {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>
        <p>{system.description}</p>
        <label className="block">Runs per experimental path<select aria-label="Black-box repetitions" className="block border rounded p-2 w-full" value={repetitions} disabled={!!progress} onChange={e => { setRepetitions(Number(e.target.value)); setReport(null); }}>
          {[4, 16, 32, 64].map(n => <option key={n} value={n}>{n}</option>)}
        </select></label>
        <button className={`${button} bg-blue-700 text-white w-full`} disabled={!!progress} onClick={run}>Run black-box campaign</button>
      </>}
    </>}
    <p className="p-3 rounded bg-amber-50">Each path starts from a fresh initial configuration. HML paths guide calls; repeated traces do not reconstruct hidden branching states. No violation observed is not a proof of conformance. Private marking assertions and unobserved alternatives remain unresolved.</p>
    {progress && <div><p role="status">Running {progress.current}{progress.total ? ` / ${progress.total}` : ''} experiments…</p><button className={button} onClick={cancel}>Cancel campaign</button></div>}
    {error && <p role="alert" className="text-red-800">{error}</p>}
    {report && <>
      <div data-testid="black-box-summary" className="border rounded p-3 space-y-2">
        <strong>{report.sutName}</strong>
        <p>{report.counts.compatible} compatible executions · {report.counts.mismatch} observable mismatches · {report.counts.inconclusive} incomplete executions · {report.counts.error} errors</p>
        <p>Property evidence: {report.evidenceCounts.witnessed} witnessed · {report.evidenceCounts.counterexample} counterexamples · {report.evidenceCounts.inconclusive} inconclusive</p>
        <p>Property counts describe individual runs, not distinct properties. Observations from different runs are never merged into one hidden state.</p>
        <p className="text-xs">{report.policy} Base seed: {report.baseSeed}.</p>
      </div>
      <label className="block">Inspect execution<select aria-label="Black-box execution" value={index} onChange={e => setIndex(Number(e.target.value))} className="block w-full border rounded p-2">
        {report.runs.map((r, i) => <option key={i} value={i}>{i + 1}. {r.verdict} · path {r.pathIndex + 1} · seed {r.seed}</option>)}
      </select></label>
      {observed && <article aria-label="Observed black-box execution" className="space-y-3">
        <p className="text-xs break-words">Test: {observed.testId} · path {observed.pathIndex + 1} · seed {observed.seed}</p>
        <p>{observed.reason}</p><p><strong>Property:</strong> {observed.propertyEvidence.verdict}. {observed.propertyEvidence.reason}</p>
        {observed.events.map(event => <div key={event.step} className="border rounded p-3 space-y-2">
          <p className="font-serif text-base">⟨ {callText(event.stimulation)} with {event.response.status === 'refused' ? 'refused' : Object.entries(event.response.outputs).flatMap(([p, ts]) => ts.map(v => `${p}(${formatSatelTerm(v)})`)).join(' // ') || 'no output'} ⟩</p>
          <PlaceObservations label="Observed response" outputs={event.response.outputs} />
          <p>{event.compatibleBefore} compatible reference states before → {event.compatibleAfter} after.</p>
          <details><summary>Allowed reference responses</summary>{event.expected.map((response, i) => <div key={i} className="my-2"><p>{response.status}</p><PlaceObservations outputs={response.outputs} /></div>)}</details>
        </div>)}
      </article>}
      <button className={button} onClick={download}>Download campaign evidence</button>
    </>}
  </section>;
}
