/** Internal, JSON-safe term DAG. References are local to this graph and point
 * strictly backwards. No auxiliary symbols enter a test's parameter namespace.
 * Packing by object identity preserves syntax; it performs no logical rewriting.
 */
export function packTermGraph(term) {
  if (Array.isArray(term)) throw new Error('Expected a single symbolic term');
  const uses = new WeakMap(), counting = new WeakSet();
  const count = t => {
    if (!t || typeof t !== 'object') return;
    if (counting.has(t)) throw new Error('Cyclic symbolic term');
    uses.set(t, (uses.get(t) || 0) + 1);
    if (uses.get(t) > 1) return;
    counting.add(t); Object.values(t).forEach(count); counting.delete(t);
  };
  count(term);
  const terms = [], memo = new WeakMap(), active = new WeakSet();
  const visit = t => {
    if (!t || typeof t !== 'object') return t;
    if (memo.has(t)) return memo.get(t);
    if (active.has(t)) throw new Error('Cyclic symbolic term');
    active.add(t);
    if (Array.isArray(t)) {
      const result = t.map(visit);
      active.delete(t); memo.set(t, result); return result;
    }
    if (t.termGraph || t.graphRef !== undefined) throw new Error('Cannot pack an already scoped graph');
    const node = Object.fromEntries(Object.entries(t).map(([key, value]) => [key, visit(value)]));
    // Inline single-use nodes and variable leaves. Extra let bindings for them
    // only increase the SMT input; they do not preserve additional sharing.
    if (t !== term && (uses.get(t) === 1 || t.var)) {
      active.delete(t); memo.set(t, node); return node;
    }
    const ref = { graphRef: terms.length };
    terms.push(node); active.delete(t); memo.set(t, ref); return ref;
  };
  const root = visit(term);
  return root?.graphRef === undefined ? root : { termGraph: terms };
}

/** Lazy evaluation is essential: unused branches may contain partial selectors.
 * The callback decides which references to visit; successful results are cached
 * only for this interpretation, never across bindings or solver queries.
 */
export function interpretTermGraph(graph, visit) {
  const terms = graph.termGraph;
  if (!Array.isArray(terms) || !terms.length) throw new Error('Empty or invalid term graph');
  const cache = new Map();
  const resolve = (index, before) => {
    if (!Number.isInteger(index) || index < 0 || index >= before) throw new Error('Invalid or forward term graph reference');
    if (!cache.has(index)) cache.set(index, visit(terms[index], ref => resolve(ref, index)));
    return cache.get(index);
  };
  return resolve(terms.length - 1, terms.length);
}

/** Expanded structural size, computed in DAG time and saturated at a safe
 * integer. For a packed graph this counts its stored nodes/reference edges.
 */
export function termSize(term) {
  const memo = new WeakMap();
  const visit = t => {
    if (!t || typeof t !== 'object') return 1;
    if (!memo.has(t)) memo.set(t, Object.values(t).reduce((size, child) => Math.min(Number.MAX_SAFE_INTEGER, size + visit(child)), 1));
    return memo.get(t);
  };
  return visit(term);
}
