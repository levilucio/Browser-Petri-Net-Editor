// Implementation moved from utils/arith-parser.js

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

    // Optional type annotation: ": int|bool|pair|string|list"
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
        i = save; // rollback
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
    if (/[A-Za-z_]/.test(src[i])) return parseIdent();

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

  let result = parseExpr();
  skipWs();
  if (i < src.length) throw new Error(`Unexpected character '${src[i]}' at position ${i}`);
  function normalize(node) {
    if (!node || typeof node !== 'object') return node;
    if (node.type === 'bin') node.type = 'binop';
    if (node.left) node.left = normalize(node.left);
    if (node.right) node.right = normalize(node.right);
    if (Array.isArray(node.args)) node.args = node.args.map(normalize);
    if (Array.isArray(node.elements)) node.elements = node.elements.map(normalize);
    return node;
  }
  result = normalize(result);
  return result;
}

export function stringifyArithmetic(ast) {
  if (!ast) return '';

  switch (ast.type) {
    case 'int':
      return String(ast.value);
    case 'string':
      return `'${ast.value.replace(/'/g, "\\'")}'`;
    case 'list': {
      const elements = (ast.elements || []).map(stringifyArithmetic).join(', ');
      return `[${elements}]`;
    }
    case 'var':
      return ast.varType ? `${ast.name}:${ast.varType}` : ast.name;
    case 'binop': {
      const left = stringifyArithmetic(ast.left);
      const right = stringifyArithmetic(ast.right);
      return `(${left} ${ast.op} ${right})`;
    }
    case 'funcall': {
      const args = (ast.args || []).map(stringifyArithmetic).join(', ');
      return `${ast.name}(${args})`;
    }
    default:
      return '';
  }
}



