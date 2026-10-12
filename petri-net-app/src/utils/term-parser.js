/**
 * Shared term parser for ADT constructors and operations
 * Handles: Job(ord, mat), High(), id(order(j)), etc.
 */

/**
 * Parse a term that may include function calls and ADT constructors
 * Returns AST node with funcall structure
 */
export function parseTerm(str) {
  str = str.trim();
  
  // Check for function call: name(...)
  const funcMatch = str.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  if (funcMatch) {
    const funcName = funcMatch[1];
    const args = [];
    
    // Find matching closing paren
    let depth = 0;
    let argStart = str.indexOf('(') + 1;
    let i = argStart;
    let currentArg = '';
    
    while (i < str.length) {
      const ch = str[i];
      if (ch === '(') {
        depth++;
        currentArg += ch;
      } else if (ch === ')') {
        if (depth === 0) {
          // End of function call
          if (currentArg.trim()) {
            args.push(parseTerm(currentArg.trim()));
          }
          break;
        }
        depth--;
        currentArg += ch;
      } else if (ch === ',' && depth === 0) {
        // Argument separator
        if (currentArg.trim()) {
          args.push(parseTerm(currentArg.trim()));
        }
        currentArg = '';
      } else {
        currentArg += ch;
      }
      i++;
    }
    
    return { type: 'funcall', name: funcName, args };
  }
  
  // Check for integer
  const intMatch = str.match(/^-?\d+$/);
  if (intMatch) {
    return { type: 'int', value: parseInt(str, 10) };
  }
  
  // Check for boolean
  if (str === 'true' || str === 'True') {
    return { type: 'boolLit', value: true };
  }
  if (str === 'false' || str === 'False') {
    return { type: 'boolLit', value: false };
  }
  
  // Check for string literal
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return { type: 'string', value: str.slice(1, -1) };
  }
  
  // Variable
  return { type: 'var', name: str };
}

/**
 * Evaluate a term AST with bindings, producing ADT objects
 */
export function evaluateTerm(ast, bindings) {
  if (!ast) return null;
  
  switch (ast.type) {
    case 'int':
      return ast.value;
    
    case 'boolLit':
      return ast.value;
    
    case 'string':
      return ast.value;
    
    case 'var':
      if (ast.name in bindings) {
        return bindings[ast.name];
      }
      throw new Error(`Unbound variable: ${ast.name}`);
    
    case 'funcall': {
      // Evaluate arguments first
      const argValues = ast.args.map(arg => evaluateTerm(arg, bindings));
      
      // Check if this is an ADT constructor (starts with uppercase or is known constructor)
      const knownConstructors = ['High', 'Normal', 'Low', 'Pass', 'Fail', 'Order', 'Material', 'Job', 'Product'];
      if (knownConstructors.includes(ast.name)) {
        // ADT constructor call
        return {
          __adt__: true,
          constructor: ast.name,
          args: argValues
        };
      }
      
      // Check if this is a field accessor
      if (argValues.length === 1 && argValues[0] && typeof argValues[0] === 'object' && argValues[0].__adt__) {
        const adt = argValues[0];
        const accessorMap = {
          'quantity': { constructor: 'Material', index: 0 },
          'order': { constructor: 'Job', index: 0 },
          'material': { constructor: 'Job', index: 1 },
          'id': { constructor: 'Order', index: 0 },
          'priority': { constructor: 'Order', index: 1 },
          'orderId': { constructor: 'Product', index: 0 },
          'quality': { constructor: 'Product', index: 1 }
        };
        
        const accessor = accessorMap[ast.name];
        if (accessor && adt.constructor === accessor.constructor && adt.args && adt.args[accessor.index] !== undefined) {
          return adt.args[accessor.index];
        }
      }
      
      throw new Error(`Unknown function or accessor: ${ast.name}`);
    }
    
    default:
      throw new Error(`Unknown AST node type: ${ast.type}`);
  }
}

/**
 * Parse and evaluate an action string
 * Format: "var1 = expr1, var2 = expr2, ..."
 */
export function evaluateActionWithTermParser(actionString, bindings) {
  if (!actionString || typeof actionString !== 'string') return {};
  
  const result = {};
  
  // Split by comma, but respect parentheses depth
  const parts = [];
  let currentPart = '';
  let depth = 0;
  
  for (let i = 0; i < actionString.length; i++) {
    const ch = actionString[i];
    if (ch === '(') {
      depth++;
      currentPart += ch;
    } else if (ch === ')') {
      depth--;
      currentPart += ch;
    } else if (ch === ',' && depth === 0) {
      parts.push(currentPart.trim());
      currentPart = '';
    } else {
      currentPart += ch;
    }
  }
  
  if (currentPart.trim()) {
    parts.push(currentPart.trim());
  }
  
  for (const part of parts) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    
    const left = part.slice(0, eqIdx).trim();
    const right = part.slice(eqIdx + 1).trim();
    
    if (!left) continue;
    
    try {
      const ast = parseTerm(right);
      result[left] = evaluateTerm(ast, bindings);
    } catch (err) {
      // Skip invalid expressions
      console.warn(`Failed to evaluate action term "${right}":`, err.message);
    }
  }
  
  return result;
}
