import { splitTopLevel } from '../../utils/split-terms.js';
import { addBuiltins, builtinNames, resolveBuiltin, NIL, CONS, PAIR } from './BuiltinAlgebra.js';
import { formatSymbolicTerm, termSort } from './SymbolicTerms.js';
const identifier = '[A-Za-z_][A-Za-z0-9_]*';
export function parseVariables(text) {
  const vars = {};
  if (!text.trim()) return vars;
  for (const part of text.split(',')) {
    const match = part.trim().match(new RegExp(`^(${identifier})\\s*:\\s*(${identifier})$`));
    if (!match || Object.hasOwn(vars, match[1])) throw new Error(`Invalid or duplicate variable: ${part.trim()}`);
    vars[match[1]] = match[2];
  }
  return vars;
}
export function parseTerms(text, algebra, variables = {}) {
  const tokens = [];
  let rest = text.trim();
  while (rest) {
    const m = rest.match(/^("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\d+|[A-Za-z_][A-Za-z0-9_]*|<->|->|&&|\|\||==|!=|<=|>=|[()[\],|+*\-<>!^])/);
    if (!m) throw new Error(`Unexpected expression near: ${rest.slice(0, 30)}`);
    tokens.push(m[0]);
    rest = rest.slice(m[0].length).trimStart();
  }
  let pos = 0;
  const take = token => {
    if (tokens[pos++] !== token) throw new Error(`Expected ${token}`);
  };
  const atom = () => {
    const token = tokens[pos++];
    if (!token) throw new Error('Incomplete expression');
    if (token === '(') {
      const t = expression();
      if (tokens[pos] === ',') {
        pos++;
        const second = expression();
        take(')');
        return {
          ctor: PAIR,
          args: [t, second]
        };
      }
      take(')');
      return t;
    }
    if (token === '[') {
      const values = [];
      let tail = {
        ctor: NIL,
        args: []
      };
      if (tokens[pos] !== ']') {
        values.push(expression());
        while (tokens[pos] === ',') {
          pos++;
          values.push(expression());
        }
        if (tokens[pos] === '|') {
          pos++;
          tail = expression();
        }
      }
      take(']');
      return values.reduceRight((tail, head) => ({
        ctor: CONS,
        args: [head, tail]
      }), tail);
    }
    if (/^["']/.test(token)) return token[0] === '"' ? JSON.parse(token) : JSON.parse('"' + token.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"');
    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (!Number.isSafeInteger(n)) throw new Error('Literal exceeds exact integer range');
      return n;
    }
    if (token === 'true' || token === 'false') return token === 'true';
    if (tokens[pos] === '(') {
      pos++;
      const args = [];
      if (tokens[pos] !== ')') {
        args.push(expression());
        while (tokens[pos] === ',') {
          pos++;
          args.push(expression());
        }
      }
      take(')');
      if (['and', 'or', 'xor', 'implies', 'iff', 'not'].includes(token)) {
        if (args.length !== (token === 'not' ? 1 : 2)) throw new Error(`Wrong arity for ${token}`);
        return {
          op: token,
          left: args[0],
          ...(token === 'not' ? {} : {
            right: args[1]
          })
        };
      }
      if (Object.hasOwn(algebra.constructors, token)) return {
        ctor: token,
        args
      };
      if (Object.hasOwn(algebra.operations, token)) return {
        call: token,
        args
      };
      if (builtinNames.has(token)) return {
        call: resolveBuiltin(token, args, t => termSort(t, variables, algebra)),
        args
      };
      throw new Error(`Unknown constructor/operation: ${token}`);
    }
    if (Object.hasOwn(variables, token)) return {
      var: token
    };
    throw new Error(`Undeclared variable: ${token}`);
  };
  const unary = () => {
    if (tokens[pos] === '-') {
      pos++;
      const t = unary();
      return typeof t === 'number' ? -t : {
        op: '-',
        left: 0,
        right: t
      };
    }
    return atom();
  };
  const binary = (next, operators) => () => {
    let t = next();
    while (Object.hasOwn(operators, tokens[pos])) {
      const op = operators[tokens[pos++]];
      t = {
        op,
        left: t,
        right: next()
      };
    }
    return t;
  };
  const product = binary(unary, {
    '*': '*'
  });
  const sum = binary(product, {
    '+': '+',
    '-': '-'
  });
  const comparison = () => {
    let t = sum();
    if (['==', '!=', '<', '<=', '>', '>='].includes(tokens[pos])) {
      const op = tokens[pos++];
      t = {
        op,
        left: t,
        right: sum()
      };
    }
    return t;
  };
  const not = () => {
    if (['not', '!'].includes(tokens[pos])) {
      pos++;
      return {
        op: 'not',
        left: not()
      };
    }
    return comparison();
  };
  const and = binary(not, {
    and: 'and',
    '&&': 'and'
  });
  const xor = binary(and, {
    xor: 'xor',
    '^': 'xor'
  });
  const or = binary(xor, {
    or: 'or',
    '||': 'or'
  });
  const implies = binary(or, {
    implies: 'implies',
    '->': 'implies'
  });
  const expression = binary(implies, {
    iff: 'iff',
    '<->': 'iff'
  });
  const values = [];
  if (tokens.length) {
    values.push(expression());
    while (tokens[pos] === ',') {
      pos++;
      values.push(expression());
    }
  }
  if (pos !== tokens.length) throw new Error(`Unexpected token: ${tokens[pos]}`);
  return values;
}
// Split keywords only outside quoted literals and nested terms.
function splitIf(text) {
  let quote = null,
    depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if ('(['.includes(ch)) depth++;
    if (')]'.includes(ch)) depth--;
    if (!depth && /^\s+if\s+/.test(text.slice(i))) {
      const m = text.slice(i).match(/^\s+if\s+/)[0];
      return [text.slice(0, i), text.slice(i + m.length)];
    }
  }
  return [text];
}
export const one = (text, algebra, vars) => {
  const terms = parseTerms(text, algebra, vars);
  if (terms.length !== 1) throw new Error('Expected one expression');
  return terms[0];
};
export const lines = source => String(source).split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#'));

/** Explicit signatures and oriented conditional equations; no eval or implicit rewrite axioms. */
export function parseSymbolicSource(source) {
  let algebra = {
    constructors: {},
    operations: {}
  };
  const rules = [];
  for (const line of lines(source)) {
    const signature = line.match(new RegExp(`^(constructor|operation)\\s+(${identifier})\\(([^)]*)\\)\\s*:\\s*(${identifier})$`));
    if (signature) {
      const [, kind, name, params, result] = signature;
      if (algebra.constructors[name] || algebra.operations[name]) throw new Error(`Duplicate signature: ${name}`);
      const parameters = params.trim() ? params.split(',').map(s => s.trim()) : [];
      (kind === 'constructor' ? algebra.constructors : algebra.operations)[name] = {
        parameters,
        result,
        ...(kind === 'operation' ? {
          rules: []
        } : {})
      };
      continue;
    }
    if (line.startsWith('rule ')) {
      rules.push(line);
      continue;
    }
    throw new Error(`Expected constructor, operation or rule: ${line}`);
  }
  algebra = addBuiltins(algebra);
  for (const line of rules) {
    const match = line.match(/^rule\s+([A-Za-z_][\w.-]*)\s*\(([^)]*)\)\s*:\s*(.+?)\s+=(?!=)\s+(.+)$/);
    if (!match) throw new Error(`Invalid rule syntax: ${line}`);
    const [, id, declarations, lhs, rhsAndCondition] = match;
    const variables = parseVariables(declarations),
      parts = splitIf(rhsAndCondition);
    if (parts.length > 2) throw new Error('Only one if clause is allowed per rule');
    const left = one(lhs, algebra, variables);
    if (!left?.call) throw new Error('A defining equation must have an operation call on the left');
    const result = one(parts[0], algebra, variables);
    const conditions = parts[1] ? [one(parts[1], algebra, variables)] : [];
    algebra.operations[left.call].rules.push({
      id,
      variables,
      patterns: left.args,
      conditions,
      result
    });
  }
  return algebra;
}
export function formatSymbolicSource(algebra) {
  return [...Object.entries(algebra.constructors).filter(([, s]) => !s.builtin).map(([n, s]) => `constructor ${n}(${s.parameters.join(', ')}) : ${s.result}`), ...Object.entries(algebra.operations).filter(([, s]) => !s.builtin).map(([n, s]) => `operation ${n}(${s.parameters.join(', ')}) : ${s.result}`), '', ...Object.entries(algebra.operations).filter(([, s]) => !s.builtin).flatMap(([name, s]) => s.rules.map(r => `rule ${r.id}(${Object.entries(r.variables || {}).map(([n, s]) => `${n}: ${s}`).join(', ')}): ${name}(${r.patterns.map(formatSymbolicTerm).join(', ')}) = ${formatSymbolicTerm(r.result)}${r.conditions?.length ? ` if ${r.conditions.map(formatSymbolicTerm).join(' and ')}` : ''}`))].join('\n');
}
