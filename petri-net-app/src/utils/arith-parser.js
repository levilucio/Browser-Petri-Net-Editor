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
    // Optional type annotation: ": integer" or ": boolean" (case-insensitive)
    const save = i;
    skipWs();
    if (src[i] === ':') {
      i++;
      skipWs();
      const tStart = i;
      while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
      const tWord = src.slice(tStart, i).toLowerCase();
      if (tWord === 'integer' || tWord === 'boolean') {
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


