import { splitTopLevel } from '../split-terms.js';
export const splitTopLevelCommas = input => splitTopLevel(input).filter(Boolean);

export function parseAlgebraicToken(text) {
  const p = String(text || '').trim();
  const low = p.toLowerCase();

  if (p === 'T' || low === 'true') return true;
  if (p === 'F' || low === 'false') return false;
  if (/^[+-]?\d+$/.test(p)) return parseInt(p, 10);
  if (p.startsWith('"') && p.endsWith('"')) { try { return JSON.parse(p); } catch { return null; } }
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
    const parts = splitTopLevelCommas(inner);
    if (parts.length === 2) return { __pair__: true, fst: parseAlgebraicToken(parts[0]), snd: parseAlgebraicToken(parts[1]) };
  }
  return null;
}

