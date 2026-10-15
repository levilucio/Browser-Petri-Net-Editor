import React from 'react';

/** Presentation only: neither substitutes parameters nor changes the oracle. */
export function formatSatelTerm(value) {
  if (value === undefined) return '?';
  if (value === null) return 'null';
  if (typeof value === 'string') return value.startsWith('$') ? value.slice(1) : JSON.stringify(value);
  if (typeof value !== 'object') return String(value);
  if (value.var) return value.var;
  if (value.ctor || value.__adt__) {
    const name = value.ctor || value.constructor;
    return `${name}(${(value.args || []).map(formatSatelTerm).join(', ')})`;
  }
  if (Object.keys(value).length === 1 && Object.hasOwn(value, 'value')) return formatSatelTerm(value.value);
  if (Array.isArray(value)) return `[${value.map(formatSatelTerm).join(', ')}]`;
  if (value.__pair__) return `(${formatSatelTerm(value.fst)}, ${formatSatelTerm(value.snd)})`;
  if (value.call) return `${value.call}(${(value.args || []).map(formatSatelTerm).join(', ')})`;
  if (value.op) return `(${formatSatelTerm(value.left)} ${value.op} ${formatSatelTerm(value.right)})`;
  return `{${Object.entries(value).map(([key, v]) => `${key} = ${formatSatelTerm(v)}`).join(', ')}}`;
}

const bag = tokens => `⟦${(tokens || []).map(formatSatelTerm).join(', ')}⟧`;
const events = outputs => Object.entries(outputs || {}).flatMap(([place, tokens]) =>
  (tokens || []).map(token => `${place}(${formatSatelTerm(token)})`)).join(' // ');

export function PlaceObservations({ outputs, label }) {
  return <div className="min-w-0">
    {label && <p className="text-xs font-semibold text-gray-600 mb-1">{label}</p>}
    {!outputs || !Object.keys(outputs).length ? <p className="text-xs text-gray-600">No place assertion</p> :
      <dl className="space-y-1 font-mono text-xs break-words">
        {Object.entries(outputs).map(([place, tokens]) => <div key={place}>
          <dt className="inline">{place}</dt><dd className="inline"> ↦ {tokens.length ? bag(tokens) : '∅'}</dd>
        </div>)}
      </dl>}
  </div>;
}

export function SatelBindings({ bindings }) {
  if (!bindings || !Object.keys(bindings).length) return null;
  return <div className="text-sm break-words" aria-label="Instantiated variables">
    <span className="text-gray-600">Substitution </span>
    <span className="font-serif">σ = {'{'}{Object.entries(bindings).map(([name, value]) =>
      `${name} ↦ ${formatSatelTerm(value)}`).join(', ')}{'}'}</span>
  </div>;
}

function normalizePairs(test, io) {
  if (Array.isArray(test.pairs)) return test.pairs;
  return (test.steps || []).map((step, i) => ({
    stimulation: { method: step.method, arguments: step.arguments },
    observation: { outputs: test.expected[i] },
  }));
}

function stimulusText(stimulation, io) {
  if (stimulation.method) {
    const parameters = io?.methods?.find(m => m.name === stimulation.method)?.parameters;
    const args = parameters ? parameters.map(p => formatSatelTerm(stimulation.arguments[p.name])) : Object.entries(stimulation.arguments || {}).map(([name, value]) => `${name} = ${formatSatelTerm(value)}`);
    return `${stimulation.method}(${args.join(', ')})`;
  }
  if (stimulation.action) return `${stimulation.action}(${formatSatelTerm(stimulation.value)})`;
  const inputs = Object.entries(stimulation.inputs || {}).map(([place, tokens]) => `${place} ↦ ${bag(tokens)}`).join(', ');
  return `${stimulation.transition}${inputs ? ` [${inputs}]` : ''}`;
}
function observationText(observation, transition) {
  if (observation.type === 'notEnabled') return `notEnabled(${transition})`;
  if (!Object.keys(observation.outputs || {}).length) return 'unconstrained';
  return events(observation.outputs) || 'null';
}
function markingText(place, c) {
  // The current checker applies the first present constraint in this order.
  if (c.length !== undefined) return `|${place}| = ${c.length}`;
  if (c.empty !== undefined) return `${place} ${c.empty ? '=' : '≠'} ∅`;
  if (c.contains !== undefined) return `${bag(c.contains)} ⊆ ${place}`;
  return `${place}: no active constraint`;
}

/** Ordered, instantiated stimulation/observation pairs. */
export default function SatelTestDisplay({ test, io, pairResults = [] }) {
  io = io || test.interface;
  const pairs = normalizePairs(test, io);
  return <section aria-label="Instantiated stimulation/observation pairs" className="mt-3 space-y-2">
    <p className="text-xs text-gray-600">Instantiated test · {pairs.length} pairs in order</p>
    <PlaceObservations label="Initial marking M₀" outputs={test.referenceInitialMarking || test.initialMarking} />
    <p className="text-xs text-gray-600">Calls supply parameters. Observations describe outputs of that firing. State evolves continuously from the model’s initial marking.</p>
    <SatelBindings bindings={test.instantiation || (test.symbolicDomain && { request: test.symbolicDomain.witnessArgs[1] })} />
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
      <div className="px-3 py-2 text-xs font-semibold text-slate-600">Stimulation / observation sequence</div>
      <ol className="space-y-2 px-2 pb-2">
        {pairs.map(({ stimulation, observation }, i) => {
          const empty = Object.entries(observation.type === 'notEnabled' ? {} : observation.outputs || {}).filter(([, tokens]) => !tokens.length).map(([place]) => place);
          const result = pairResults[i];
          const marking = result?.marking || test.referenceMarkings?.[i + 1];
          return <li key={i} className="bg-white rounded border border-slate-200 p-3 min-w-0" aria-label={`Pair ${i + 1}`}>
            <div className="flex justify-between gap-2 text-xs text-gray-500 mb-2">
              <span>Pair {i + 1}</span>{result && <span>{result.phase === 'error' ? 'error' : result.success ? 'matched' : 'not matched'}</span>}
            </div>
            <div className="font-serif text-base leading-relaxed break-words" data-testid="satel-pair-formula">
              <span aria-hidden="true">⟨ </span><span className="text-blue-900">{stimulusText(stimulation, io)}</span>
              <span className="italic text-gray-500"> with </span>
              <span className="text-emerald-900">{observationText(observation, stimulation.method || stimulation.transition)}</span><span aria-hidden="true"> ⟩</span>
            </div>
            <details className="mt-2 border-t pt-2 space-y-1 text-xs text-gray-600 break-words"><summary>Execution details</summary>
              <p>{stimulation.method ? 'Public method' : 'Transition'}: <span className="font-mono">{stimulation.method || stimulation.transition}</span></p>
              {!stimulation.method && <PlaceObservations outputs={stimulation.inputs} label="Tokens consumed from places" />}
              {empty.length > 0 && <p>No tokens produced at: <span className="font-mono">{empty.join(', ')}</span>.</p>}
              {observation.type !== 'notEnabled' && observation.markings && Object.entries(observation.markings).map(([place, c]) =>
                <p key={place}>Marking: {markingText(place, c)}</p>)}
              {marking && <details><summary>Marking after pair {i + 1}</summary>
                <PlaceObservations outputs={marking} />
              </details>}
              {result?.reason && <p>{result.reason}</p>}
              {result?.error && <p className="text-red-800">{result.error}</p>}
              {result?.expected && <p>Expected: {result.place} ↦ {bag(result.expected)}</p>}
              {result?.actual && <p>Actual: {result.place} ↦ {bag(result.actual)}</p>}
            </details>
          </li>;
        })}
      </ol>

    </div>
    <p className="text-xs text-gray-500">Read pairs from top to bottom. “with” separates the stimulation from its observation; // joins outputs produced together. “null” means no specified output events.</p>
    {test.testType === 'negative' && <p className="text-xs text-gray-600">Expected: this sequence is not realizable. Execution errors do not count as success.</p>}
  </section>;
}
