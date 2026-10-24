/** SMT declarations for one fixed algebra. Projection retains complete datatype
 * signatures and their transitive dependencies; it never prunes constructors.
 * Cached values are strings only, scoped to this adapter, with bounded retention.
 */
export function createSymbolicPreamble(algebra, prefix) {
  const names = [...new Set(Object.values(algebra.constructors).map(c => c.result))];
  const sort = s => s === 'Nat' ? 'Int' : ['Int', 'Bool', 'String'].includes(s) ? s : prefix + s;
  const nameOf = n => prefix + n;
  const bySort = Object.fromEntries(names.map(n => [n, Object.entries(algebra.constructors).filter(([, c]) => c.result === n)]));
  const valid = (s, value) => s === 'Nat' ? `(>= ${value} 0)` : s === 'String' ? `(str.in_re ${value} (re.* (re.range "\\u{0}" "\\u{ffff}")))` : names.includes(s) ? `(${prefix}valid_${s} ${value})` : 'true';
  const runtimeSorts = ['List', 'Pair', 'Any'].filter(s => names.includes(s));
  const runtimeValid = (s, x, d) => ['Nat', 'Int'].includes(s) ? `(and (>= ${d} 0) (>= ${x} ${s === 'Nat' ? 0 : '(- 2147483648)'}) (<= ${x} 2147483647))` : ['Bool', 'String'].includes(s) ? `(>= ${d} 0)` : runtimeSorts.includes(s) ? `(${prefix}runtime_${s} ${x} ${d})` : 'false';
  const render = (names, runtimeSorts) => {
    let preamble = '';
    if (names.length) {
      preamble += `(declare-datatypes (${names.map(n => `(${sort(n)} 0)`).join(' ')}) (${names.map(n => `(${bySort[n].map(([c, sig]) => `(${nameOf(c)} ${sig.parameters.map((s, i) => `(${nameOf(c)}_${i} ${sort(s)})`).join(' ')})`).join(' ')})`).join(' ')}))\n`;
      preamble += `(define-funs-rec (${names.map(n => `(${prefix}valid_${n} ((x ${sort(n)})) Bool)`).join(' ')}) (${names.map(n => `(or ${bySort[n].map(([c, sig]) => `(and ((_ is ${nameOf(c)}) x) ${sig.parameters.map((s, i) => valid(s, `(${nameOf(c)}_${i} x)`)).join(' ')})`).join(' ')})`).join(' ')}))\n`;
    }
    // Mirror validBuiltinValue, including bounded nested machine integers. Flat
    // list tails do not consume nesting depth; Any wrappers do.
    if (runtimeSorts.length) {
      const descend = s => {
        const tag = ctor => `((_ is ${nameOf(ctor)}) x)`;
        const field = (ctor, i) => `(${nameOf(ctor)}_${i} x)`;
        const smaller = '(- d 1)';
        if (s === 'List') return `(or ${tag('_ListNil')} (and ${tag('_ListCons')} ${runtimeValid('Any', field('_ListCons', 0), smaller)} ${runtimeValid('List', field('_ListCons', 1), 'd')}))`;
        if (s === 'Pair') return `(and ${runtimeValid('Any', field('_Pair', 0), smaller)} ${runtimeValid('Any', field('_Pair', 1), smaller)})`;
        return `(or ${['Int', 'Bool', 'String', 'List', 'Pair'].map(sort => `(and ${tag('_Any' + sort)} ${runtimeValid(sort, field('_Any' + sort, 0), smaller)})`).join(' ')})`;
      };
      preamble += `(define-funs-rec (${runtimeSorts.map(s => `(${prefix}runtime_${s} ((x ${sort(s)}) (d Int)) Bool)`).join(' ')}) (${runtimeSorts.map(s => `(and (>= d 0) ${descend(s)})`).join(' ')}))\n`;
    }
    return Object.freeze({ text: preamble, sorts: names.length });
  };
  const full = render(names, runtimeSorts);
  // Do not make a malformed, unrelated datatype disappear: retain the original
  // parser path unless the whole signature is safe and all sorts are inhabited.
  const primitives = new Set(['Nat', 'Int', 'Bool', 'String']);
  const inhabited = new Set(primitives);
  let changed;
  do {
    changed = false;
    for (const [name, constructors] of Object.entries(bySort)) {
      if (!inhabited.has(name) && constructors.some(([, sig]) => sig.parameters.every(s => inhabited.has(s)))) {
        inhabited.add(name); changed = true;
      }
    }
  } while (changed);
  const symbols = [...names.map(n => `valid_${n}`), ...runtimeSorts.map(n => `runtime_${n}`),
    ...Object.entries(algebra.constructors).flatMap(([n, sig]) => [n, ...sig.parameters.map((_, i) => `${n}_${i}`)])];
  const runtimeSignatures = {
    _ListNil: ['List', []], _ListCons: ['List', ['Any', 'List']],
    _Pair: ['Pair', ['Any', 'Any']],
    ...Object.fromEntries(['Int', 'Bool', 'String', 'List', 'Pair'].map(s => [`_Any${s}`, ['Any', [s]]]))
  };
  const runtimeWellFormed = !runtimeSorts.length || Object.entries(runtimeSignatures).every(([name, [result, parameters]]) => {
    const sig = algebra.constructors[name];
    return sig?.result === result && JSON.stringify(sig.parameters) === JSON.stringify(parameters);
  });
  const projectable = names.every(n => !primitives.has(n) && inhabited.has(n)) &&
    [...names, ...symbols].every(n => /^[A-Za-z_][A-Za-z0-9_]*$/.test(n) && !/^v\d+$|^g\d+_\d+$/.test(n)) &&
    new Set(symbols).size === symbols.length &&
    Object.values(algebra.constructors).every(sig => sig.parameters.every(s => inhabited.has(s))) &&
    runtimeWellFormed;
  const cache = new Map();
  let retainedChars = 0;
  const select = (roots, runtime, enabled = true) => {
    if (!enabled || !projectable) return full;
    const needed = new Set();
    const pending = [...roots, ...(runtime ? runtimeSorts : [])];
    while (pending.length) {
      const name = pending.pop();
      if (needed.has(name) || !Object.hasOwn(bySort, name)) continue;
      needed.add(name);
      for (const [, signature] of bySort[name]) pending.push(...signature.parameters);
    }
    // Preserve declaration order; equivalent constraints need not choose identical models.
    const selected = names.filter(name => needed.has(name));
    const key = JSON.stringify([selected, runtime]);
    if (cache.has(key)) return cache.get(key);
    const value = render(selected, runtime ? runtimeSorts : []);
    if (value.text.length <= 262144) {
      while (cache.size >= 32 || retainedChars + value.text.length > 262144) {
        const first = cache.keys().next().value;
        retainedChars -= cache.get(first).text.length; cache.delete(first);
      }
      cache.set(key, value); retainedChars += value.text.length;
    }
    return value;
  };
  return { sort, nameOf, valid, runtimeValid, full, select };
}
