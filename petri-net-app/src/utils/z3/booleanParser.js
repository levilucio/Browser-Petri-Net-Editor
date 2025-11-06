export function parsePredicate(expr, parseArithmetic) {
  if (typeof expr !== 'string') throw new Error('Predicate must be a string');
  const src = expr.trim();
  const ops = ['>=', '<=', '==', '!=', '>', '<'];
  let depth = 0;
  let opIndex = -1;
  let foundOp = null;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (depth !== 0) continue;
    const two = src.slice(i, i + 2);
    if (ops.includes(two)) {
      foundOp = two;
      opIndex = i;
      break;
    }
    if (ops.includes(ch)) {
      foundOp = ch;
      opIndex = i;
      break;
    }
  }

  if (!foundOp || opIndex < 0) {
    throw new Error('Predicate must contain a comparison operator');
  }

  const leftStr = src.slice(0, opIndex).trim();
  const rightStr = src.slice(opIndex + foundOp.length).trim();
  const leftAst = parseArithmetic(leftStr);
  const rightAst = parseArithmetic(rightStr);
  return { type: 'cmp', op: foundOp, left: leftAst, right: rightAst };
}

export function parseBooleanExpr(input, parseArithmetic) {
  if (typeof input !== 'string') {
    throw new Error('Boolean expression must be a string');
  }

  const src = input.trim();
  let i = 0;

  const skipWs = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };

  const isWordBoundaryAt = (pos, len) =>
    (pos === 0 || /[^A-Za-z0-9_]/.test(src[pos - 1] || '')) &&
    (pos + len === src.length || /[^A-Za-z0-9_]/.test(src[pos + len] || ''));

  const startsWithWord = (word) => {
    skipWs();
    return (
      src.slice(i, i + word.length).toLowerCase() === word &&
      isWordBoundaryAt(i, word.length)
    );
  };

  const parseIdentWithOptionalType = () => {
    skipWs();
    const start = i;
    if (!/[A-Za-z_]/.test(src[i] || '')) {
      throw new Error(`Expected identifier at position ${i}`);
    }
    i++;
    while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
    const name = src.slice(start, i);
    if (name && /^[A-Z]/.test(name)) {
      throw new Error(`Variable names must start with lowercase letter, got '${name}'`);
    }
    const save = i;
    skipWs();
    if (src[i] === ':') {
      i++;
      skipWs();
      const tStart = i;
      while (i < src.length && /[A-Za-z]/.test(src[i])) i++;
      const tWord = src.slice(tStart, i).toLowerCase();
      if (tWord === 'int' || tWord === 'bool' || tWord === 'pair') {
        return { name, varType: tWord };
      }
      i = save;
      return { name };
    }
    return { name };
  };

  const parseAnyTermString = (s) => {
    const term = String(s || '').trim();
    if (/^true$/i.test(term) || term === 'T') return { type: 'boolLit', value: true };
    if (/^false$/i.test(term) || term === 'F') return { type: 'boolLit', value: false };
    if (/^-?\d+$/.test(term)) return { type: 'int', value: parseInt(term, 10) };

    if (term.startsWith('(') && term.endsWith(')')) {
      const inner = term.slice(1, -1).trim();
      let depth = 0;
      let splitAt = -1;
      for (let k = 0; k < inner.length; k++) {
        const ch = inner[k];
        if (ch === '(') depth++;
        else if (ch === ')') depth = Math.max(0, depth - 1);
        else if (ch === ',' && depth === 0) {
          splitAt = k;
          break;
        }
      }
      if (splitAt >= 0) {
        const leftStr = inner.slice(0, splitAt).trim();
        const rightStr = inner.slice(splitAt + 1).trim();
        if (leftStr.length && rightStr.length) {
          return {
            type: 'pairLit',
            fst: parseAnyTermString(leftStr),
            snd: parseAnyTermString(rightStr),
          };
        }
      }
    }

    try {
      if (typeof parseArithmetic === 'function') {
        return parseArithmetic(term);
      }
    } catch (_) {}

    const m = term.match(/^([A-Za-z_][A-Za-z0-9_]*)(?::([A-Za-z]+))?$/);
    if (!m) throw new Error(`Unrecognized term '${term}'`);
    const name = m[1];
    if (name && /^[A-Z]/.test(name)) {
      throw new Error(`Variable names must start with lowercase letter, got '${name}'`);
    }
    const tWord = (m[2] || '').toLowerCase();
    if (tWord === 'bool') return { type: 'boolVar', name, varType: 'bool' };
    if (tWord === 'pair') return { type: 'pairVar', name, varType: 'pair' };
    return { type: 'var', name };
  };

  const parseBoolPrimary = () => {
    skipWs();
    if (i >= src.length) throw new Error('Unexpected end');

    if (src[i] === 'T' && isWordBoundaryAt(i, 1)) {
      i += 1;
      return { type: 'boolLit', value: true };
    }
    if (src[i] === 'F' && isWordBoundaryAt(i, 1)) {
      i += 1;
      return { type: 'boolLit', value: false };
    }
    if (startsWithWord('true')) {
      i += 4;
      return { type: 'boolLit', value: true };
    }
    if (startsWithWord('false')) {
      i += 5;
      return { type: 'boolLit', value: false };
    }

    if (src.slice(i).startsWith('isSubstringOf')) {
      i += 'isSubstringOf'.length;
      skipWs();
      if (src[i] !== '(') throw new Error(`Expected '('`);
      let startArgs = i + 1;
      let d = 1;
      i++;
      for (; i < src.length && d > 0; i++) {
        const ch = src[i];
        if (ch === '(') d++;
        else if (ch === ')') d--;
      }
      if (d !== 0) throw new Error('Unterminated isSubstringOf arguments');
      const inside = src.slice(startArgs, i - 1).trim();
      let depth = 0;
      let cur = '';
      const parts = [];
      for (let k = 0; k < inside.length; k++) {
        const ch = inside[k];
        if (ch === '(') {
          depth++;
          cur += ch;
          continue;
        }
        if (ch === ')') {
          depth = Math.max(0, depth - 1);
          cur += ch;
          continue;
        }
        if (ch === ',' && depth === 0) {
          parts.push(cur.trim());
          cur = '';
          continue;
        }
        cur += ch;
      }
      if (cur.trim().length) parts.push(cur.trim());
      if (parts.length !== 2) throw new Error('isSubstringOf expects two arguments');
      const a0 = parseArithmetic(parts[0]);
      const a1 = parseArithmetic(parts[1]);
      return { type: 'boolFuncall', name: 'isSubstringOf', args: [a0, a1] };
    }

    const ops = ['>=', '<=', '==', '!=', '>', '<'];
    let depth = 0;
    let opIndex = -1;
    let foundOp = null;

    for (let j = i; j < src.length; j++) {
      const ch = src[j];
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (depth !== 0) continue;

      if (src.slice(j, j + 3) === '<->') {
        j += 2;
        continue;
      }
      if (src.slice(j, j + 2) === '->') {
        j += 1;
        continue;
      }

      const two = src.slice(j, j + 2);
      if (ops.includes(two)) {
        foundOp = two;
        opIndex = j;
        break;
      }
      if (ops.includes(ch)) {
        foundOp = ch;
        opIndex = j;
        break;
      }
    }

    if (foundOp && opIndex >= 0) {
      const leftStr = src.slice(i, opIndex).trim();
      const afterOp = opIndex + foundOp.length;
      let end = src.length;
      depth = 0;

      const wordBoundary = (pos, len) =>
        (pos === 0 || /[^A-Za-z0-9_]/.test(src[pos - 1] || '')) &&
        (pos + len === src.length || /[^A-Za-z0-9_]/.test(src[pos + len] || ''));

      const isTopLevelLogicAt = (pos) => {
        const rest = src.slice(pos);
        const LOGIC_SYMS = ['&&', '||', '^', '->', '<->'];
        const LOGIC_WORDS = ['and', 'or', 'xor', 'implies', 'iff'];
        for (const sym of LOGIC_SYMS) {
          if (rest.startsWith(sym)) return true;
        }
        for (const word of LOGIC_WORDS) {
          if (rest.toLowerCase().startsWith(word) && wordBoundary(pos, word.length)) {
            return true;
          }
        }
        return false;
      };

      for (let k = afterOp; k < src.length; k++) {
        const ch2 = src[k];
        if (ch2 === '(') {
          depth++;
          continue;
        }
        if (ch2 === ')') {
          if (depth === 0) {
            end = k;
            break;
          }
          depth = Math.max(0, depth - 1);
          continue;
        }
        if (depth !== 0) continue;
        if (isTopLevelLogicAt(k)) {
          end = k;
          break;
        }
      }

      const rightStr = src.slice(afterOp, end).trim();
      const leftAst = parseAnyTermString(leftStr);
      const rightAst = parseAnyTermString(rightStr);
      i = end;
      return { type: 'cmp', op: foundOp, left: leftAst, right: rightAst };
    }

    if (src[i] === '(') {
      i++;
      const node = parseIff();
      skipWs();
      if (src[i] !== ')') throw new Error(`Expected ')' at ${i}`);
      i++;
      return node;
    }

    const { name, varType } = parseIdentWithOptionalType();
    return varType ? { type: 'boolVar', name, varType } : { type: 'boolVar', name };
  };

  const OP_WORDS = {
    not: ['not'],
    and: ['and'],
    xor: ['xor'],
    or: ['or'],
    implies: ['implies'],
    iff: ['iff'],
  };
  const OP_SYMS = {
    not: ['!'],
    and: ['&&'],
    xor: ['^'],
    or: ['||'],
    implies: ['->'],
    iff: ['<->'],
  };

  const tryConsumeSymbolOrWord = (symbols, words) => {
    skipWs();
    for (const s of symbols) {
      if (src.slice(i, i + s.length) === s) {
        i += s.length;
        return true;
      }
    }
    for (const w of words) {
      if (src.slice(i, i + w.length).toLowerCase() === w && isWordBoundaryAt(i, w.length)) {
        i += w.length;
        return true;
      }
    }
    return false;
  };

  const parseNot = () => {
    skipWs();
    if (tryConsumeSymbolOrWord(OP_SYMS.not, OP_WORDS.not)) {
      const expr = parseNot();
      return { type: 'not', expr };
    }
    return parseBoolPrimary();
  };

  const parseAnd = () => {
    let node = parseNot();
    while (true) {
      skipWs();
      if (tryConsumeSymbolOrWord(OP_SYMS.and, OP_WORDS.and)) {
        const right = parseNot();
        node = { type: 'and', left: node, right };
      } else {
        break;
      }
    }
    return node;
  };

  const parseXor = () => {
    let node = parseAnd();
    while (true) {
      skipWs();
      if (tryConsumeSymbolOrWord(OP_SYMS.xor, OP_WORDS.xor)) {
        const right = parseAnd();
        node = { type: 'xor', left: node, right };
      } else {
        break;
      }
    }
    return node;
  };

  const parseOr = () => {
    let node = parseXor();
    while (true) {
      skipWs();
      if (tryConsumeSymbolOrWord(OP_SYMS.or, OP_WORDS.or)) {
        const right = parseXor();
        node = { type: 'or', left: node, right };
      } else {
        break;
      }
    }
    return node;
  };

  const parseImplies = () => {
    let node = parseOr();
    while (true) {
      skipWs();
      if (tryConsumeSymbolOrWord(OP_SYMS.implies, OP_WORDS.implies)) {
        const right = parseOr();
        node = { type: 'implies', left: node, right };
      } else {
        break;
      }
    }
    return node;
  };

  const parseIff = () => {
    let node = parseImplies();
    while (true) {
      skipWs();
      if (tryConsumeSymbolOrWord(OP_SYMS.iff, OP_WORDS.iff)) {
        const right = parseImplies();
        node = { type: 'iff', left: node, right };
      } else {
        break;
      }
    }
    return node;
  };

  const ast = parseIff();
  skipWs();
  if (i !== src.length) {
    throw new Error(`Unexpected token '${src[i]}' at position ${i}`);
  }
  return ast;
}

