// Tiny arithmetic parser for ints with + - * / and parentheses
// Grammar (LL(1) style):
//   Expr   -> Term ((+|-) Term)*
//   Term   -> Factor ((*|/) Factor)*
//   Factor -> INT | '(' Expr ')'

// Import getTokensForPlace from algebraic-simulator
import { getTokensForPlace } from '../features/simulation/algebraic-simulator.js';

export function parseArithmetic(input) {
  if (typeof input !== 'string') throw new Error('Expression must be a string');
  const src = input.trim();
  let i = 0;

  function isDigit(ch) { return ch >= '0' && ch <= '9'; }
  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++; }

  function parseIntLiteral() {
    skipWs();
    let start = i;
    while (i < src.length && isDigit(src[i])) i++;
    if (start === i) throw new Error(`Expected int at position ${i}`);
    const text = src.slice(start, i);
    return { type: 'int', value: parseInt(text, 10) };
  }

  function isIdentStart(ch) { return /[A-Za-z_]/.test(ch); }
  function isIdentPart(ch) { return /[A-Za-z0-9_]/.test(ch); }

  function parseStringLiteral() {
    skipWs();
    if (src[i] !== "'") throw new Error(`Expected string literal at position ${i}`);
    i++; // skip opening quote
    let value = '';
    while (i < src.length && src[i] !== "'") {
      if (src[i] === '\\' && i + 1 < src.length) {
        i++; // skip backslash
        const next = src[i];
        if (next === 'n') value += '\n';
        else if (next === 't') value += '\t';
        else if (next === 'r') value += '\r';
        else if (next === '\\') value += '\\';
        else if (next === "'") value += "'";
        else value += next;
      } else {
        value += src[i];
      }
      i++;
    }
    if (i >= src.length) throw new Error(`Unterminated string literal`);
    i++; // skip closing quote
    return { type: 'string', value };
  }

  function parseIdent() {
    skipWs();
    let start = i;
    if (!isIdentStart(src[i])) throw new Error(`Expected identifier at position ${i}`);
    i++;
    while (i < src.length && isIdentPart(src[i])) i++;
  const name = src.slice(start, i);
  
  // Validate variable names start with lowercase to avoid T/F ambiguity
  if (name && /^[A-Z]/.test(name)) {
    throw new Error(`Variable names must start with lowercase letter, got '${name}' (use 't' instead of 'T', 'f' instead of 'F')`);
  }
  
  // Check for function call: name(args)
    skipWs();
    if (src[i] === '(') {
      i++; // consume '('
      const args = [];
      skipWs();
      if (src[i] !== ')') {
        // Parse comma-separated arguments
        do {
          skipWs();
          args.push(parseExpr());
          skipWs();
          if (src[i] === ',') {
            i++; // consume comma
          } else {
            break;
          }
        } while (i < src.length);
      }
      skipWs();
      if (src[i] !== ')') throw new Error(`Expected ')' after function arguments at position ${i}`);
      i++; // consume ')'
      return { type: 'funcall', name, args };
    }
  
  // Optional type annotation: ": int" or ": bool" or ": pair" or ": string" or ": list" (case-insensitive)
    const save = i;
    skipWs();
    if (src[i] === ':') {
      i++;
      skipWs();
      const tStart = i;
      while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
      const tWord = src.slice(tStart, i).toLowerCase();
      if (tWord === 'int' || tWord === 'bool' || tWord === 'pair' || tWord === 'string' || tWord === 'list') {
        return { type: 'var', name, varType: tWord };
      } else {
        // Not a recognized type; rollback to previous position
        i = save;
        return { type: 'var', name };
      }
    }
    return { type: 'var', name };
  }

  function parseListLiteral() {
    skipWs();
    if (src[i] !== '[') throw new Error(`Expected '[' at position ${i}`);
    i++; // skip opening bracket
    const elements = [];
    skipWs();
    
    if (src[i] === ']') {
      i++; // empty list
      return { type: 'list', elements: [] };
    }
    
    // Parse comma-separated elements
    while (i < src.length) {
      skipWs();
      elements.push(parseExpr());
      skipWs();
      
      if (src[i] === ']') {
        i++; // closing bracket
        return { type: 'list', elements };
      }
      
      if (src[i] === ',') {
        i++; // consume comma
        continue;
      }
      
      throw new Error(`Expected ',' or ']' at position ${i}`);
    }
    
    throw new Error(`Unterminated list literal`);
  }

  function parseFactor() {
    skipWs();
    if (i >= src.length) throw new Error(`Unexpected end of input at position ${i}`);
    
    if (src[i] === '(') {
      i++; // consume '('
      const expr = parseExpr();
      skipWs();
      if (i >= src.length || src[i] !== ')') throw new Error(`Expected ')' at position ${i}`);
      i++; // consume ')'
      return expr;
    }
    
    if (src[i] === '[') return parseListLiteral();
    if (src[i] === "'") return parseStringLiteral();
    if (isDigit(src[i])) return parseIntLiteral();
    if (isIdentStart(src[i])) return parseIdent();
    
    throw new Error(`Unexpected character '${src[i]}' at position ${i}`);
  }

  function parseTerm() {
    let left = parseFactor();
    skipWs();
    while (i < src.length && (src[i] === '*' || src[i] === '/')) {
      const op = src[i++];
      const right = parseFactor();
      left = { type: 'binop', op, left, right };
      skipWs();
    }
    return left;
  }

  function parseExpr() {
    let left = parseTerm();
    skipWs();
    while (i < src.length && (src[i] === '+' || src[i] === '-')) {
      const op = src[i++];
      const right = parseTerm();
      left = { type: 'binop', op, left, right };
      skipWs();
    }
    return left;
  }

  const result = parseExpr();
  skipWs();
  if (i < src.length) throw new Error(`Unexpected character '${src[i]}' at position ${i}`);
  return result;
}

export function stringifyArithmetic(ast) {
  if (!ast) return '';
  
  switch (ast.type) {
    case 'int':
      return String(ast.value);
    case 'string':
      return `'${ast.value.replace(/'/g, "\\'")}'`;
    case 'list':
      const elements = (ast.elements || []).map(stringifyArithmetic).join(', ');
      return `[${elements}]`;
    case 'var':
      return ast.varType ? `${ast.name}:${ast.varType}` : ast.name;
    case 'binop':
      const left = stringifyArithmetic(ast.left);
      const right = stringifyArithmetic(ast.right);
      return `(${left} ${ast.op} ${right})`;
    case 'funcall':
      const args = (ast.args || []).map(stringifyArithmetic).join(', ');
      return `${ast.name}(${args})`;
    default:
      return '';
  }
}

/**
 * Parse a pattern like "(F, x:Int)" or "x:Bool"
 */
export function parsePattern(input) {
  if (typeof input !== 'string') throw new Error('Pattern must be a string');
  const src = input.trim();
  let i = 0;

  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++; }

  function parsePatternElement() {
    skipWs();
    if (i >= src.length) throw new Error(`Unexpected end of input at position ${i}`);
    
    // Check for boolean literals first
    if (src.slice(i, i + 1) === 'T') {
      i++;
      return { type: 'boolLit', value: true };
    }
    if (src.slice(i, i + 1) === 'F') {
      i++;
      return { type: 'boolLit', value: false };
    }
    
    // Check for full boolean literals
    if (src.slice(i, i + 4) === 'true') {
      i += 4;
      return { type: 'boolLit', value: true };
    }
    if (src.slice(i, i + 5) === 'false') {
      i += 5;
      return { type: 'boolLit', value: false };
    }
    
    // Check for integers
    if (/[0-9]/.test(src[i])) {
      let start = i;
      while (i < src.length && /[0-9]/.test(src[i])) i++;
      const value = parseInt(src.slice(start, i), 10);
      return { type: 'int', value };
    }
    
    // Check for variables
    if (/[a-zA-Z_]/.test(src[i])) {
      let start = i;
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) i++;
      const name = src.slice(start, i);
      
      // Check for type annotation
      skipWs();
      if (src[i] === ':') {
        i++;
        skipWs();
        let tStart = i;
        while (i < src.length && /[a-zA-Z]/.test(src[i])) i++;
        const varType = src.slice(tStart, i).toLowerCase();
        if (varType === 'int' || varType === 'bool' || varType === 'pair') {
          return { type: 'var', name, varType };
        } else {
          throw new Error(`Unknown type '${varType}' at position ${tStart}`);
        }
      }
      
      return { type: 'var', name };
    }
    
    // Check for pair pattern
    if (src[i] === '(') {
      i++; // consume '('
      skipWs();
      
      const elements = [];
      while (i < src.length && src[i] !== ')') {
        elements.push(parsePatternElement());
        skipWs();
        if (i < src.length && src[i] === ',') {
          i++; // consume ','
          skipWs();
        }
      }
      
      if (i >= src.length || src[i] !== ')') {
        throw new Error(`Expected ')' at position ${i}`);
      }
      i++; // consume ')'
      
      if (elements.length === 2) {
        return { type: 'pairPattern', fst: elements[0], snd: elements[1] };
      } else {
        return { type: 'tuplePattern', elements };
      }
    }
    
    throw new Error(`Unexpected character '${src[i]}' at position ${i}`);
  }

  const result = parsePatternElement();
  skipWs();
  if (i < src.length) throw new Error(`Unexpected character '${src[i]}' at position ${i}`);
  return result;
}

/**
 * Match a pattern against a value and extract bindings
 */
export function matchPattern(pattern, value) {
  const bindings = new Map();
  
  function matchElement(pat, val) {
    switch (pat.type) {
      case 'int':
        if (typeof val !== 'number' || val !== pat.value) {
          return false; // Pattern matching failed
        }
        return true;
        
      case 'boolLit':
        if (typeof val !== 'boolean' || val !== pat.value) {
          return false; // Pattern matching failed
        }
        return true;
        
      case 'var':
        // Check type annotation if present
        if (pat.varType) {
          const expectedType = pat.varType;
          if (expectedType === 'int' && typeof val !== 'number') {
            return false; // Type mismatch: expected int, got something else
          }
          if (expectedType === 'bool' && typeof val !== 'boolean') {
            return false; // Type mismatch: expected bool, got something else
          }
          if (expectedType === 'string' && typeof val !== 'string') {
            return false; // Type mismatch: expected string, got something else
          }
          if (expectedType === 'list' && !Array.isArray(val)) {
            return false; // Type mismatch: expected list, got something else
          }
          if (expectedType === 'pair' && (!val || typeof val !== 'object' || !val.__pair__)) {
            return false; // Type mismatch: expected pair, got something else
          }
        }
        
        if (bindings.has(pat.name)) {
          const boundValue = bindings.get(pat.name);
          if (boundValue !== val) {
            return false; // Variable already bound to different value
          }
        } else {
          bindings.set(pat.name, val);
        }
        return true;
        
      case 'pairPattern':
        if (!val || typeof val !== 'object' || !val.__pair__) {
          return false; // Expected pair but got something else
        }
        if (!matchElement(pat.fst, val.fst) || !matchElement(pat.snd, val.snd)) {
          return false; // Sub-pattern matching failed
        }
        return true;
        
      case 'tuplePattern':
        if (!Array.isArray(val) || val.length !== pat.elements.length) {
          return false; // Wrong tuple length
        }
        for (let index = 0; index < pat.elements.length; index++) {
          if (!matchElement(pat.elements[index], val[index])) {
            return false; // Sub-pattern matching failed
          }
        }
        return true;
        
      default:
        return false; // Unknown pattern type
    }
  }
  
  const success = matchElement(pattern, value);
  return success ? Object.fromEntries(bindings) : null;
}

/**
 * Validate that all variables in a pattern have explicit type annotations
 */
export function validatePatternTyping(pattern) {
  function validateComponent(pat) {
    switch (pat.type) {
      case 'var':
        // Variables must be typed when used in patterns
        if (!pat.varType) {
          return `Variable '${pat.name}' must be typed (e.g., ${pat.name}:int, ${pat.name}:bool, ${pat.name}:pair)`;
        }
        return null;
      case 'pairPattern':
      case 'tuplePattern':
        const elements = pat.type === 'pairPattern' ? [pat.fst, pat.snd] : pat.elements;
        for (const elem of elements) {
          const error = validateComponent(elem);
          if (error) return error;
        }
        return null;
      default:
        return null;
    }
  }
  
  return validateComponent(pattern);
}

/**
 * Add default type annotations to untyped variables in a pattern
 */
export function addTypeAnnotations(pattern, defaultType = 'Int') {
  function addTypes(pat) {
    switch (pat.type) {
      case 'var':
        if (!pat.varType) {
          return { ...pat, varType: defaultType.toLowerCase() };
        }
        return pat;
      case 'pairPattern':
        return {
          ...pat,
          fst: addTypes(pat.fst),
          snd: addTypes(pat.snd)
        };
      case 'tuplePattern':
        return {
          ...pat,
          elements: pat.elements.map(addTypes)
        };
      default:
        return pat;
    }
  }
  
  return addTypes(pattern);
}

/**
 * Convert a pattern AST back to a string
 */
export function stringifyPattern(pattern) {
  function stringifyElement(elem) {
    switch (elem.type) {
      case 'int':
        return String(elem.value);
      case 'boolLit':
        return elem.value ? 'T' : 'F';
      case 'var':
        return elem.varType ? `${elem.name}:${elem.varType.charAt(0).toUpperCase() + elem.varType.slice(1)}` : elem.name;
      case 'pairPattern':
        return `(${stringifyElement(elem.fst)}, ${stringifyElement(elem.snd)})`;
      case 'tuplePattern':
        return `(${elem.elements.map(stringifyElement).join(', ')})`;
      default:
        return '';
    }
  }
  
  return stringifyElement(pattern);
}

/**
 * Capitalize type names in a binding string for display
 */
export function capitalizeTypeNames(bindingString) {
  return bindingString
    .replace(/:int\b/g, ':Int')
    .replace(/:bool\b/g, ':Bool')
    .replace(/:pair\b/g, ':Pair');
}

/**
 * Infer the type of a token value
 */
export function inferTokenType(token) {
  if (typeof token === 'number') return 'Int';
  if (typeof token === 'boolean') return 'Bool';
  if (typeof token === 'string') return 'String';
  if (Array.isArray(token)) return 'List';
  if (token && typeof token === 'object' && token.__pair__) return 'Pair';
  return 'Int'; // Default fallback
}

/**
 * Infer types for variables based on the context of an arc or transition
 * This function analyzes the entire variable flow chain: input bindings → guard → output bindings
 */
export function inferVariableTypes(elementType, selectedElement, elements) {
  const typeMap = new Map();
  
  if (!selectedElement || !elements) {
    return typeMap;
  }
  
  if (elementType === 'arc') {
    // For arcs, we need to analyze the entire transition chain
    const transition = elements.transitions.find(t => 
      elements.arcs.some(arc => arc.id === selectedElement.id && 
        (arc.source === t.id || arc.target === t.id))
    );
    
    if (transition) {
      // Get all types from the entire transition chain
      const chainTypeMap = analyzeTransitionChain(transition, elements);
      chainTypeMap.forEach((type, varName) => {
        typeMap.set(varName, type);
      });
    }
    
    // Fallback: infer from source place tokens if no chain analysis available
    if (typeMap.size === 0) {
      const sourcePlace = elements.places.find(p => p.id === selectedElement.source);
      let tokenType = 'Int'; // Default fallback type
      
      if (sourcePlace) {
        // Use getTokensForPlace to handle both valueTokens and tokens count
        const tokens = getTokensForPlace(sourcePlace);
        if (tokens.length > 0) {
          tokenType = inferTokenType(tokens[0]);
        }
      }
      
      // Process bindings with fallback type
      if (selectedElement.bindings && selectedElement.bindings.length > 0) {
        selectedElement.bindings.forEach(binding => {
          extractVariablesFromBinding(binding, tokenType, typeMap);
        });
      }
    }
  } else if (elementType === 'transition') {
    // For transitions, analyze the entire chain
    const chainTypeMap = analyzeTransitionChain(selectedElement, elements);
    chainTypeMap.forEach((type, varName) => {
      typeMap.set(varName, type);
    });
  }
  
  return typeMap;
}

/**
 * Analyze the entire transition chain to infer variable types
 * Chain: input arcs → guard → output arcs
 */
function analyzeTransitionChain(transition, elements) {
  const typeMap = new Map();
  
  // Step 1: Collect types from input arcs (from tokens)
  const inputArcs = elements.arcs.filter(arc => arc.target === transition.id);
  inputArcs.forEach(arc => {
    const sourcePlace = elements.places.find(p => p.id === arc.source);
    if (sourcePlace) {
      // Use getTokensForPlace to handle both valueTokens and tokens count
      const tokens = getTokensForPlace(sourcePlace);
      if (tokens.length > 0) {
        const tokenType = inferTokenType(tokens[0]);
        
        if (arc.bindings && arc.bindings.length > 0) {
          arc.bindings.forEach(binding => {
            extractVariablesFromBinding(binding, tokenType, typeMap);
          });
        }
      }
    }
  });
  
  // Step 2: Extract types from guard (from already typed variables)
  if (transition.guard) {
    extractTypesFromExpression(transition.guard, typeMap);
  }
  
  // Step 3: Extract types from output arcs (from already typed variables)
  const outputArcs = elements.arcs.filter(arc => arc.source === transition.id);
  outputArcs.forEach(arc => {
    if (arc.bindings && arc.bindings.length > 0) {
      arc.bindings.forEach(binding => {
        extractTypesFromExpression(binding, typeMap);
      });
    }
  });
  
  // Step 4: Propagate types from input arcs to output arcs
  // This ensures that variables used in output arcs can inherit types from input arcs
  propagateTypesThroughChain(inputArcs, outputArcs, transition, typeMap, elements);
  
  return typeMap;
}

/**
 * Extract variables from a binding and assign them a type
 */
function extractVariablesFromBinding(binding, defaultType, typeMap) {
  try {
    const pattern = parsePattern(binding);
    extractVariablesFromPattern(pattern).forEach(varName => {
      if (!typeMap.has(varName)) {
        typeMap.set(varName, defaultType);
      }
    });
  } catch (e) {
    // If parsing fails, try to extract variables from plain text
    const varMatches = binding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
    if (varMatches) {
      varMatches.forEach(varName => {
        if (varName !== 'true' && varName !== 'false' && !typeMap.has(varName)) {
          typeMap.set(varName, defaultType);
        }
      });
    }
  }
}

/**
 * Extract types from expressions (guards, bindings) that may already have typed variables
 */
function extractTypesFromExpression(expression, typeMap) {
  // Look for patterns like "x:Int", "y:Bool", etc.
  const typedVarMatches = expression.match(/\b([a-z][a-zA-Z0-9_]*):(Int|Bool|Pair|String|List)\b/g);
  if (typedVarMatches) {
    typedVarMatches.forEach(match => {
      const [, varName, varType] = match.match(/\b([a-z][a-zA-Z0-9_]*):(Int|Bool|Pair|String|List)\b/);
      if (!typeMap.has(varName)) {
        typeMap.set(varName, varType);
      }
    });
  }
}

/**
 * Propagate types through the transition chain
 * This ensures that if a variable is typed in one part, it's available in other parts
 */
function propagateTypesThroughChain(inputArcs, outputArcs, transition, typeMap, elements) {
  // Extract all variable names that appear in output arcs
  const outputVariables = new Set();
  outputArcs.forEach(arc => {
    if (arc.bindings && arc.bindings.length > 0) {
      arc.bindings.forEach(binding => {
        try {
          const pattern = parsePattern(binding);
          extractVariablesFromPattern(pattern).forEach(varName => {
            outputVariables.add(varName);
          });
        } catch (e) {
          // If parsing fails, try to extract variables from plain text
          const varMatches = binding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
          if (varMatches) {
            varMatches.forEach(varName => {
              if (varName !== 'true' && varName !== 'false') {
                outputVariables.add(varName);
              }
            });
          }
        }
      });
    }
  });
  
  // For each variable in output arcs, if it's not already typed,
  // try to infer its type from the input arcs
  outputVariables.forEach(varName => {
    if (!typeMap.has(varName)) {
      // Look for this variable in input arcs
      inputArcs.forEach(arc => {
        const sourcePlace = elements.places.find(p => p.id === arc.source);
        if (sourcePlace) {
          // Use getTokensForPlace to handle both valueTokens and tokens count
          const tokens = getTokensForPlace(sourcePlace);
          if (tokens.length > 0) {
            const tokenType = inferTokenType(tokens[0]);
            
            if (arc.bindings && arc.bindings.length > 0) {
              arc.bindings.forEach(binding => {
                try {
                  const pattern = parsePattern(binding);
                  extractVariablesFromPattern(pattern).forEach(inputVarName => {
                    if (inputVarName === varName && !typeMap.has(varName)) {
                      typeMap.set(varName, tokenType);
                    }
                  });
                } catch (e) {
                  // If parsing fails, try to extract variables from plain text
                  const varMatches = binding.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
                  if (varMatches) {
                    varMatches.forEach(inputVarName => {
                      if (inputVarName === varName && inputVarName !== 'true' && inputVarName !== 'false' && !typeMap.has(varName)) {
                        typeMap.set(varName, tokenType);
                      }
                    });
                  }
                }
              });
            }
          }
        }
      });
    }
  });
}

/**
 * Extract variable names from a pattern AST
 */
function extractVariablesFromPattern(pattern) {
  const variables = [];
  
  function traverse(node) {
    if (!node) return;
    
    switch (node.type) {
      case 'var':
        variables.push(node.name);
        break;
      case 'pairPattern':
        if (node.fst) traverse(node.fst);
        if (node.snd) traverse(node.snd);
        break;
      case 'tuplePattern':
        if (node.elements) {
          node.elements.forEach(traverse);
        }
        break;
      // Add more cases as needed for other pattern types
    }
  }
  
  traverse(pattern);
  return variables;
}

/**
 * Auto-annotate variables in a pattern or expression with inferred types
 */
export function autoAnnotateTypes(input, typeMap, defaultType = null) {
  if (!input) return input;
  
  // If no typeMap provided and no defaultType, don't annotate anything
  if ((!typeMap || typeMap.size === 0) && !defaultType) return input;
  
  // Simple regex-based approach for now
  let result = input;
  
  // Extract all variables from the input
  const varMatches = input.match(/\b[a-z][a-zA-Z0-9_]*\b/g);
  if (varMatches) {
    varMatches.forEach(varName => {
      // Skip boolean literals, operators, and variables that already have types
      if (varName !== 'true' && varName !== 'false' && 
          varName !== 'and' && varName !== 'or' && varName !== 'not' &&
          !input.includes(`${varName}:`)) {
        const varType = typeMap.get(varName) || defaultType;
        if (varType) {
          const pattern = new RegExp(`\\b${varName}(?!:)\\b`, 'g');
          result = result.replace(pattern, `${varName}:${varType}`);
        }
      }
    });
  }
  
  return result;
}

