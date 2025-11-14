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

function containsOperationCall(text, ops) {
  if (!text) return false;
  const len = text.length;
  for (let i = 0; i < len; i += 1) {
    const ch = text[i];
    if (!/[A-Za-z_]/.test(ch)) continue;
    let j = i + 1;
    while (j < len && /[A-Za-z0-9_]/.test(text[j])) j += 1;
    const ident = text.slice(i, j);
    if (ops.has(ident)) {
      let k = j;
      while (k < len && /\s/.test(text[k])) k += 1;
      if (k < len && text[k] === '(') {
        return true;
      }
    }
    i = j - 1;
  }
  return false;
}

export function buildBindingCache(petriNet, parsePattern, parseArithmetic, parseBooleanExpr, allowedOps) {
  const bindingAstsByArc = new Map();
  for (const a of (petriNet.arcs || [])) {
    const key = a.id;
    const bindings = Array.isArray(a.bindings) ? a.bindings : (a.binding ? [a.binding] : []);
    const asts = [];
    for (const b of bindings) {
      const text = String(b);

      const trimmed = text.trim();
      const preferArithmetic = containsOperationCall(trimmed, allowedOps);

      const isAllowedFuncall = (node) => {
        if (!node || typeof node !== 'object') return true;
        switch (node.type) {
          case 'funcall':
            if (!allowedOps.has(node.name)) return false;
            return (node.args || []).every(isAllowedFuncall);
          case 'pair':
            return isAllowedFuncall(node.fst) && isAllowedFuncall(node.snd);
          case 'list':
            return (node.elements || []).every(isAllowedFuncall);
          case 'binop':
            return isAllowedFuncall(node.left) && isAllowedFuncall(node.right);
          default:
            return true;
        }
      };

      const tryArithmetic = () => {
        let parsed = null;
        try { parsed = parseArithmetic(text); } catch (_) { parsed = null; }
        if (!parsed) return false;
        if (!isAllowedFuncall(parsed)) return false;
        if (parsed.type === 'var' && parsed.varType === 'bool') {
          asts.push({ kind: 'bool', ast: { type: 'boolVar', name: parsed.name, varType: 'bool' } });
        } else if (parsed.type === 'var' && parsed.varType === 'pair') {
          asts.push({ kind: 'pair', ast: { type: 'pairVar', name: parsed.name, varType: 'pair' } });
        } else {
          asts.push({ kind: 'arith', ast: parsed });
        }
        return true;
      };

      const tryPattern = () => {
        try {
          const pattern = parsePattern(text);
          asts.push({ kind: 'pattern', ast: pattern });
          return true;
        } catch (_) {
          return false;
        }
      };

      let handled = false;
      if (preferArithmetic) {
        handled = tryArithmetic();
        if (!handled) handled = tryPattern();
      } else {
        handled = tryPattern();
        if (!handled) handled = tryArithmetic();
      }

      if (handled) continue;

      // Prefer arithmetic, but if variable annotated as bool, store as bool kind
      const tf = (text === 'T') ? true : (text === 'F') ? false : null;
      if (tf !== null) { asts.push({ kind: 'bool', ast: { type: 'boolLit', value: tf } }); continue; }
      try { asts.push({ kind: 'bool', ast: parseBooleanExpr(text, parseArithmetic) }); continue; } catch (_) {}
      // Skip invalid
    }
    if (asts.length) bindingAstsByArc.set(key, asts);
  }
  return bindingAstsByArc;
}


