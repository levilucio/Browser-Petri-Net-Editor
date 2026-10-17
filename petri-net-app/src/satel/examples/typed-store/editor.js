const source = `operation accepted(List, String, Bool, Pair): Bool
rule disabled(xs: List, s: String, p: Pair): accepted(xs, s, false, p) = false
rule empty(s: String, p: Pair): accepted([], s, true, p) = false
rule accepted(h: Any, t: List, s: String, p: Pair): accepted([h | t], s, true, p) = true if length(s) > 0 and fst(p) == s
rule refused(h: Any, t: List, s: String, p: Pair): accepted([h | t], s, true, p) = false if not (length(s) > 0 and fst(p) == s)`;
export function createTypedStoreIntention() {
  return { id: 'typed-store', name: 'Typed store — constructor and guard classes', kind: 'symbolic',
    symbolic: { source, operation: 'accepted', argsText: 'items, label, enabled, (tag, false)', variablesText: 'items: List, label: String, enabled: Bool, tag: String', maxDepth: 8,
      protocolSource: `case accepted(xs: List, s: String, p: Pair):
inputs xs, s, true, p
result true
pair store(items=xs, label=s, enabled=true, meta=p) => ack(true), echoed(xs), labelOut(s), metaOut(p)
pair read() => saved(xs)
case refused(xs: List, s: String, b: Bool, p: Pair):
inputs xs, s, b, p
result false
pair store(items=xs, label=s, enabled=b, meta=p) => ack(false)
pair read() => saved([])` } };
}
export function createTypedStoreExample(mutant = false) {
  const guard = 'enabled and length(items) > 0 and length(label) > 0 and fst(meta) == label';
  const place = (id, sort, io_type, valueTokens, x, y) => ({ id, label: id, sort, io_type, valueTokens, tokens: valueTokens.length, x, y });
  const arc = (source, target, binding, sourceType, targetType) => ({ id: `${source}-${target}`, source, target, binding, sourceType, targetType, type: `${sourceType}-to-${targetType}`, weight: 1 });
  const input = t => arc('storage', t, 'old', 'place', 'transition');
  const output = (t, p, b) => arc(t, p, b, 'transition', 'place');
  const method = { name: 'store', parameters: [{ name: 'items', sort: 'List' }, { name: 'label', sort: 'String' }, { name: 'enabled', sort: 'Bool' }, { name: 'meta', sort: 'Pair' }] };
  return { mode: 'algebraic',
    places: [place('storage', 'List', 'internal', [[]], 220, 300), place('ack', 'Bool', 'output', [], 650, 90), place('echoed', 'List', 'output', [], 650, 200), place('labelOut', 'String', 'output', [], 650, 310), place('metaOut', 'Pair', 'output', [], 650, 420), place('saved', 'List', 'output', [], 650, 530)],
    transitions: [ { id: 'accept', label: 'yes', x: 430, y: 180, guard, method }, { id: 'refuse', label: 'no', x: 430, y: 340, guard: `not (${guard})`, method: JSON.parse(JSON.stringify(method)) }, { id: 'read', label: 'read', x: 430, y: 520, guard: '', method: { name: 'read', parameters: [] } } ],
    arcs: [input('accept'), output('accept', 'storage', mutant ? 'tail(items)' : 'items'), output('accept', 'ack', 'true'), output('accept', 'echoed', 'items'), output('accept', 'labelOut', 'label'), output('accept', 'metaOut', 'meta'),
      input('refuse'), output('refuse', 'storage', 'old'), output('refuse', 'ack', 'false'), input('read'), output('read', 'storage', 'old'), output('read', 'saved', 'old')],
    testIntentions: [createTypedStoreIntention()],
    satelExample: { id: mutant ? 'typed-store-mutant' : 'typed-store', name: mutant ? 'Typed store — drops first item mutant' : 'Typed store reference', role: mutant ? 'mutant' : 'reference', description: 'store(List, String, Bool, Pair) accepts a nonempty list when enabled and the nonempty label matches the first metadata field. read() observes stored contents. Initial storage contains one empty-list token.' } };
}
