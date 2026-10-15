import React, { useState } from 'react';
import SatelTestDisplay, { PlaceObservations } from './SatelTestDisplay';
import { generateValidatedSubuniformitySuite, evaluateOracleSuite } from '../satel/core/ValidatedSubuniformity.js';
import { accountInterface } from '../satel/examples/oracle-account/net.js';
import { withdrawalGoal, coarseWithdrawalGoal, encodeAccountWitness } from '../satel/examples/oracle-account/algebra.js';

const json = value => JSON.stringify(value, null, 2);
const term = value => {
  if (value?.ctor) return `${value.ctor}${value.args.length ? `(${value.args.map(term).join(', ')})` : ''}`;
  if (value?.var) return value.var;
  if (value?.op) return `${term(value.left)} ${value.op} ${term(value.right)}`;
  return String(value);
};

export default function OracleValidationPanel({ elements, session, onSessionChange }) {
  const [refinement, setRefinement] = useState('refined');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const suite = session?.suite;
  // A verdict always names the exact target snapshot. Editing/loading hides stale results.
  const fingerprint = JSON.stringify(elements);
  const target = session?.targetFingerprint === fingerprint ? session.target : null;
  const currentName = elements.satelExample?.name || 'Current editor APN';

  const generate = async () => {
    setBusy(true); setError(null);
    onSessionChange(null);
    try {
      const validated = await generateValidatedSubuniformitySuite({
        referenceNet: elements, io: accountInterface,
        symbolicGoal: refinement === 'refined' ? withdrawalGoal : coarseWithdrawalGoal(),
        encodeWitness: encodeAccountWitness,
      });
      onSessionChange({ suite: validated, referenceName: currentName, refinement });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const replay = async () => {
    setBusy(true); setError(null);
    try {
      const snapshot = JSON.parse(fingerprint);
      const result = await evaluateOracleSuite(suite.selectedTests, snapshot, suite.interface);
      onSessionChange({ ...session, target: result, targetName: currentName, targetFingerprint: fingerprint });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([json(session)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'satel-oracle-validation.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return <div className="p-4 space-y-4 text-sm" data-testid="oracle-validation">
    <h3 className="font-semibold text-lg">Symbolic subuniformity · Account example</h3>
    <p>Load <strong>SATEL Account — Reference</strong> from Examples, then validate the generated tests.
      Load a mutant from Examples and replay the frozen suite against that APN.</p>
    <div className="p-3 bg-blue-50 border rounded space-y-2">
      <p><strong>Loaded APN:</strong> {currentName}</p>
      {elements.satelExample?.description && <p>{elements.satelExample.description}</p>}
      <p>Initial setup: deposit request 10, the selected withdrawal request, and query request 0. Internal places start as shown in the loaded APN.</p>
      <p>Execution: deposit → withdraw → query, continuously from M₀. Requests are consumed only when their turn is enabled; outputs remain in the marking.</p>
      <p>Classes come from Request constructors and conditional operation equations. The equation model
        and its numeric APN encoding are supplied by this example; arbitrary editor ADT definitions are not translated yet.</p>
    </div>
    <label className="block">Equation refinement
      <select aria-label="Equation refinement" value={refinement} disabled={busy} onChange={e => setRefinement(e.target.value)}
        className="block w-full border rounded p-2 mt-1">
        <option value="refined">Refined: less / equal / greater (4 classes)</option>
        <option value="coarse">Coarse: affordable / unaffordable (3 classes)</option>
      </select>
    </label>
    <button onClick={generate} disabled={busy} className="w-full p-2 rounded bg-blue-700 text-white disabled:opacity-50">
      {busy ? 'Working…' : 'Generate and validate on loaded reference'}
    </button>
    <p className="text-xs text-gray-600">Generation replaces the saved suite. Every equation-derived expectation must pass
      the loaded APN before admission. Changing the refinement takes effect on the next generation.</p>
    {error && <div role="alert" className="p-3 border border-red-300 bg-red-50 text-red-800">{error}</div>}
    {suite && <>
      <div role="status" className="p-3 border border-green-300 bg-green-50">
        <strong>{suite.validation.referencePassed}/{suite.validation.generated} tests passed the reference oracle</strong>
        <p>Frozen from {session.referenceName} · {session.refinement} equations</p>
      </div>
      <button onClick={replay} disabled={busy} className="w-full p-2 rounded bg-purple-700 text-white disabled:opacity-50">
        Replay frozen suite on loaded APN
      </button>
      <p className="text-xs text-gray-600">The suite remains available when you close this panel or load another example.
        Replay uses the saved expectations, never the target to regenerate them.</p>
      {session.target && !target && <p>Target changed. Replay to obtain current results.</p>}
      {target && <div data-testid="oracle-target-results" className="p-3 border rounded space-y-2">
        <strong>{session.targetName}: {target.counts.pass} passed · {target.counts.fail} failed · {target.counts.error} errors</strong>
        <p>{target.counts.error ? 'Execution error — not counted as a detected mutation.' : target.counts.fail ?
          'Behavioral difference detected against the reference expectations.' : 'No difference detected by this suite.'}</p>
        {target.results.map(r => <details key={r.id} className="border-t pt-2" open={r.verdict !== 'pass'}>
          <summary>{r.id}: {r.verdict}{r.step ? ` at step ${r.step}` : ''}</summary>
          {r.reason && <p>{r.reason}</p>}
          {r.expected && <PlaceObservations label="Expected" outputs={r.expected} />}
          {r.actual && <PlaceObservations label="Actual" outputs={r.actual} />}
        </details>)}
      </div>}
      <h4 className="font-semibold">Symbolic classes and selected tests</h4>
      {suite.selectedTests.map(test => <details key={test.id} className="p-3 border rounded" open>
        <summary>{term(test.symbolicDomain.witnessArgs[1])} · reference passed</summary>
        <p className="mt-2"><strong>Pattern:</strong> {test.symbolicDomain.patterns.map(term).join(', ')}</p>
        <p><strong>Constraints:</strong> {test.symbolicDomain.conditions.map(term).join(' and ') || 'none'}</p>
        <p><strong>Equations:</strong> {test.symbolicDomain.rules.join(' → ')}</p>
        <details><summary>Full symbolic derivation</summary>
          <pre className="text-xs whitespace-pre-wrap break-words">{json(test.symbolicDomain)}</pre>
        </details>
        <SatelTestDisplay test={test} io={suite.interface} />
      </details>)}
      <details><summary>Source constructor and operation definitions</summary>
        <pre className="text-xs whitespace-pre-wrap break-words">{json(suite.symbolicGoal)}</pre>
      </details>
      <button onClick={download} className="p-2 border rounded">Download suite and results (JSON)</button>
    </>}
  </div>;
}
