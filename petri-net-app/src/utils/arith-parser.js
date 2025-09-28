// Tiny arithmetic parser for integers with + - * / and parentheses
// Grammar (LL(1) style):
//   Expr   -> Term ((+|-) Term)*
//   Term   -> Factor ((*|/) Factor)*
//   Factor -> INT | '(' Expr ')'

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
    if (start === i) throw new Error(`Expected integer at position ${i}`);
    const text = src.slice(start, i);
    return { type: 'int', value: parseInt(text, 10) };
  }

  function isIdentStart(ch) { return /[A-Za-z_]/.test(ch); }
  function isIdentPart(ch) { return /[A-Za-z0-9_]/.test(ch); }

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
  
  // Optional type annotation: ": integer" or ": boolean" or ": pair" (case-insensitive)
    const save = i;
    skipWs();
    if (src[i] === ':') {
      i++;
      skipWs();
      const tStart = i;
      while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
      const tWord = src.slice(tStart, i).toLowerCase();
      if (tWord === 'integer' || tWord === 'boolean' || tWord === 'pair') {
        return { type: 'var', name, varType: tWord };
      } else {
        // Not a recognized type; rollback to previous position
        i = save;
        return { type: 'var', name };
      }
    }
    return { type: 'var', name };
  }

  function parseFactor() {
    skipWs();
    if (i >= src.length) throw new Error('Unexpected end of input in factor');
    const ch = src[i];
    if (ch === '(') {
      i++;
      const node = parseExpr();
      skipWs();
      if (src[i] !== ')') throw new Error(`Expected ')' at position ${i}`);
      i++;
      return node;
    }
    if (isIdentStart(ch)) {
      return parseIdent();
    }
    return parseIntLiteral();
  }

  function parseTerm() {
    let node = parseFactor();
    while (true) {
      skipWs();
      const ch = src[i];
      if (ch === '*' || ch === '/') {
        i++;
        const right = parseFactor();
        node = { type: 'bin', op: ch, left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  function parseExpr() {
    let node = parseTerm();
    while (true) {
      skipWs();
      const ch = src[i];
      if (ch === '+' || ch === '-') {
        i++;
        const right = parseTerm();
        node = { type: 'bin', op: ch, left: node, right };
      } else {
        break;
      }
    }
    return node;
  }

  const ast = parseExpr();
  skipWs();
  if (i !== src.length) {
    throw new Error(`Unexpected token '${src[i]}' at position ${i}`);
  }
  return ast;
}

export function stringifyAst(node) {
  if (!node) return '';
  if (node.type === 'int') return String(node.value);
  if (node.type === 'var') return node.name;
  return `(${stringifyAst(node.left)} ${node.op} ${stringifyAst(node.right)})`;
}

/**
 * Convert a pattern AST back to a string representation
 */
export function stringifyPattern(pattern) {
  if (!pattern) return '';
  
  switch (pattern.type) {
    case 'int':
      return String(pattern.value);
    
    case 'boolLit':
      return pattern.value ? 'T' : 'F';
    
    case 'var':
      return pattern.varType ? `${pattern.name}:${pattern.varType}` : pattern.name;
    
    case 'pairPattern':
      return `(${stringifyPattern(pattern.fst)}, ${stringifyPattern(pattern.snd)})`;
    
    case 'tuplePattern':
      return `(${pattern.components.map(stringifyPattern).join(', ')})`;
    
    default:
      throw new Error(`Unknown pattern type: ${pattern.type}`);
  }
}

/**
 * Parse pattern expressions for pattern matching and deconstruction
 * Supports patterns like (F, x), (x, y:integer), etc.
 * Generic enough to support future data types like lists, strings, etc.
 */
export function parsePattern(input) {
  if (typeof input !== 'string') throw new Error('Pattern must be a string');
  const src = input.trim();
  let i = 0;

  function isDigit(ch) { return ch >= '0' && ch <= '9'; }
  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++; }
  function isIdentStart(ch) { return /[A-Za-z_]/.test(ch); }
  function isIdentPart(ch) { return /[A-Za-z0-9_]/.test(ch); }

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
    
    // Optional type annotation: ": integer" or ": boolean" or ": pair" (case-insensitive)
    const save = i;
    skipWs();
    if (src[i] === ':') {
      i++;
      skipWs();
      const tStart = i;
      while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
      const tWord = src.slice(tStart, i).toLowerCase();
      if (tWord === 'integer' || tWord === 'boolean' || tWord === 'pair') {
        return { type: 'var', name, varType: tWord };
      } else {
        // Not a recognized type; rollback to previous position
        i = save;
        return { type: 'var', name };
      }
    }
    return { type: 'var', name };
  }

  function parseLiteral() {
    skipWs();
    if (i >= src.length) throw new Error('Unexpected end of input in literal');
    
    // Check for boolean literals first
    if (src[i] === 'T') {
      const next = src[i + 1] || '';
      if (!/[A-Za-z0-9_]/.test(next)) { i += 1; return { type: 'boolLit', value: true }; }
    }
    if (src[i] === 'F') {
      const next = src[i + 1] || '';
      if (!/[A-Za-z0-9_]/.test(next)) { i += 1; return { type: 'boolLit', value: false }; }
    }
    
    // Check for integer literals
    if (isDigit(src[i]) || (src[i] === '-' && i + 1 < src.length && isDigit(src[i + 1]))) {
      let start = i;
      if (src[i] === '-') i++;
      while (i < src.length && isDigit(src[i])) i++;
      const text = src.slice(start, i);
      return { type: 'int', value: parseInt(text, 10) };
    }
    
    // Check for structured patterns (pairs, lists, etc.)
    if (src[i] === '(') {
      i++;
      skipWs();
      const components = [];
      
      if (src[i] !== ')') {
        while (true) {
          components.push(parsePatternComponent());
          skipWs();
          if (src[i] === ')') break;
          if (src[i] === ',') {
            i++;
            skipWs();
          } else {
            throw new Error(`Expected ',' or ')' at position ${i}`);
          }
        }
      }
      i++; // consume ')'
      
      // Determine pattern type based on structure
      if (components.length === 2) {
        return { type: 'pairPattern', fst: components[0], snd: components[1] };
      } else if (components.length > 2) {
        // Future: could be list pattern, tuple pattern, etc.
        return { type: 'tuplePattern', components };
      } else {
        throw new Error('Pattern must have at least 2 components');
      }
    }
    
    // Otherwise treat as identifier
    return parseIdent();
  }

  function parsePatternComponent() {
    skipWs();
    if (i >= src.length) throw new Error('Unexpected end of input in pattern component');
    
    // Check for nested structured patterns
    if (src[i] === '(') {
      return parseLiteral(); // This will handle nested patterns
    }
    
    // Check for literals or variables
    return parseLiteral();
  }

  const ast = parsePatternComponent();
  skipWs();
  if (i !== src.length) {
    throw new Error(`Unexpected token '${src[i]}' at position ${i}`);
  }
  return ast;
}

/**
 * Match a pattern against a value and extract bindings
 * Returns null if no match, or an object with variable bindings if match succeeds
 */
export function matchPattern(pattern, value) {
  function matchComponent(pat, val) {
    switch (pat.type) {
      case 'int':
        return typeof val === 'number' && val === pat.value ? {} : null;
      
      case 'boolLit':
        return typeof val === 'boolean' && val === pat.value ? {} : null;
      
      case 'var':
        // Variable binding with type checking
        if (pat.varType) {
          if (pat.varType === 'integer' && typeof val !== 'number') return null;
          if (pat.varType === 'boolean' && typeof val !== 'boolean') return null;
          if (pat.varType === 'pair' && (!val || typeof val !== 'object' || !val.__pair__)) return null;
        }
        return { [pat.name]: val };
      
      case 'pairPattern':
        if (!val || typeof val !== 'object' || !val.__pair__) return null;
        const fstMatch = matchComponent(pat.fst, val.fst);
        const sndMatch = matchComponent(pat.snd, val.snd);
        if (fstMatch === null || sndMatch === null) return null;
        return { ...fstMatch, ...sndMatch };
      
      case 'tuplePattern':
        // Future: handle lists, tuples, etc.
        if (!Array.isArray(val) || val.length !== pat.components.length) return null;
        let bindings = {};
        for (let i = 0; i < pat.components.length; i++) {
          const compMatch = matchComponent(pat.components[i], val[i]);
          if (compMatch === null) return null;
          bindings = { ...bindings, ...compMatch };
        }
        return bindings;
      
      default:
        throw new Error(`Unknown pattern type: ${pat.type}`);
    }
  }
  
  return matchComponent(pattern, value);
}

/**
 * Validate that all variables in a pattern are properly typed
 * Returns an error message if validation fails, null if successful
 */
export function validatePatternTyping(pattern) {
  function validateComponent(pat) {
    switch (pat.type) {
      case 'var':
        // Variables must be typed when used in patterns
        if (!pat.varType) {
          return `Variable '${pat.name}' must be typed (e.g., ${pat.name}:integer, ${pat.name}:boolean, ${pat.name}:pair)`;
        }
        return null;
      
      case 'pairPattern':
        const fstError = validateComponent(pat.fst);
        if (fstError) return fstError;
        return validateComponent(pat.snd);
      
      case 'tuplePattern':
        for (const comp of pat.components) {
          const error = validateComponent(comp);
          if (error) return error;
        }
        return null;
      
      case 'int':
      case 'boolLit':
        return null; // Literals don't need typing
      
      default:
        return null;
    }
  }
  
  return validateComponent(pattern);
}

/**
 * Auto-add type annotations to untyped variables in patterns
 * Returns the pattern with type annotations added
 */
export function addTypeAnnotations(pattern, defaultType = 'integer') {
  function addTypes(pat) {
    switch (pat.type) {
      case 'var':
        if (!pat.varType) {
          return { ...pat, varType: defaultType };
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
          components: pat.components.map(addTypes)
        };
      
      default:
        return pat;
    }
  }
  
  return addTypes(pattern);
}


