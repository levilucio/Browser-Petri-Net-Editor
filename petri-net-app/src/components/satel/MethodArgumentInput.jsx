import React, { useEffect, useState } from 'react';
import { parseObservationTokens, formatObservationToken } from './observationTerms';
import { validBuiltinValue } from '../../utils/builtin-values';

const references = value => typeof value === 'string' ? value.startsWith('$') : value && typeof value === 'object' ? !Object.hasOwn(value, 'literal') && Object.values(value).some(references) : false;
const literals = value => value && typeof value === 'object' ? Object.hasOwn(value, 'literal') ? value.literal : Array.isArray(value) ? value.map(literals) : Object.fromEntries(Object.entries(value).map(([k, v]) => [k, literals(v)])) : value;
export default function MethodArgumentInput({ value, sort, label, onChange, validityKey, onValidityChange }) {
  const [draft, setDraft] = useState(null), [error, setError] = useState('');
  useEffect(() => { onValidityChange(validityKey, !!error); return () => onValidityChange(validityKey, false); }, [validityKey, error, onValidityChange]);
  return <div><input aria-label={label} aria-invalid={!!error} className="block w-full border rounded p-2" value={draft ?? formatObservationToken(value)} placeholder={`${sort} literal or $variable`} onChange={event => {
    const text = event.target.value; setDraft(text);
    try {
      const values = parseObservationTokens(text);
      if (values.length !== 1) throw new Error('Enter one value; use [a, b] for a list or (a, b) for a pair.');
      if (!references(values[0]) && !validBuiltinValue(literals(values[0]), sort)) throw new Error(`Expected ${sort}`);
      onChange(values[0]); setError('');
    } catch (e) { setError(e.message); }
  }} />{error && <p role="alert" className="text-xs text-red-800">{error}</p>}</div>;
}
