// Evaluate pattern-style literals to concrete JS values using an env
// Supports pairPattern, tuplePattern, listPattern, boolLit, int, var/boolVar/pairVar

export function evaluatePatternLiteral(node, env) {
  if (!node) return null;
  switch (node.type) {
    case 'pairLit':
      return { __pair__: true, fst: evaluatePatternLiteral(node.fst, env), snd: evaluatePatternLiteral(node.snd, env) };
    case 'list':
      return (node.elements || []).map(n => evaluatePatternLiteral(n, env));
    case 'pairPattern':
      return { __pair__: true, fst: evaluatePatternLiteral(node.fst, env), snd: evaluatePatternLiteral(node.snd, env) };
    case 'tuplePattern':
      return (node.elements || node.components || []).map(n => evaluatePatternLiteral(n, env));
    case 'listPattern':
      return (node.elements || []).map(n => evaluatePatternLiteral(n, env));
    case 'boolLit':
      return !!node.value;
    case 'int':
      return (node.value | 0);
    case 'var':
    case 'boolVar':
    case 'pairVar':
      return (env || {})[node.name];
    default:
      return null;
  }
}


