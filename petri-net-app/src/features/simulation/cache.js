// Cache builders for guards and bindings

export function buildGuardCache(petriNet, parseArithmetic, parseBooleanExpr, parsePredicate) {
  const guardAstByTransition = new Map();
  for (const t of (petriNet.transitions || [])) {
    if (t.guard && typeof t.guard === 'string') {
      try {
        const ast = parseBooleanExpr(String(t.guard), parseArithmetic);
        guardAstByTransition.set(t.id, ast);
      } catch (_) {
        try {
          const ast = parsePredicate(String(t.guard), parseArithmetic);
          guardAstByTransition.set(t.id, ast);
        } catch (_) {
          // ignore parse errors here; guard will simply be false if unparsable
        }
      }
    }
  }
  return guardAstByTransition;
}

export function buildBindingCache(petriNet, parsePattern, parseArithmetic, parseBooleanExpr, allowedOps) {
  const bindingAstsByArc = new Map();
  for (const a of (petriNet.arcs || [])) {
    const key = a.id;
    const bindings = Array.isArray(a.bindings) ? a.bindings : (a.binding ? [a.binding] : []);
    const asts = [];
    for (const b of bindings) {
      const text = String(b);

      // First try pattern matching (for deconstruction like (F, x))
      try {
        const pattern = parsePattern(text);
        asts.push({ kind: 'pattern', ast: pattern });
        continue;
      } catch (_) {
        // Not a pattern, continue with other parsing methods
      }

      // Prefer arithmetic, but if variable annotated as bool, store as bool kind
      let parsed = null;
      const tf = (text === 'T') ? true : (text === 'F') ? false : null;
      try { parsed = parseArithmetic(text); } catch (_) { parsed = null; }
      if (parsed && parsed.type === 'funcall') {
        if (!allowedOps.has(parsed.name)) {
          parsed = null; // fall back to boolean parsing below
        }
      }
      if (parsed) {
        if (parsed.type === 'var' && parsed.varType === 'bool') {
          asts.push({ kind: 'bool', ast: { type: 'boolVar', name: parsed.name, varType: 'bool' } });
        } else if (parsed.type === 'var' && parsed.varType === 'pair') {
          asts.push({ kind: 'pair', ast: { type: 'pairVar', name: parsed.name, varType: 'pair' } });
        } else {
          asts.push({ kind: 'arith', ast: parsed });
        }
        continue;
      }
      if (tf !== null) { asts.push({ kind: 'bool', ast: { type: 'boolLit', value: tf } }); continue; }
      try { asts.push({ kind: 'bool', ast: parseBooleanExpr(text, parseArithmetic) }); continue; } catch (_) {}
      // Skip invalid
    }
    if (asts.length) bindingAstsByArc.set(key, asts);
  }
  return bindingAstsByArc;
}


