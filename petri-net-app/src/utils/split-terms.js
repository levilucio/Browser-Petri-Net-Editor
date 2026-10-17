/** Split only outside strings, pairs, lists and calls; preserve inner syntax. */
export function splitTopLevel(text, separator = ',') {
  const parts = []; let start = 0, quote = null; const stack = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if ('(['.includes(ch)) stack.push(ch);
    else if (')]'.includes(ch)) { if (stack.pop() !== (ch === ')' ? '(' : '[')) throw new Error('Unbalanced term delimiters'); }
    else if (!stack.length && text.startsWith(separator, i)) { parts.push(text.slice(start, i).trim()); i += separator.length - 1; start = i + 1; }
  }
  if (quote || stack.length) throw new Error('Unclosed string or term');
  parts.push(text.slice(start).trim()); return parts;
}
