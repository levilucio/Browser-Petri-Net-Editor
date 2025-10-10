// Type compatibility checks for output bindings

export function ensureOutputBindingsTypeCompatible(petriNet, cache, transitionId, env) {
  try {
    const outputArcs = (petriNet.arcs || []).filter(a => a.sourceId === transitionId && (a.targetType === 'place' || !a.targetType));
    for (const arc of outputArcs) {
      const bindingAsts = cache?.bindingAstsByArc?.get(arc.id) || [];
      for (const astObj of bindingAsts) {
        const { ast } = astObj || {};
        if (!ast) continue;
        // Only check variables with type annotations; literals and untyped variables are fine
        if (ast.type === 'var' || ast.type === 'boolVar' || ast.type === 'pairVar') {
          const v = env ? env[ast.name] : undefined;
          if (v === undefined) continue; // may be filled later by action/guard
          const t = ast.varType;
          if (t === 'int' && typeof v !== 'number') return false;
          if (t === 'bool' && typeof v !== 'boolean') return false;
          if (t === 'string' && typeof v !== 'string') return false;
          if (t === 'pair' && !(v && typeof v === 'object' && v.__pair__ === true)) return false;
          if (t === 'list' && !Array.isArray(v)) return false;
        }
      }
    }
    return true;
  } catch (_) {
    return false;
  }
}


