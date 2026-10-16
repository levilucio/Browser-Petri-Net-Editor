/** Small, strict notation for token multisets in the intention editor. No evaluation. */
export function parseObservationTokens(text) {
  let at = 0;
  const space = () => { while (/\s/.test(text[at] || '') && at < text.length) at++; };
  const fail = () => { throw new Error('Use comma-separated tokens: 1, $amount, Order(10, High()).'); };
  const list = end => {
    const values = []; space();
    if (end && text[at] === end) { at++; return values; }
    if (!end && at === text.length) return values;
    while (true) {
      values.push(term()); space();
      if (end ? text[at] === end : at === text.length) { if (end) at++; return values; }
      if (text[at++] !== ',') fail();
      space();
    }
  };
  const term = () => {
    space();
    if (text[at] === '"') {
      const match = text.slice(at).match(/^"(?:[^"\\]|\\.)*"/);
      if (!match) fail();
      at += match[0].length;
      const value = JSON.parse(match[0]);
      if (value.startsWith('$')) throw new Error('Strings starting with $ are reserved for variable references.');
      return value;
    }
    if (text[at] === '[') { at++; return list(']'); }
    if (text[at] === '(') {
      at++; const pair = list(')'); if (pair.length !== 2) fail();
      return { __pair__: true, fst: pair[0], snd: pair[1] };
    }
    const variable = text.slice(at).match(/^\$[A-Za-z_][A-Za-z0-9_]*/);
    if (variable) { at += variable[0].length; return variable[0]; }
    const number = text.slice(at).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) { at += number[0].length; const value = Number(number[0]); if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) fail(); return value; }
    const name = text.slice(at).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (!name) fail();
    at += name[0].length; space();
    if (text[at] === '(') { at++; return { __adt__: true, constructor: name[0], args: list(')') }; }
    if (name[0] === 'true') return true;
    if (name[0] === 'false') return false;
    if (name[0] === 'null') return null;
    fail();
  };
  return list(null);
}

export function formatObservationToken(value) {
  if (typeof value === 'string') return value.startsWith('$') ? value : JSON.stringify(value);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(formatObservationToken).join(', ')}]`;
  if (value?.__adt__) return `${value.constructor}(${(value.args || []).map(formatObservationToken).join(', ')})`;
  if (value?.__pair__) return `(${formatObservationToken(value.fst)}, ${formatObservationToken(value.snd)})`;
  throw new Error('This structured term is preserved. Remove this check to replace it.');
}
export const formatObservationTokens = values => values.map(formatObservationToken).join(', ');
