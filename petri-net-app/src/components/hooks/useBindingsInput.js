import { useCallback } from 'react';
import { parsePattern, parseArithmetic } from '../../utils/arith-parser';
import { parseBooleanExpr } from '../../utils/z3-arith';

export function useBindingsInput() {
  const splitTopLevel = useCallback((input) => {
    const parts = [];
    let current = '';
    let depth = 0;
    let bracket = 0;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (ch === '[') bracket++;
      else if (ch === ']') bracket = Math.max(0, bracket - 1);
      else if (ch === ',' && depth === 0 && bracket === 0) { parts.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts.filter(Boolean);
  }, []);

  const validateBindings = useCallback((input) => {
    const bindings = splitTopLevel(String(input || ''));
    for (const b of bindings) {
      try { parsePattern(b); continue; } catch (_) {}
      try { parseArithmetic(b); continue; } catch (_) {}
      try { parseBooleanExpr(b, parseArithmetic); continue; } catch (_) {}
      return { ok: false, error: `Invalid binding: ${b}` };
    }
    return { ok: true, bindings };
  }, [splitTopLevel]);

  return { splitTopLevel, validateBindings };
}


