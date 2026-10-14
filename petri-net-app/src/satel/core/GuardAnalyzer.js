/**
 * Guard Analyzer - Extract semantic conditions from transition guards
 * 
 * Analyzes guard ASTs to identify partitioning conditions:
 * - Numeric comparisons (>, <, >=, <=, ==, !=)
 * - Boolean conditions
 * - Variable constraints from bindings
 */

/**
 * Extract conditions from a guard AST
 * @param {Object} guardAst - Parsed guard AST (from cache)
 * @param {Array} inputArcs - Input arcs with bindings
 * @param {Map} bindingAstsByArc - Cached binding ASTs
 * @param {Object} options - Analysis options
 * @returns {Object} Conditions object with variables and their constraints
 */
export function analyzeGuard(guardAst, inputArcs, bindingAstsByArc, options = {}) {
  const { adtRegistry = null, placesById = null } = options;
  
  const conditions = {
    variables: new Map(), // varName -> [{type, op, value, ast}]
    hasGuard: !!guardAst,
    unbounded: [],
    sorts: new Map() // NEW: varName -> sort name
  };

  // Extract variables from input bindings first
  for (const arc of inputArcs) {
    const bindingAsts = bindingAstsByArc.get(arc.id) || [];
    for (const astObj of bindingAsts) {
      if (astObj && astObj.ast) {
        const vars = extractVariablesFromBindingAST(astObj.ast);
        for (const varName of vars) {
          if (!conditions.variables.has(varName)) {
            conditions.variables.set(varName, []);
          }
          
          // NEW: Try to infer sort from AST type annotation
          if (astObj.ast.varType) {
            conditions.sorts.set(varName, astObj.ast.varType);
          }
        }
      }
    }
  }

  // NEW: Try to infer sorts from place types
  if (adtRegistry && placesById) {
    for (const arc of inputArcs) {
      const srcId = arc.sourceId || arc.source;
      const place = placesById[srcId];
      if (place && place.sort) {
        // If place has a declared sort, use it for all variables from this arc
        const bindingAsts = bindingAstsByArc.get(arc.id) || [];
        for (const astObj of bindingAsts) {
          if (astObj && astObj.ast) {
            const vars = extractVariablesFromBindingAST(astObj.ast);
            for (const varName of vars) {
              if (!conditions.sorts.has(varName)) {
                conditions.sorts.set(varName, place.sort);
              }
            }
          }
        }
      }
    }
  }

  // Extract conditions from guard AST
  if (guardAst) {
    extractConditionsFromAST(guardAst, conditions);
  }

  // Mark unbounded variables (appear in bindings but no guard constraints)
  for (const [varName, constraints] of conditions.variables.entries()) {
    if (constraints.length === 0) {
      conditions.unbounded.push(varName);
    }
  }

  return conditions;
}

/**
 * Extract variables from a binding AST
 * @private
 */
function extractVariablesFromBindingAST(ast) {
  const vars = new Set();
  
  function traverse(node) {
    if (!node || typeof node !== 'object') return;
    
    if (node.type === 'var' || node.type === 'boolVar' || node.type === 'pairVar') {
      vars.add(node.name);
    }
    
    // Traverse child nodes
    if (node.left) traverse(node.left);
    if (node.right) traverse(node.right);
    if (node.args) node.args.forEach(traverse);
    if (node.condition) traverse(node.condition);
    if (node.then) traverse(node.then);
    if (node.else) traverse(node.else);
    if (node.fst) traverse(node.fst);
    if (node.snd) traverse(node.snd);
  }
  
  traverse(ast);
  return Array.from(vars);
}

/**
 * Extract conditions from guard AST recursively
 * @private
 */
function extractConditionsFromAST(ast, conditions) {
  if (!ast || typeof ast !== 'object') return;

  // Handle comparison operators
  if (ast.type === 'comparison') {
    const { op, left, right } = ast;
    
    // Try to identify variable and constant
    let varNode = null;
    let constValue = null;
    let actualOp = op;
    
    if (left.type === 'var' && isConstant(right)) {
      varNode = left;
      constValue = evaluateConstant(right);
    } else if (right.type === 'var' && isConstant(left)) {
      // Flip comparison: x < 5 becomes 5 > x
      varNode = right;
      constValue = evaluateConstant(left);
      actualOp = flipOperator(op);
    }
    
    if (varNode && constValue !== null) {
      if (!conditions.variables.has(varNode.name)) {
        conditions.variables.set(varNode.name, []);
      }
      conditions.variables.get(varNode.name).push({
        type: 'comparison',
        op: actualOp,
        value: constValue,
        ast: ast
      });
    }
  }
  
  // Handle boolean operators (AND, OR, NOT)
  else if (ast.type === 'and' || ast.type === 'or') {
    extractConditionsFromAST(ast.left, conditions);
    extractConditionsFromAST(ast.right, conditions);
  }
  else if (ast.type === 'not') {
    // For NOT, we'd need to flip operators - skip for MVP
    extractConditionsFromAST(ast.arg, conditions);
  }
  
  // Handle boolean variables
  else if (ast.type === 'boolVar') {
    if (!conditions.variables.has(ast.name)) {
      conditions.variables.set(ast.name, []);
    }
    conditions.variables.get(ast.name).push({
      type: 'boolean',
      value: true,
      ast: ast
    });
  }
}

/**
 * Check if an AST node is a constant value
 * @private
 */
function isConstant(node) {
  if (!node) return false;
  return node.type === 'num' || node.type === 'bool';
}

/**
 * Evaluate a constant AST node
 * @private
 */
function evaluateConstant(node) {
  if (node.type === 'num') return node.value;
  if (node.type === 'bool') return node.value;
  return null;
}

/**
 * Flip comparison operator when operands are swapped
 * @private
 */
function flipOperator(op) {
  const flips = {
    '>': '<',
    '<': '>',
    '>=': '<=',
    '<=': '>=',
    '==': '==',
    '!=': '!='
  };
  return flips[op] || op;
}

/**
 * Get all constants referenced in guard conditions
 * @param {Object} conditions - Conditions from analyzeGuard
 * @returns {Array} Sorted array of unique constants
 */
export function extractConstants(conditions) {
  const constants = new Set();
  
  for (const constraints of conditions.variables.values()) {
    for (const constraint of constraints) {
      if (typeof constraint.value === 'number') {
        constants.add(constraint.value);
      }
    }
  }
  
  return Array.from(constants).sort((a, b) => a - b);
}
