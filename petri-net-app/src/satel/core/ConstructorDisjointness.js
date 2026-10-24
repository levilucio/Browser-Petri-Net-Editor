/** Sufficient proof for free constructors only. False means "ask the solver".
 * Variables, primitive expressions and operation calls are opaque. We deliberately
 * do not unify variables across or within patterns, or inspect guard conditions.
 */
export function constructorPatternsDisjoint(left, right, algebra) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const pending = left.map((term, i) => [term, right[i]]);
  const signature = term => {
    if (!term || typeof term !== 'object' || Array.isArray(term) ||
      Object.keys(term).some(k => k !== 'ctor' && k !== 'args') ||
      typeof term.ctor !== 'string' || !Array.isArray(term.args)) return null;
    const definition = Object.hasOwn(algebra.constructors, term.ctor) ? algebra.constructors[term.ctor] : null;
    return definition && term.args.length === definition.parameters.length ? definition : null;
  };
  while (pending.length) {
    const [a, b] = pending.pop(), sa = signature(a), sb = signature(b);
    if (!sa || !sb || sa.result !== sb.result) continue;
    if (a.ctor !== b.ctor) return true;
    for (let i = 0; i < a.args.length; i++) pending.push([a.args[i], b.args[i]]);
  }
  return false;
}
