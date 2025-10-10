// Registry of allowed function names that can appear in arithmetic/binding expressions

const defaultAllowedOps = [
  'concat', 'substring', 'length',
  'head', 'tail', 'append', 'sublist', 'isSublistOf',
  'isSubstringOf',
  'fst', 'snd'
];

export const allowedOps = new Set(defaultAllowedOps);

// Optionally allow registering new ops at runtime/tests in a controlled way
export function registerOp(name) {
  if (typeof name === 'string' && name.trim()) {
    allowedOps.add(name.trim());
  }
}

export function unregisterOp(name) {
  if (typeof name === 'string' && name.trim()) {
    allowedOps.delete(name.trim());
  }
}


