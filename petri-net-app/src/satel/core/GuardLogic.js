const not = x => ({ op: 'not', left: x });
const and = (a, b) => ({ op: 'and', left: a, right: b });
const or = (a, b) => ({ op: 'or', left: a, right: b });
/** One Boolean decomposition step. OR alternatives are explicitly disjoint. */
export function splitGuard(c) {
  if (!c?.op) return null;
  const a = c.left, b = c.right;
  if (c.op === 'and') return [[a, b]];
  if (c.op === 'or') return [[a], [not(a), b]];
  if (c.op === 'implies') return [[or(not(a), b)]];
  if (c.op === 'iff') return [[or(and(a, b), and(not(a), not(b)))]];
  if (c.op === 'xor') return [[or(and(a, not(b)), and(not(a), b))]];
  if (c.op !== 'not') return null;
  if (typeof a === 'boolean') return [[!a]];
  if (a?.op === 'not') return [[a.left]];
  if (a?.op === 'and') return [[not(a.left)], [a.left, not(a.right)]];
  if (a?.op === 'or') return [[not(a.left), not(a.right)]];
  if (a?.op === 'implies') return [[a.left, not(a.right)]];
  if (a?.op === 'iff') return [[{ op: 'xor', left: a.left, right: a.right }]];
  if (a?.op === 'xor') return [[{ op: 'iff', left: a.left, right: a.right }]];
  return null;
}
