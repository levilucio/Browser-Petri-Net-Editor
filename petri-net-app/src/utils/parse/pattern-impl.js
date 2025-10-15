// Implementation moved from utils/arith-parser.js

export function parsePattern(input) {
  if (typeof input !== 'string') throw new Error('Pattern must be a string');
  const src = input.trim();
  let i = 0;

  function skipWs() { while (i < src.length && /\s/.test(src[i])) i++; }

  function parsePatternElement() {
    skipWs();
    if (i >= src.length) throw new Error(`Unexpected end of input at position ${i}`);

    // Booleans
    if (src.slice(i, i + 1) === 'T') { i++; return { type: 'boolLit', value: true }; }
    if (src.slice(i, i + 1) === 'F') { i++; return { type: 'boolLit', value: false }; }
    if (src.slice(i, i + 4) === 'true') { i += 4; return { type: 'boolLit', value: true }; }
    if (src.slice(i, i + 5) === 'false') { i += 5; return { type: 'boolLit', value: false }; }

    // Integers
    if (/[0-9]/.test(src[i])) {
      let start = i;
      while (i < src.length && /[0-9]/.test(src[i])) i++;
      const value = parseInt(src.slice(start, i), 10);
      return { type: 'int', value };
    }

    // List pattern
    if (src[i] === '[') {
      i++; // '['
      skipWs();
      const elements = [];
      while (i < src.length && src[i] !== ']') {
        elements.push(parsePatternElement());
        skipWs();
        if (src[i] === ',') { i++; skipWs(); }
      }
      if (i >= src.length || src[i] !== ']') throw new Error(`Expected ']' at position ${i}`);
      i++; // ']'
      return { type: 'listPattern', elements };
    }

    // Variable or typed var
    if (/[a-zA-Z_]/.test(src[i])) {
      let start = i;
      while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) i++;
      const name = src.slice(start, i);

      // Type annotation
      skipWs();
      if (src[i] === ':') {
        i++;
        skipWs();
        let tStart = i;
        while (i < src.length && /[a-zA-Z]/.test(src[i])) i++;
        const varType = src.slice(tStart, i).toLowerCase();
        if (varType === 'int' || varType === 'bool' || varType === 'pair' || varType === 'string' || varType === 'list') {
          return { type: 'var', name, varType };
        } else {
          throw new Error(`Unknown type '${varType}' at position ${tStart}`);
        }
      }

      return { type: 'var', name };
    }

    // Pair/tuple pattern
    if (src[i] === '(') {
      i++; // '('
      skipWs();

      const elements = [];
      while (i < src.length && src[i] !== ')') {
        elements.push(parsePatternElement());
        skipWs();
        if (i < src.length && src[i] === ',') {
          i++; // ','
          skipWs();
        }
      }

      if (i >= src.length || src[i] !== ')') {
        throw new Error(`Expected ')' at position ${i}`);
      }
      i++; // ')'

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

export function matchPattern(pattern, value) {
  const bindings = new Map();

  function matchElement(pat, val) {
    switch (pat.type) {
      case 'int':
        if (typeof val !== 'number' || val !== pat.value) return false;
        return true;

      case 'boolLit':
        if (typeof val !== 'boolean' || val !== pat.value) return false;
        return true;

      case 'var':
        if (pat.varType) {
          const expectedType = pat.varType;
          if (expectedType === 'int' && typeof val !== 'number') return false;
          if (expectedType === 'bool' && typeof val !== 'boolean') return false;
          if (expectedType === 'string' && typeof val !== 'string') return false;
          if (expectedType === 'list' && !Array.isArray(val)) return false;
          if (expectedType === 'pair' && (!val || typeof val !== 'object' || !val.__pair__)) return false;
        }
        if (bindings.has(pat.name)) {
          const boundValue = bindings.get(pat.name);
          if (boundValue !== val) return false;
        } else {
          bindings.set(pat.name, val);
        }
        return true;

      case 'pairPattern':
        if (!val || typeof val !== 'object' || !val.__pair__) return false;
        if (!matchElement(pat.fst, val.fst) || !matchElement(pat.snd, val.snd)) return false;
        return true;

      case 'tuplePattern':
        if (!Array.isArray(val) || val.length !== pat.elements.length) return false;
        for (let index = 0; index < pat.elements.length; index++) {
          if (!matchElement(pat.elements[index], val[index])) return false;
        }
        return true;

      case 'listPattern':
        if (!Array.isArray(val) || val.length !== pat.elements.length) return false;
        for (let i = 0; i < pat.elements.length; i++) {
          if (!matchElement(pat.elements[i], val[i])) return false;
        }
        return true;

      default:
        return false;
    }
  }

  const success = matchElement(pattern, value);
  return success ? Object.fromEntries(bindings) : null;
}

export function validatePatternTyping(pattern) {
  function validateComponent(pat) {
    switch (pat.type) {
      case 'var':
        if (!pat.varType) {
          return `Variable '${pat.name}' must be typed (e.g., ${pat.name}:int, ${pat.name}:bool, ${pat.name}:pair)`;
        }
        return null;
      case 'pairPattern':
      case 'tuplePattern': {
        const elements = pat.type === 'pairPattern' ? [pat.fst, pat.snd] : pat.elements;
        for (const elem of elements) {
          const error = validateComponent(elem);
          if (error) return error;
        }
        return null;
      }
      default:
        return null;
    }
  }

  return validateComponent(pattern);
}

export function addTypeAnnotations(pattern, defaultType = 'Int') {
  function addTypes(pat) {
    switch (pat.type) {
      case 'var':
        if (!pat.varType) {
          return { ...pat, varType: defaultType.toLowerCase() };
        }
        return pat;
      case 'pairPattern':
        return { ...pat, fst: addTypes(pat.fst), snd: addTypes(pat.snd) };
      case 'tuplePattern':
        return { ...pat, elements: pat.elements.map(addTypes) };
      default:
        return pat;
    }
  }

  return addTypes(pattern);
}

export function stringifyPattern(pattern) {
  function stringifyElement(elem) {
    switch (elem.type) {
      case 'int':
        return String(elem.value);
      case 'boolLit':
        return elem.value ? 'T' : 'F';
      case 'var':
        return elem.varType
          ? `${elem.name}:${elem.varType.charAt(0).toUpperCase() + elem.varType.slice(1)}`
          : elem.name;
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

export function extractVariablesFromPattern(pattern) {
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
      case 'listPattern':
        if (Array.isArray(node.elements)) node.elements.forEach(traverse);
        break;
      case 'tuplePattern':
        if (node.elements) node.elements.forEach(traverse);
        break;
    }
  }

  traverse(pattern);
  return variables;
}



