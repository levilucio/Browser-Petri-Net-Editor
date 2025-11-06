export function splitTopLevelCommas(input) {
  const parts = [];
  let current = '';
  let parenDepth = 0;
  let bracketDepth = 0;
  let inString = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      current += ch;
      if (ch === "'" && input[i - 1] !== '\\') {
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
      continue;
    }
    if (ch === '(') {
      parenDepth++;
      current += ch;
      continue;
    }
    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1);
      current += ch;
      continue;
    }
    if (ch === '[') {
      bracketDepth++;
      current += ch;
      continue;
    }
    if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1);
      current += ch;
      continue;
    }
    if (ch === ',' && parenDepth === 0 && bracketDepth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  const last = current.trim();
  if (last.length > 0) {
    parts.push(last);
  }
  return parts.filter(Boolean);
}

export function parseAlgebraicToken(text) {
  const p = String(text || '').trim();
  const low = p.toLowerCase();

  if (p === 'T' || low === 'true') return true;
  if (p === 'F' || low === 'false') return false;
  if (/^[+-]?\d+$/.test(p)) return parseInt(p, 10);
  if (p.startsWith("'") && p.endsWith("'") && p.length >= 2) {
    const inner = p.slice(1, -1);
    return inner.replace(/\\(.)/g, (match, char) => {
      if (char === 'n') return '\n';
      if (char === 't') return '\t';
      if (char === 'r') return '\r';
      if (char === '\\') return '\\';
      if (char === "'") return "'";
      return char;
    });
  }
  if (p.startsWith('[') && p.endsWith(']')) {
    const inner = p.slice(1, -1).trim();
    if (inner.length === 0) return [];
    const elements = splitTopLevelCommas(inner);
    return elements.map(el => parseAlgebraicToken(el));
  }
  if (p.startsWith('(') && p.endsWith(')')) {
    const inner = p.slice(1, -1).trim();
    let depth = 0;
    let idx = -1;
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === ',' && depth === 0) { idx = i; break; }
    }
    if (idx >= 0) {
      const left = inner.slice(0, idx).trim();
      const right = inner.slice(idx + 1).trim();
      return {
        __pair__: true,
        fst: parseAlgebraicToken(left),
        snd: parseAlgebraicToken(right),
      };
    }
  }
  return null;
}

