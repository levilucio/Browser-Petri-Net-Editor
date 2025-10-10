// Token consumption/production helpers used by AlgebraicSimulator

export function consumeTokens(picks, placesById) {
  const picksByPlace = new Map();
  for (const p of picks) {
    if (!p.srcId) continue;
    if (!picksByPlace.has(p.srcId)) picksByPlace.set(p.srcId, []);
    picksByPlace.get(p.srcId).push(p);
  }
  for (const [srcId, arr] of picksByPlace.entries()) {
    const place = placesById[srcId];
    if (!place) continue;
    const fallbackCount = arr.filter(p => p.countFallback).length;
    if (fallbackCount > 0) {
      const current = Number(place.tokens || 0);
      place.tokens = Math.max(0, current - fallbackCount);
    }
    const indexed = arr.filter(p => !p.countFallback);
    if (Array.isArray(place.valueTokens) && indexed.length > 0) {
      // Sort by descending index so earlier removals do not shift later ones
      indexed.sort((a, b) => b.tokenIndex - a.tokenIndex);
      for (const p of indexed) {
        if (p.tokenIndex >= 0 && p.tokenIndex < place.valueTokens.length) {
          place.valueTokens.splice(p.tokenIndex, 1);
        }
      }
      place.tokens = place.valueTokens.length;
    }
  }
}

export function produceTokens(outputArcs, bindingAstsByArc, env, placesById, evaluators) {
  const { evaluateArithmeticWithBindings, evaluateBooleanWithBindings, evaluatePatternLiteral, parseArithmetic } = evaluators;
  for (const arc of outputArcs) {
    const tgtId = arc.targetId;
    const place = placesById[tgtId];
    if (!place) continue;
    if (!Array.isArray(place.valueTokens)) place.valueTokens = [];
    const bindingAsts = bindingAstsByArc.get(arc.id) || [];
    if (bindingAsts.length > 0) {
      for (const astObj of bindingAsts) {
        try {
          let v;
          const { kind, ast } = astObj;
          if (ast && (ast.type === 'var' || ast.type === 'boolVar' || ast.type === 'pairVar')) {
            v = (env || {})[ast.name];
          } else if (kind === 'arith') {
            v = evaluateArithmeticWithBindings(ast, env);
          } else if (kind === 'bool') {
            v = evaluateBooleanWithBindings(ast, env, parseArithmetic);
          } else if (kind === 'pattern') {
            v = evaluatePatternLiteral(ast, env || {});
          } else if (kind === 'pair') {
            if (ast.type === 'pairLit') {
              v = evaluatePatternLiteral(ast, env || {});
            }
          }
          if (!Array.isArray(place.valueTokens)) place.valueTokens = [];
          if (typeof v === 'number') {
            place.valueTokens.push(v | 0);
          }
          else if (typeof v === 'boolean') {
            place.valueTokens.push(v);
          }
          else if (typeof v === 'string') {
            place.valueTokens.push(v);
          }
          else if (isPair(v)) {
            place.valueTokens.push(v);
          }
          else if (Array.isArray(v)) {
            // If it's from arith evaluation (list token), push as-is
            // If it's from tuple destructuring, spread it
            if (kind === 'arith' || kind === 'pair' || (ast && (ast.type === 'list' || ast.type === 'listPattern' || ast.type === 'tuplePattern'))) {
              place.valueTokens.push(v); // Push list as single token
            } else {
              place.valueTokens.push(...v); // Spread tuple elements
            }
          }
        } catch (e) {
          // Skip invalid bindings
        }
      }
    } else if (arc.weight && (arc.weight | 0) > 0) {
      const n = arc.weight | 0;
      for (let i = 0; i < n; i++) {
        const vals = Object.values(env || {});
        if (Array.isArray(place.valueTokens)) {
          const first = vals[0];
          place.valueTokens.push(typeof first === 'boolean' ? !!first : (Number.isFinite(first) ? (first | 0) : 1));
        } else {
          place.tokens = (Number(place.tokens || 0) + 1) | 0;
        }
      }
    } else {
      if (Array.isArray(place.valueTokens)) {
        place.valueTokens.push(1);
      } else {
        place.tokens = (Number(place.tokens || 0) + 1) | 0;
      }
    }
    if (Array.isArray(place.valueTokens)) {
      place.tokens = place.valueTokens.length;
    }
  }
}

function isPair(v) {
  return !!(v && typeof v === 'object' && v.__pair__ === true && 'fst' in v && 'snd' in v);
}


