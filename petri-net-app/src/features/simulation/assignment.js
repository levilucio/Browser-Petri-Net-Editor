// Find a satisfying assignment of input tokens for a transition

function isPair(v) {
  return !!(v && typeof v === 'object' && v.__pair__ === true && 'fst' in v && 'snd' in v);
}

export async function findSatisfyingAssignment({
  transition,
  inputArcs,
  placesById,
  bindingAstsByArc,
  guardAst,
  parseArithmetic,
  evaluateBooleanPredicate,
  matchPattern,
  getTokensForPlace,
  evaluateArithmeticWithBindings,
  evaluateBooleanWithBindings,
  evaluatePatternLiteral,
  maxTokensPerPlace = 20,
}) {
  const picks = [];

  const tryArc = async (arcIndex, env) => {
    if (arcIndex >= inputArcs.length) {
      if (!guardAst) return { env, picks };
      // Prefer pure boolean evaluation when possible (Jest/node friendly),
      // fallback to Z3 SAT if pure evaluation fails or throws
      try {
        const pureOk = evaluateBooleanWithBindings(guardAst, env || {}, parseArithmetic);
        if (!pureOk) return null;
        return { env, picks };
      } catch (err) {
        try {
          const ok = await evaluateBooleanPredicate(guardAst, env || {}, parseArithmetic);
          return ok ? { env, picks } : null;
        } catch (_) {
          throw err;
        }
      }
    }

    const arc = inputArcs[arcIndex];
    const arcId = arc.id;
    const srcId = arc.sourceId || arc.source;
    const place = placesById[srcId];
    const tokens = getTokensForPlace(place, maxTokensPerPlace);
    const bindingAsts = (bindingAstsByArc.get(arcId) || []);
    const needed = bindingAsts.length || (arc.weight ? Math.max(1, arc.weight | 0) : 0);
    if (needed === 0) return tryArc(arcIndex + 1, env);
    if (tokens.length < needed) return null;

    const used = new Array(tokens.length).fill(false);

    const tryBind = async (k, localEnv) => {
      if (k >= needed) return tryArc(arcIndex + 1, localEnv);
      for (let i = 0; i < tokens.length; i++) {
        if (used[i]) continue;
        used[i] = true;
        const tok = tokens[i];
        let ok = true;
        let nextEnv = localEnv;
        const astObj = bindingAsts[k];
        if (astObj) {
          const { kind, ast } = astObj;
          if (kind === 'pattern') {
            const bindings = matchPattern(ast, tok);
            if (bindings === null) {
              ok = false;
            } else {
              for (const [varName, varValue] of Object.entries(bindings)) {
                if (nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, varName) && nextEnv[varName] !== varValue) {
                  ok = false; break;
                }
              }
              if (ok) nextEnv = { ...(nextEnv || {}), ...bindings };
            }
          } else if (ast && (ast.type === 'var' || ast.type === 'boolVar' || ast.type === 'pairVar')) {
            if (nextEnv && Object.prototype.hasOwnProperty.call(nextEnv, ast.name) && nextEnv[ast.name] !== tok) {
              ok = false;
            } else {
              if (typeof tok === 'boolean' && ast.varType && ast.varType !== 'bool') ok = false;
              if (typeof tok === 'number' && ast.varType && ast.varType !== 'int') ok = false;
              if (typeof tok === 'string' && ast.varType && ast.varType !== 'string') ok = false;
              if (Array.isArray(tok) && ast.varType && ast.varType !== 'list') ok = false;
              if (isPair(tok) && ast.varType && ast.varType !== 'pair') ok = false;
              if (ok) nextEnv = { ...(nextEnv || {}), [ast.name]: tok };
            }
          } else if (kind === 'arith') {
            try {
              const val = evaluateArithmeticWithBindings(ast, localEnv || {});
              if (typeof tok !== 'number' || val !== (tok | 0)) ok = false;
            } catch (_) { ok = false; }
          } else if (kind === 'bool') {
            try {
              const val = evaluateBooleanWithBindings(ast, localEnv || {}, parseArithmetic);
              if (typeof tok !== 'bool' || val !== tok) ok = false;
            } catch (_) { ok = false; }
          } else if (kind === 'pair') {
            try {
              if (ast.type === 'pairLit') {
                const v = evaluatePatternLiteral(ast, localEnv || {});
                if (!isPair(tok) || JSON.stringify(v) !== JSON.stringify(tok)) ok = false;
              }
            } catch (_) { ok = false; }
          }
        }
        if (ok) {
          picks.push({ arcId: arc.id, srcId, tokenIndex: i, value: tok, countFallback: !Array.isArray(place?.valueTokens) });
          const res = await tryBind(k + 1, nextEnv);
          if (res) return res;
          picks.pop();
        }
        used[i] = false;
      }
      return null;
    };

    return tryBind(0, env || {});
  };

  return tryArc(0, {});
}


