import { useCallback } from 'react';

export function useValueTokensInput() {
  const splitTopLevelCommas = useCallback((str) => {
    const parts = [];
    let current = '';
    let depth = 0;
    let bracket = 0;
    let inString = false;
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      if (inString) {
        current += ch;
        if (ch === "'" && str[i - 1] !== '\\') inString = false;
        continue;
      }
      if (ch === "'") { inString = true; current += ch; continue; }
      if (ch === '(') { depth++; current += ch; continue; }
      if (ch === ')') { depth = Math.max(0, depth - 1); current += ch; continue; }
      if (ch === '[') { bracket++; current += ch; continue; }
      if (ch === ']') { bracket = Math.max(0, bracket - 1); current += ch; continue; }
      if (ch === ',' && depth === 0 && bracket === 0) { parts.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    const last = current.trim();
    if (last.length > 0) parts.push(last);
    return parts;
  }, []);

  const parseToken = useCallback((p) => {
    const s = String(p || '').trim();
    const low = s.toLowerCase();
    if (s === 'T' || low === 'true') return true;
    if (s === 'F' || low === 'false') return false;
    if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
    if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      return splitTopLevelCommas(inner).map(parseToken);
    }
    if (s.startsWith('(') && s.endsWith(')')) {
      const inner = s.slice(1, -1).trim();
      let depth = 0, idx = -1;
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        else if (ch === ',' && depth === 0) { idx = i; break; }
      }
      if (idx >= 0) {
        return { __pair__: true, fst: parseToken(inner.slice(0, idx)), snd: parseToken(inner.slice(idx + 1)) };
      }
    }
    return null;
  }, [splitTopLevelCommas]);

  const parseValueTokensInput = useCallback((input) => {
    const trimmed = String(input || '').trim();
    if (!trimmed) return [];
    return splitTopLevelCommas(trimmed).map(parseToken).filter(v => v !== null);
  }, [splitTopLevelCommas, parseToken]);

  return { parseValueTokensInput, splitTopLevelCommas };
}


