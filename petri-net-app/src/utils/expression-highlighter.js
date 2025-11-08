const BOOLEAN_OPERATIONS = new Set(['and', 'or', 'not', 'xor', 'implies']);
const OPERATOR_CHARS = new Set(['+', '-', '*', '/', '=', '!', '<', '>', '&', '|', '^', '%']);

function isIdentifierChar(char) {
  return /[A-Za-z0-9_]/.test(char);
}

export function tokenizeExpression(expression) {
  if (typeof expression !== 'string' || expression.length === 0) {
    return [];
  }

  const tokens = [];
  const length = expression.length;
  let i = 0;
  let expectingType = false;

  while (i < length) {
    const char = expression[i];

    // Whitespace
    if (/\s/.test(char)) {
      let start = i;
      while (i < length && /\s/.test(expression[i])) {
        i += 1;
      }
      tokens.push({ text: expression.slice(start, i), category: 'whitespace' });
      continue;
    }

    // String literal
    if (char === '\'' || char === '"') {
      const quote = char;
      let start = i;
      i += 1;
      while (i < length && expression[i] !== quote) {
        if (expression[i] === '\\' && i + 1 < length) {
          i += 2;
        } else {
          i += 1;
        }
      }
      if (i < length) {
        i += 1; // include closing quote
      }
      tokens.push({ text: expression.slice(start, i), category: 'literal' });
      expectingType = false;
      continue;
    }

    // Numeric literal
    if (/[0-9]/.test(char)) {
      let start = i;
      while (i < length && /[0-9]/.test(expression[i])) {
        i += 1;
      }
      tokens.push({ text: expression.slice(start, i), category: 'literal' });
      expectingType = false;
      continue;
    }

    // Punctuation and separators
    if ('()[],' .includes(char)) {
      tokens.push({ text: char, category: 'punctuation' });
      i += 1;
      continue;
    }

    if (char === ':') {
      tokens.push({ text: char, category: 'punctuation' });
      i += 1;
      expectingType = true;
      continue;
    }

    if (OPERATOR_CHARS.has(char)) {
      let start = i;
      while (i < length && OPERATOR_CHARS.has(expression[i])) {
        i += 1;
      }
      tokens.push({ text: expression.slice(start, i), category: 'operation' });
      expectingType = false;
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      let start = i;
      while (i < length && isIdentifierChar(expression[i])) {
        i += 1;
      }
      const word = expression.slice(start, i);

      if (expectingType) {
        tokens.push({ text: word, category: 'type' });
        expectingType = false;
        continue;
      }

      let j = i;
      while (j < length && /\s/.test(expression[j])) {
        j += 1;
      }
      const nextChar = expression[j];

      if (nextChar === '(' || BOOLEAN_OPERATIONS.has(word.toLowerCase())) {
        tokens.push({ text: word, category: 'operation' });
      } else {
        tokens.push({ text: word, category: 'variable' });
      }
      continue;
    }

    // Fallback as punctuation or literal character
    tokens.push({ text: char, category: 'punctuation' });
    i += 1;
    expectingType = false;
  }

  return tokens;
}

export const EXPRESSION_STYLE_MAP = {
  operation: { fill: '#b56b16', fontStyle: 'italic' },
  variable: { fill: '#1f5fbf', fontStyle: 'normal' },
  type: { fill: '#7a2fbf', fontStyle: 'bold' },
  literal: { fill: '#2f855a', fontStyle: 'normal' },
  punctuation: { fill: '#4a5568', fontStyle: 'normal' },
  whitespace: { fill: '#333333', fontStyle: 'normal' },
};

const WIDTH_COEFFICIENTS = {
  whitespace: 0.35,
  punctuation: 0.45,
};

export function measureTokenWidth(token, fontSize, charFactor) {
  if (!token || !token.text) return 0;
  const { category, text } = token;
  const length = text.length;
  if (length === 0) return 0;

  if (category === 'whitespace') {
    return fontSize * charFactor * (WIDTH_COEFFICIENTS.whitespace || 0.35) * length;
  }

  if (category === 'punctuation') {
    return fontSize * charFactor * (WIDTH_COEFFICIENTS.punctuation || 0.45) * length;
  }

  if (category === 'literal') {
    return Math.max(fontSize * 0.85, length * fontSize * charFactor * 1.05);
  }

  return Math.max(fontSize * 0.9, length * fontSize * charFactor);
}

export const EXPRESSION_DEFAULT_STYLE = { fill: '#333333', fontStyle: 'normal' };



