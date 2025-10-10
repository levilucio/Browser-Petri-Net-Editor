// Utilities for guard and binding variable analysis in the algebraic simulator

export function extractVariablesFromPattern(ast) {
  const variables = new Set();

  function traverse(node) {
    if (!node) return;

    switch (node.type) {
      case 'var':
        variables.add(node.name);
        break;
      case 'pairPattern':
        traverse(node.fst);
        traverse(node.snd);
        break;
      case 'listPattern':
        if (Array.isArray(node.elements)) {
          node.elements.forEach(traverse);
        }
        break;
      case 'tuplePattern':
        if (node.elements) {
          node.elements.forEach(traverse);
        }
        break;
      default:
        break;
    }
  }

  traverse(ast);
  return Array.from(variables);
}

export function extractVariablesFromExpression(ast) {
  const variables = new Set();

  function traverse(node) {
    if (!node) return;

    switch (node.type) {
      case 'var':
      case 'boolVar':
      case 'pairVar':
        variables.add(node.name);
        break;
      case 'binop':
      case 'cmp':
        traverse(node.left);
        traverse(node.right);
        break;
      case 'unop':
        traverse(node.operand);
        break;
      case 'call':
        if (node.args) {
          node.args.forEach(traverse);
        }
        break;
      case 'pairPattern':
        traverse(node.fst);
        traverse(node.snd);
        break;
      case 'tuplePattern':
        if (node.elements) {
          node.elements.forEach(traverse);
        }
        break;
      case 'pairLit':
        traverse(node.fst);
        traverse(node.snd);
        break;
      default:
        break;
    }
  }

  traverse(ast);
  return Array.from(variables);
}

// Returns true when unbound variables are detected (transition should be disabled)
export function checkForUnboundVariables(petriNet, bindingAstsByArc, guardAstByTransition, transitionId, inputArcs) {
  // Get all variables that can be bound from input arcs
  const boundVariables = new Set();

  // Collect variables from input arc bindings (including nested variables in patterns)
  for (const arc of inputArcs) {
    const bindingAsts = (bindingAstsByArc.get(arc.id) || []);
    for (const astObj of bindingAsts) {
      const { kind, ast } = astObj || {};
      if (kind === 'pattern') {
        const variables = extractVariablesFromPattern(ast);
        variables.forEach(varName => boundVariables.add(varName));
      }
    }
  }

  // Check guard for unbound variables
  const guardAst = guardAstByTransition.get(transitionId);
  if (guardAst) {
    const guardVars = extractVariablesFromExpression(guardAst);
    for (const varName of guardVars) {
      if (!boundVariables.has(varName)) {
        return true; // Has unbound variables
      }
    }
  }

  // Check output arcs for unbound variables and empty bindings
  const outputArcs = (petriNet.arcs || []).filter(a => a.sourceId === transitionId && (a.targetType === 'place' || !a.targetType));
  for (const arc of outputArcs) {
    const bindingAsts = bindingAstsByArc.get(arc.id) || [];
    // If output arc has no bindings at all, disable transition (no token can be produced)
    if (bindingAsts.length === 0) {
      return true; // Disable transition
    }
    for (const astObj of bindingAsts) {
      const { kind, ast } = astObj || {};
      if (kind === 'pattern' && ast.type === 'var') {
        // Only check variables - literals like 'int', 'boolLit', 'pairPattern' are always valid
        if (!boundVariables.has(ast.name)) {
          return true; // Has unbound variables
        }
      }
    }
  }

  return false; // No unbound variables and all output arcs have bindings
}


